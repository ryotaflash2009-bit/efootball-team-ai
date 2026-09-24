import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildIsolatedReferenceSchemaDdl, REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { UPDATE_TABLE_CONTRACTS } from "./update-contract";
import { UPDATER_ROLE_NAME } from "./updater-role";
import { type DryRunRecord, type Stage4IsolatedSql } from "./stage4-managers";
import {
  WORLD_DRY_RUN_SCHEMA,
  WORLD_ROLLBACK_SCHEMA,
  buildWorldBundle,
  buildWorldCandidate,
  evaluateWorldPlan,
  readWorldProductionState,
  runWorldApply,
  runWorldIsolatedValidation,
  verifyWorldPostApply,
  type WorldApplyInput,
} from "./stage4-world";
import { buildAlterRolePasswordSql, buildScramSha256Verifier } from "../../../../scripts/lib/scram-verifier.mjs";
import { COMMIT_SHA, backupSummaryText, currentManagerRows, minutesAgo, runFacts, seedImportBatch } from "./__fixtures__/stage4-fixtures";
import { currentWorldRows, recordedWorldPages, upstreamPlayers, worldState } from "./__fixtures__/stage4-world-fixtures";

/**
 * World専用リハーサルを使い捨てPostgreSQLで検証する(Production相当の隔離schema: RLS FORCE + リポジトリのupdater role/policy SQL)。
 * roleはcluster全体の名前のため、開始時に既存なら中止し、終了時に削除する。
 */

const APPLY_SCHEMA = "reference_data_stage4w_apply_test";
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql");
const readSql = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
const toSchema = (sql: string, schema: string) => sql.replace(/\breference_data\b(?!_)/g, schema);
const PASSWORD = "Stage4W-Disposable-Test-Only-Password-0001";
const FETCHED = "2026-09-25T09:00:00.000Z";

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

const roleExists = async () => (await admin.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME])).rows[0].e === true;

async function insertRows(table: keyof typeof UPDATE_TABLE_CONTRACTS, rows: readonly Record<string, unknown>[]): Promise<void> {
  const contract = UPDATE_TABLE_CONTRACTS[table];
  for (const row of rows) {
    const cols = contract.productionColumns.filter((c) => c in row && c !== "created_at" && c !== "updated_at");
    const values = cols.map((c) => (row[c] != null && contract.jsonbColumns.includes(c) ? JSON.stringify(row[c]) : row[c] ?? null));
    await admin.query(`insert into ${APPLY_SCHEMA}.${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`, values);
  }
}

async function counts() {
  const r = await admin.query(
    `select (select count(*) from ${APPLY_SCHEMA}.world_player_cards)::int as w, (select count(*) from ${APPLY_SCHEMA}.managers)::int as m, (select count(*) from ${APPLY_SCHEMA}.import_batches)::int as b`,
  );
  return { world: r.rows[0].w, managers: r.rows[0].m, batches: r.rows[0].b };
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
  for (const s of [APPLY_SCHEMA, WORLD_DRY_RUN_SCHEMA, WORLD_ROLLBACK_SCHEMA]) await admin.query(`drop schema if exists ${s} cascade`);
  if (roleCreated && (await roleExists())) {
    await admin.query(`drop owned by ${UPDATER_ROLE_NAME}`);
    await admin.query(`drop role ${UPDATER_ROLE_NAME}`);
  }
  await admin.end();
}, 30000);

describe("World dry-run mode: 隔離dry run・実executor・post-apply検証・undoの模擬", () => {
  it("World 4→5、再diff 0、監査batch verified、post-apply検証ok、undoで既存行が元に戻る。終了後にroleとschemaが残らない", async () => {
    const st = worldState();
    const b = await buildWorldCandidate(recordedWorldPages(), FETCHED, st, new Date().toISOString());
    const r = await runWorldIsolatedValidation(admin, b, st, SQL, new Date());
    expect(r.problems).toEqual([]);
    expect(r.dryRun).toMatchObject({ verified: true, worldBefore: 4, worldAfter: 5, observedAfterChecksumMatches: true, rediffChanges: 0 });
    expect(r.executor).toMatchObject({ applyOk: true, auditBatchVerified: true, postVerifyOk: true });
    expect(r.undo).toMatchObject({ ok: true, restored: 2, insertedRemaining: 1, existingRowsMatchBefore: true });
    expect(await roleExists()).toBe(false);
  }, 120000);
});

