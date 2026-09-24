import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildIsolatedReferenceSchemaDdl, REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { UPDATE_TABLE_CONTRACTS } from "./update-contract";
import { productionWriteLockKey } from "./update-apply";
import { UPDATER_ROLE_NAME } from "./updater-role";
import {
  STAGE4_DRY_RUN_SCHEMA,
  STAGE4_ROLLBACK_SCHEMA,
  buildManagersCandidate,
  buildSourceBundle,
  evaluateManagersPlan,
  readManagersProductionState,
  runManagersApply,
  runManagersIsolatedValidation,
  verifyManagersPostApply,
  type ApplyBindingInput,
  type Stage4IsolatedSql,
} from "./stage4-managers";
import { buildAlterRolePasswordSql, buildScramSha256Verifier } from "../../../../scripts/lib/scram-verifier.mjs";
import { COMMIT_SHA, SYNTHETIC_MANAGERS, backupSummaryText, currentManagerRows, managersResponse, minutesAgo, runFacts, seedImportBatch, state, worldRow } from "./__fixtures__/stage4-fixtures";

/**
 * Stage 4(managersだけ)を使い捨てPostgreSQLで検証する。
 *  - 隔離dry run・実executor・post-apply検証・undoの模擬(dry-run modeと同じ関数)
 *  - Production相当の隔離schema(RLS FORCE + リポジトリのupdater role/policy SQL + SCRAM login)に対する
 *    apply mode(runManagersApply): すべての拒否条件で書き込み0、advisory lock競合、transaction rollback、
 *    正常適用・post-apply検証・二重適用の拒否・自動undoなし
 * roleはcluster全体の名前のため、開始時に既存なら中止し、終了時に削除する。
 */

const APPLY_SCHEMA = "reference_data_stage4_apply_test";
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SQL_DIR = path.join(ROOT, "docs", "production-readiness", "sql");
const readSql = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
const toSchema = (sql: string, schema: string) => sql.replace(/\breference_data\b(?!_)/g, schema);
const PASSWORD = "Stage4-Disposable-Test-Only-Password-0001";
const FETCHED = "2026-09-24T09:00:00.000Z";

const SQL: Stage4IsolatedSql = {
  reference: {
    base: readSql(REPOSITORY_REFERENCE_SQL_FILES.base),
    detailExtension: readSql(REPOSITORY_REFERENCE_SQL_FILES.detailExtension),
    nameSortKeyExtension: readSql(REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension),
    analysisNameExtension: readSql(REPOSITORY_REFERENCE_SQL_FILES.analysisNameExtension),
  },
  createUpdaterRole: readSql("create-reference-data-updater-role.sql"),
  updaterPolicies: readSql("create-reference-data-updater-rls-policies.sql"),
  rollbackUpdaterRole: readSql("rollback-reference-data-updater-role.sql"),
};

const config = buildTestOnlyPgConfigFromEnv(process.env);
let admin: Client;
let connected = false;
let roleCreated = false;

async function roleExists(): Promise<boolean> {
  return (await admin.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME])).rows[0].e === true;
}

async function insertRows(table: keyof typeof UPDATE_TABLE_CONTRACTS, rows: readonly Record<string, unknown>[]): Promise<void> {
  const contract = UPDATE_TABLE_CONTRACTS[table];
  for (const row of rows) {
    const cols = contract.productionColumns.filter((c) => c in row && c !== "created_at" && c !== "updated_at");
    const values = cols.map((c) => (row[c] != null && contract.jsonbColumns.includes(c) ? JSON.stringify(row[c]) : row[c] ?? null));
    await admin.query(`insert into ${APPLY_SCHEMA}.${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`, values);
  }
}

async function counts(): Promise<{ managers: number; batches: number }> {
  const r = await admin.query(`select (select count(*) from ${APPLY_SCHEMA}.managers)::int as m, (select count(*) from ${APPLY_SCHEMA}.import_batches)::int as b`);
  return { managers: r.rows[0].m, batches: r.rows[0].b };
}

async function asUpdater<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ ...config, user: UPDATER_ROLE_NAME, password: PASSWORD });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  admin = new Client(config);
  await admin.connect();
  connected = true;
  if (await roleExists()) throw new Error("reference_data_updater already exists in the isolated DB; refusing to reuse it");
}, 30000);

afterAll(async () => {
  if (!connected) return;
  if (roleCreated) await admin.query(toSchema(SQL.rollbackUpdaterRole, APPLY_SCHEMA)).catch(() => undefined);
  for (const s of [APPLY_SCHEMA, STAGE4_DRY_RUN_SCHEMA, STAGE4_ROLLBACK_SCHEMA]) await admin.query(`drop schema if exists ${s} cascade`);
  if (roleCreated && (await roleExists())) {
    await admin.query(`drop owned by ${UPDATER_ROLE_NAME}`);
    await admin.query(`drop role ${UPDATER_ROLE_NAME}`);
  }
  await admin.end();
}, 30000);

describe("Stage 4 dry-run mode: 隔離dry run・実executor・post-apply検証・undoの模擬", () => {
  it("managers 4→5、再diff 0、監査batch verified、post-apply検証ok、undoで既存行が元に戻り追加行は残る。終了後にroleとschemaが残らない", async () => {
    const st = state();
    const b = await buildManagersCandidate(managersResponse(), FETCHED, st.managers, new Date().toISOString());
    const r = await runManagersIsolatedValidation(admin, b, st, SQL, new Date());
    expect(r.problems).toEqual([]);
    expect(r.verified).toBe(true);
    expect(r.dryRun).toMatchObject({ verified: true, managersBefore: 4, managersAfter: 5, observedAfterChecksumMatches: true, rediffChanges: 0 });
    expect(r.executor).toMatchObject({ applyOk: true, auditBatchVerified: true, postVerifyOk: true });
    expect(r.undo).toMatchObject({ ok: true, insertedRemaining: 1, existingRowsMatchBefore: true });
    expect(await roleExists()).toBe(false);
    const left = await admin.query("select count(*)::int as n from pg_namespace where nspname = any($1)", [[STAGE4_DRY_RUN_SCHEMA, STAGE4_ROLLBACK_SCHEMA]]);
    expect(left.rows[0].n).toBe(0);
    const v = await admin.query("select current_setting('server_version_num')::int as v");
    expect(v.rows[0].v).toBeGreaterThanOrEqual(160000);
  }, 60000);
});