describe("World apply mode(Production相当の隔離schema、updaterとしてlogin)", () => {
  let base: WorldApplyInput;

  beforeAll(async () => {
    await admin.query(`drop schema if exists ${APPLY_SCHEMA} cascade`);
    await admin.query(buildIsolatedReferenceSchemaDdl(APPLY_SCHEMA, SQL.reference));
    for (const t of ["world_player_cards", "managers", "import_batches", "player_card_analysis"]) {
      await admin.query(`alter table ${APPLY_SCHEMA}.${t} enable row level security`);
      await admin.query(`alter table ${APPLY_SCHEMA}.${t} force row level security`);
    }
    await insertRows("import_batches", [seedImportBatch()]);
    await insertRows("world_player_cards", currentWorldRows());
    await insertRows("managers", currentManagerRows(2));
    await admin.query(toSchema(SQL.createUpdaterRole, APPLY_SCHEMA));
    roleCreated = true;
    await admin.query(toSchema(SQL.updaterPolicies, APPLY_SCHEMA));
    await admin.query(buildAlterRolePasswordSql(UPDATER_ROLE_NAME, buildScramSha256Verifier(PASSWORD)));

    const now = new Date();
    const current = await asUpdater(async (c) => {
      await c.query("begin read only");
      try {
        return await readWorldProductionState(c, APPLY_SCHEMA);
      } finally {
        await c.query("rollback");
      }
    });
    expect(current.counts).toEqual({ world_player_cards: 4, managers: 2, import_batches: 1 });
    const b = await buildWorldCandidate(recordedWorldPages(), FETCHED, current, now.toISOString());
    const e = evaluateWorldPlan(b);
    expect(e.problems).toEqual([]);
    const dryRun: DryRunRecord = {
      verified: true, planRunId: "101", backupRunId: "900", sourceChecksum: b.candidate.sourceChecksum, planChecksum: b.plan.planChecksum,
      beforeChecksum: b.plan.report.beforeChecksum, startedAt: minutesAgo(now, 45), completedAt: minutesAgo(now, 40),
    };
    base = {
      schema: APPLY_SCHEMA,
      bundle: buildWorldBundle(recordedWorldPages(), FETCHED, b, current.counts),
      boundSourceChecksum: b.candidate.sourceChecksum,
      boundPlanChecksum: b.plan.planChecksum,
      acknowledgedManualReview: e.manualReviewCodes.join(","),
      planRunId: "101",
      planFacts: runFacts("plan", 101, { created: minutesAgo(now, 180), updated: minutesAgo(now, 170) }, { displayTitle: "reference-data plan world" }),
      newerPlanRunCount: 0,
      backupRunId: "900",
      backupFacts: runFacts("backup", 900, { created: minutesAgo(now, 90), updated: minutesAgo(now, 60) }),
      backupSummaryText: backupSummaryText("900", { world_player_cards: 4, managers: 2, player_card_analysis: 1, import_batches: 1 }),
      dryRunRunId: "202",
      dryRunFacts: runFacts("dry-run", 202, { created: minutesAgo(now, 50), updated: minutesAgo(now, 35) }, { displayTitle: "reference-data dry-run world" }),
      dryRun,
      applyCommitSha: COMMIT_SHA,
      approvedBy: "owner",
      now: now.toISOString(),
    };
  }, 120000);

  it("拒否条件は書き込み0(removed・managers用のrun・古いBackup・manual review未確認)", async () => {
    const now = new Date(base.now);
    const removedPages = recordedWorldPages(upstreamPlayers({ removeFourth: true }));
    const cases: Array<[string, Partial<WorldApplyInput>, string]> = [
      ["removedを含むupstream", { bundle: { ...base.bundle, pages: removedPages, bodiesSha256: base.bundle.bodiesSha256 } }, "removal_not_allowed"],
      ["managers用のplan run", { planFacts: { ...base.planFacts, displayTitle: "reference-data plan" } }, "plan_wrong_mode"],
      ["期限切れBackup", { backupFacts: runFacts("backup", 900, { created: minutesAgo(now, 25 * 60 + 5), updated: minutesAgo(now, 25 * 60) }) }, "backup_expired"],
      ["manual reviewの確認入力なし", { acknowledgedManualReview: "none" }, "manual_review_not_acknowledged"],
      ["stale plan", { boundPlanChecksum: "e".repeat(64) }, "stale_plan"],
    ];
    for (const [label, patch, problem] of cases) {
      const r = await asUpdater((c) => runWorldApply(c, { ...base, ...patch }));
      expect(r.status, label).toBe("not_applied");
      if (r.status === "not_applied") expect(r.problems, label).toContain(problem);
      expect(await counts(), label).toEqual({ world: 4, managers: 2, batches: 1 });
    }
  }, 120000);

  it("全binding成立で1回だけ適用: World 4→5・監査batch verified・managers不変。二重適用は拒否、managersの変化は検出", async () => {
    const r = await asUpdater((c) => runWorldApply(c, base));
    expect(r.status).toBe("applied_verified");
    if (r.status === "not_applied") return;
    expect(r).toMatchObject({ inserted: 1, updated: 2 });
    expect(r.postVerify).toMatchObject({ ok: true, problems: [] });
    expect(r.undo.restoreRows).toHaveLength(2);
    expect(await counts()).toEqual({ world: 5, managers: 2, batches: 2 });
    // appearanceは既存値のまま(#3のupstream appearanceは適用されない)。
    const ap = await admin.query(`select appearance from ${APPLY_SCHEMA}.world_player_cards where world_card_id = '900000000000003'`);
    expect(JSON.stringify(ap.rows[0].appearance)).not.toContain("71");

    const again = await asUpdater((c) => runWorldApply(c, base));
    expect(again.status).toBe("not_applied");
    expect(await counts()).toEqual({ world: 5, managers: 2, batches: 2 });

    const verifyOnce = () =>
      asUpdater(async (c) => {
        await c.query("begin read only");
        try {
          return await verifyWorldPostApply(c, r.expectation);
        } finally {
          await c.query("rollback");
        }
      });
    expect((await verifyOnce()).problems).toEqual([]);
    await admin.query(`update ${APPLY_SCHEMA}.managers set updated_at = now() + interval '1 minute'`);
    expect((await verifyOnce()).problems).toContain("managers_changed");
  }, 120000);
});