describe("Stage 4 apply mode(Production相当の隔離schema、updaterとしてlogin)", () => {
  let base: ApplyBindingInput;

  beforeAll(async () => {
    await admin.query(`drop schema if exists ${APPLY_SCHEMA} cascade`);
    await admin.query(buildIsolatedReferenceSchemaDdl(APPLY_SCHEMA, SQL.reference));
    for (const t of ["world_player_cards", "managers", "import_batches", "player_card_analysis"]) {
      await admin.query(`alter table ${APPLY_SCHEMA}.${t} enable row level security`);
      await admin.query(`alter table ${APPLY_SCHEMA}.${t} force row level security`);
    }
    await insertRows("import_batches", [seedImportBatch()]);
    await insertRows("world_player_cards", [worldRow()]);
    await insertRows("managers", currentManagerRows(4));
    await admin.query(toSchema(SQL.createUpdaterRole, APPLY_SCHEMA));
    roleCreated = true;
    await admin.query(toSchema(SQL.updaterPolicies, APPLY_SCHEMA));
    await admin.query(buildAlterRolePasswordSql(UPDATER_ROLE_NAME, buildScramSha256Verifier(PASSWORD)));

    // plan mode相当: updaterとして読み取り専用で現在状態を取り、記録済みの応答からcandidateを作る。
    const now = new Date();
    const current = await asUpdater(async (c) => {
      await c.query("begin read only");
      try {
        return await readManagersProductionState(c, APPLY_SCHEMA);
      } finally {
        await c.query("rollback");
      }
    });
    expect(current.counts).toEqual({ world_player_cards: 1, managers: 4, import_batches: 1 });
    const b = await buildManagersCandidate(managersResponse(), FETCHED, current.managers, now.toISOString());
    const e = evaluateManagersPlan(b);
    expect(e.problems).toEqual([]);
    base = {
      schema: APPLY_SCHEMA,
      bundle: buildSourceBundle(managersResponse(), FETCHED, b, current.counts),
      boundSourceChecksum: b.candidate.sourceChecksum,
      boundPlanChecksum: b.plan.planChecksum,
      acknowledgedManualReview: e.manualReviewCodes.length === 0 ? "none" : e.manualReviewCodes.join(","),
      planRunId: "101",
      planFacts: runFacts("plan", 101, { created: minutesAgo(now, 180), updated: minutesAgo(now, 170) }),
      newerPlanRunCount: 0,
      backupRunId: "900",
      backupFacts: runFacts("backup", 900, { created: minutesAgo(now, 90), updated: minutesAgo(now, 60) }),
      backupSummaryText: backupSummaryText("900", { world_player_cards: 1, managers: 4, player_card_analysis: 1, import_batches: 1 }),
      dryRunRunId: "202",
      dryRunFacts: runFacts("dry-run", 202, { created: minutesAgo(now, 50), updated: minutesAgo(now, 35) }),
      dryRun: {
        verified: true, planRunId: "101", backupRunId: "900", sourceChecksum: b.candidate.sourceChecksum, planChecksum: b.plan.planChecksum,
        beforeChecksum: b.plan.report.beforeChecksum, startedAt: minutesAgo(now, 45), completedAt: minutesAgo(now, 40),
      },
      applyCommitSha: COMMIT_SHA,
      approvedBy: "owner",
      now: now.toISOString(),
    };
  }, 60000);

  it("拒否条件はすべて書き込み0(Backup・承認・candidate・commit・run・dry run・件数)", async () => {
    const now = new Date(base.now);
    const other = await buildManagersCandidate(managersResponse([...SYNTHETIC_MANAGERS, { ...SYNTHETIC_MANAGERS[0], id: "stage4-manager-6" }]), FETCHED, currentManagerRows(4), base.now);
    const cases: Array<[string, Partial<ApplyBindingInput>, string]> = [
      ["Run #6のような空Backup", { backupSummaryText: backupSummaryText("900", { world_player_cards: 0, managers: 0, player_card_analysis: 0, import_batches: 0 }) }, "backup_content_policy_failed"],
      ["期限切れBackup", { backupFacts: runFacts("backup", 900, { created: minutesAgo(now, 25 * 60 + 5), updated: minutesAgo(now, 25 * 60) }) }, "backup_expired"],
      ["旧形式Backup", { backupSummaryText: backupSummaryText("900", { world_player_cards: 1, managers: 4, player_card_analysis: 1, import_batches: 1 }, (s) => (s.backupVersion = "1")) }, "backup_summary:format_version_not_2"],
      ["Productionと件数が違うBackup", { backupSummaryText: backupSummaryText("900", { world_player_cards: 1, managers: 5, player_card_analysis: 1, import_batches: 1 }) }, "backup_counts_differ_from_production:managers"],
      ["stale plan", { boundPlanChecksum: "e".repeat(64) }, "stale_plan"],
      ["再取得でchecksumが変わったupstream", { bundle: buildSourceBundle(managersResponse([...SYNTHETIC_MANAGERS, { ...SYNTHETIC_MANAGERS[0], id: "stage4-manager-6" }]), FETCHED, other, { world_player_cards: 1, managers: 4, import_batches: 1 }) }, "source_checksum_not_bound"],
      ["承認されたsource checksumと違う", { boundSourceChecksum: "f".repeat(64) }, "source_checksum_not_bound"],
      ["manual reviewの確認入力なし", { acknowledgedManualReview: "" }, "manual_review_not_acknowledged"],
      ["commit SHAが違う", { applyCommitSha: "b".repeat(40) }, "commit_sha_mismatch"],
      ["新しいplan runがある", { newerPlanRunCount: 1 }, "candidate_not_latest"],
      ["plan runが再実行", { planFacts: { ...base.planFacts, runAttempt: 2 } }, "plan_is_rerun"],
      ["dry runが未検証", { dryRun: { ...base.dryRun, verified: false } }, "dry_run_not_verified"],
      ["dry runが別のplanにbinding", { dryRun: { ...base.dryRun, planRunId: "999" } }, "dry_run_not_bound_to_runs"],
      ["dry runがBackupより前", { dryRun: { ...base.dryRun, startedAt: minutesAgo(now, 70), completedAt: minutesAgo(now, 65) } }, "backup_time_order_invalid"],
    ];
    for (const [label, patch, problem] of cases) {
      const r = await asUpdater((c) => runManagersApply(c, { ...base, ...patch }));
      expect(r.status, label).toBe("not_applied");
      if (r.status === "not_applied") expect(r.problems, label).toContain(problem);
      expect(await counts(), label).toEqual({ managers: 4, batches: 1 });
    }
  }, 120000);

  it("updater以外の接続(admin)はpreflightで停止し、書き込み0", async () => {
    const r = await runManagersApply(admin, base);
    expect(r.status).toBe("not_applied");
    if (r.status === "not_applied") {
      expect(r.stage).toBe("preflight");
      expect(r.problems).toContain("wrong_role");
    }
    expect(await counts()).toEqual({ managers: 4, batches: 1 });
  }, 30000);

  it("production-write advisory lockが他で保持されていれば停止し、書き込み0", async () => {
    const holder = new Client(config);
    await holder.connect();
    try {
      await holder.query("select pg_advisory_lock($1::bigint)", [productionWriteLockKey()]);
      const r = await asUpdater((c) => runManagersApply(c, base));
      expect(r.status).toBe("not_applied");
      if (r.status === "not_applied") expect(r.problems).toContain("production_write_lock_busy");
    } finally {
      await holder.query("select pg_advisory_unlock_all()");
      await holder.end();
    }
    expect(await counts()).toEqual({ managers: 4, batches: 1 });
  }, 30000);

  it("transaction内の書き込み失敗はrollbackされ、監査batchも残らない", async () => {
    await admin.query(`alter table ${APPLY_SCHEMA}.managers add constraint stage4_test_block check (internal_manager_id < 5) not valid`);
    try {
      const r = await asUpdater((c) => runManagersApply(c, base));
      expect(r.status).toBe("not_applied");
      if (r.status === "not_applied") {
        expect(r.stage).toBe("apply");
        expect(r.problems[0]).toBe("write_failed");
        expect(JSON.stringify(r)).not.toMatch(/violates|constraint|stage4_test_block/);
      }
    } finally {
      await admin.query(`alter table ${APPLY_SCHEMA}.managers drop constraint stage4_test_block`);
    }
    expect(await counts()).toEqual({ managers: 4, batches: 1 });
  }, 30000);

  it("全binding成立で1回だけ適用: 4→5、監査batch verified、post-apply検証ok。自動undoはせず、二重適用は拒否、World変更は検出", async () => {
    const r = await asUpdater((c) => runManagersApply(c, base));
    expect(r.status).toBe("applied_verified");
    if (r.status === "not_applied") return;
    expect(r).toMatchObject({ inserted: 1, updated: 0 });
    expect(r.postVerify).toMatchObject({ ok: true, problems: [] });
    expect(r.undo.insertedIdentities).toHaveLength(1);
    expect(r.undo.restoreRows).toHaveLength(0);
    expect(await counts()).toEqual({ managers: 5, batches: 2 });
    const batch = await admin.query(`select status, payload_hash, target_table, approved_by from ${APPLY_SCHEMA}.import_batches where batch_id = $1`, [r.batchId]);
    expect(batch.rows[0]).toEqual({ status: "verified", payload_hash: base.boundPlanChecksum, target_table: "managers", approved_by: "owner" });
    expect(JSON.stringify({ ...r, undo: undefined })).not.toMatch(/Synthetic|postgres:\/\/|Password/);

    // 二重適用(同じ承認・同じ計画)は拒否され、何も書かない。
    const again = await asUpdater((c) => runManagersApply(c, base));
    expect(again.status).toBe("not_applied");
    if (again.status === "not_applied") expect(again.problems).toEqual(expect.arrayContaining(["stale_plan"]));
    expect(await counts()).toEqual({ managers: 5, batches: 2 });

    // verify mode相当(読み取り専用)。
    const verifyOnce = () =>
      asUpdater(async (c) => {
        await c.query("begin read only");
        try {
          return await verifyManagersPostApply(c, r.expectation);
        } finally {
          await c.query("rollback");
        }
      });
    expect((await verifyOnce()).problems).toEqual([]);
    await admin.query(`update ${APPLY_SCHEMA}.world_player_cards set updated_at = now() + interval '1 minute'`);
    expect((await verifyOnce()).problems).toContain("world_changed");
  }, 60000);
});
