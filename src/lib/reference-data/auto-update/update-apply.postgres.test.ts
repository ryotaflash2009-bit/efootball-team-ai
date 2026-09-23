import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildIsolatedReferenceSchemaDdl, REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { buildSourceSnapshot, buildStagingDataset } from "./source-snapshot";
import { normalizeWorldPlayerRecord, toWorldSourceRow } from "./source-world";
import { buildInsertRow, computeUpdateDiff } from "./update-diff";
import { buildUpdateCandidate } from "./update-candidate";
import { applyUndoPlan, applyUpdatePlans, productionWriteLockKey, type ApplyInput } from "./update-apply";
import { UPDATE_TABLE_CONTRACTS, computeUpdateRowChecksum, computeUpdateTableChecksum } from "./update-contract";
import type { ApplyPrerequisites } from "./update-policy";
import { UPDATER_ROLE_NAME } from "./updater-role";

/**
 * Phase H: apply executorを、実DDLの隔離schema + SQL草案どおりのreference_data_updater(SET ROLE)で
 * 使い捨てPostgreSQL上で検証する。通常のvitestからは除外。接続先はPHASE2_TEST_PG_*だけ。
 */

const SCHEMA = "reference_data_apply_test";
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql");
const FIX = path.join(__dirname, "__fixtures__", "source");
const read = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
const toTestSchema = (sql: string) => sql.replace(/\breference_data\b(?!_)/g, SCHEMA);
const FETCHED_AT = "2026-09-23T00:00:00.000Z";

const worldRows = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: unknown[] }).players
  .map((p) => toWorldSourceRow(normalizeWorldPlayerRecord(p), FETCHED_AT))
  .flatMap((r) => (r.ok ? [r.row] : []));

const config = buildTestOnlyPgConfigFromEnv(process.env);
let admin: Client;
let other: Client;
let connected = false;
let roleCreatedHere = false;

async function seed(): Promise<void> {
  await admin.query(`truncate ${SCHEMA}.world_player_cards, ${SCHEMA}.managers, ${SCHEMA}.import_batches`);
  // 現在行: fixtureの先頭2件(1件はteamが古い)。eFHUB列・ai_stylesに既存値を持たせる。
  const cur = [
    { ...buildInsertRow("world_player_cards", worldRows[0]), team: "Old FC", efhub_card_id: "777", ai_styles: ["Kept Style"], dataset_version: "v0", import_batch_id: null },
    { ...buildInsertRow("world_player_cards", worldRows[1]), dataset_version: "v0", import_batch_id: null },
  ];
  const cols = UPDATE_TABLE_CONTRACTS.world_player_cards.productionColumns.filter((c) => c !== "created_at" && c !== "updated_at");
  const jsonb = UPDATE_TABLE_CONTRACTS.world_player_cards.jsonbColumns;
  for (const r of cur) {
    await admin.query(
      `insert into ${SCHEMA}.world_player_cards (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
      cols.map((c) => (jsonb.includes(c) && r[c as keyof typeof r] != null ? JSON.stringify(r[c as keyof typeof r]) : (r[c as keyof typeof r] ?? null))),
    );
  }
}

async function readWorld(): Promise<Record<string, unknown>[]> {
  return (await admin.query(`select * from ${SCHEMA}.world_player_cards`)).rows;
}

async function plan() {
  const staging = buildStagingDataset(
    buildSourceSnapshot({
      table: "world_player_cards", scope: "full", fetchedAt: FETCHED_AT, attempts: [], rows: worldRows, rejected: [], expectedPageSize: worldRows.length,
      pages: [{ page: 1, recordCount: worldRows.length, contentHash: "h", bodyBytes: 1, totalCount: worldRows.length, totalPages: 1, hasNext: false }],
    }),
  );
  const current = await readWorld();
  const p = computeUpdateDiff({ table: "world_player_cards", currentRows: current, staging });
  const candidate = buildUpdateCandidate({
    plans: [p], stagings: [staging], currentRows: { world_player_cards: current },
    history: { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null }, now: "2026-09-23T04:00:00Z",
  });
  return { staging, plan: p, candidate };
}

function prerequisites(sourceChecksum: string): ApplyPrerequisites {
  return {
    sourceFetched: true, sourceChecksum, sourceChecksumAlreadyApplied: false, schemaValidated: true, diffGenerated: true, hardBlockCount: 0, manualReviewResolved: true,
    backup: { runId: "123", category: "pre-apply", conclusion: "success", restoreVerified: true, storageVerified: true, rowCounts: { world_player_cards: 1, managers: 1, player_card_analysis: 1, import_batches: 1 }, completedAt: "2026-09-23T00:00:00Z" },
    dryRun: { verified: true, startedAt: "2026-09-23T01:00:00Z", completedAt: "2026-09-23T02:00:00Z", shadowComparisonPassed: true },
    approval: { present: true, approvedAt: "2026-09-23T03:00:00Z", expiresAt: "2026-09-23T06:00:00Z", boundSourceChecksum: sourceChecksum, boundCommitSha: "a".repeat(40) },
    applyCommitSha: "a".repeat(40), candidateIsLatest: true, superseded: false, concurrencyLockAcquired: true, duplicateBatchExists: false,
    rollbackPlanPrepared: true, updaterRoleVerified: true, productionPreflightPassed: true, now: "2026-09-23T04:00:00Z",
  };
}

async function input(): Promise<ApplyInput> {
  const { plan: p, candidate, staging } = await plan();
  return { schema: SCHEMA, plans: [p], candidate, prerequisites: prerequisites(candidate.sourceChecksum), datasetVersion: "2026-09-23-auto", approvedBy: "owner", sourceRowCounts: { world_player_cards: staging.rowCount } };
}

async function asUpdater<T>(fn: () => Promise<T>): Promise<T> {
  await admin.query(`set role ${UPDATER_ROLE_NAME}`);
  try {
    return await fn();
  } finally {
    await admin.query("reset role");
  }
}

const batchCount = async () => Number((await admin.query(`select count(*)::int as n from ${SCHEMA}.import_batches`)).rows[0].n);

beforeAll(async () => {
  admin = new Client(config);
  await admin.connect();
  other = new Client(config);
  await other.connect();
  connected = true;
  const exists = await admin.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME]);
  if (exists.rows[0].e) throw new Error("role reference_data_updater already exists in the isolated DB; refusing to reuse it");
  await admin.query(`drop schema if exists ${SCHEMA} cascade`);
  await admin.query(
    buildIsolatedReferenceSchemaDdl(SCHEMA, {
      base: read(REPOSITORY_REFERENCE_SQL_FILES.base),
      detailExtension: read(REPOSITORY_REFERENCE_SQL_FILES.detailExtension),
      nameSortKeyExtension: read(REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension),
    }),
  );
  for (const t of ["world_player_cards", "managers", "import_batches"]) {
    await admin.query(`alter table ${SCHEMA}.${t} enable row level security`);
    await admin.query(`alter table ${SCHEMA}.${t} force row level security`);
  }
  await admin.query(toTestSchema(read("create-reference-data-updater-role.sql")));
  roleCreatedHere = true;
  await admin.query(toTestSchema(read("create-reference-data-updater-rls-policies.sql")));
});

beforeEach(seed);

afterAll(async () => {
  if (!connected) return;
  await admin.query("reset role").catch(() => undefined);
  if (roleCreatedHere) await admin.query(toTestSchema(read("rollback-reference-data-updater-role.sql"))).catch(() => undefined);
  const still = await admin.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME]);
  if (roleCreatedHere && still.rows[0].e) {
    await admin.query(`drop owned by ${UPDATER_ROLE_NAME}`);
    await admin.query(`drop role ${UPDATER_ROLE_NAME}`);
  }
  await admin.query(`drop schema if exists ${SCHEMA} cascade`);
  await other.end();
  await admin.end();
}, 30000);

describe("Phase H apply executor(使い捨てPostgreSQL・reference_data_updater)", () => {
  it("承認済み計画を1 transactionで適用し、after checksum一致・batch verified・保持列不変・再diff 0", async () => {
    const inp = await input();
    const r = await asUpdater(() => applyUpdatePlans(admin, inp));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.tables[0]).toMatchObject({ table: "world_player_cards", inserted: 1, updated: 1 });
    const rows = await readWorld();
    expect(computeUpdateTableChecksum("world_player_cards", rows)).toBe(inp.plans[0].report.afterChecksum);
    const kept = rows.find((x) => x.world_card_id === "900000000000001")!;
    expect(kept).toMatchObject({ team: "Example FC", efhub_card_id: "777", ai_styles: ["Kept Style"], dataset_version: "2026-09-23-auto", import_batch_id: r.tables[0].batchId });
    const batch = await admin.query(`select status, target_table, inserted_row_count, payload_hash from ${SCHEMA}.import_batches where batch_id = $1`, [r.tables[0].batchId]);
    expect(batch.rows[0]).toMatchObject({ status: "verified", target_table: "world_player_cards", inserted_row_count: 1, payload_hash: inp.plans[0].planChecksum });
    const again = await plan();
    expect(again.plan.inserts.length + again.plan.updates.length).toBe(0);
  });

  it("計画作成後に行が変わっていればstale_planで何も書かない", async () => {
    const inp = await input();
    await admin.query(`update ${SCHEMA}.world_player_cards set league = 'Changed Meanwhile' where world_card_id = '900000000000002'`);
    const before = await readWorld();
    const r = await asUpdater(() => applyUpdatePlans(admin, inp));
    expect(r).toMatchObject({ ok: false, code: "stale_plan" });
    expect(computeUpdateTableChecksum("world_player_cards", await readWorld())).toBe(computeUpdateTableChecksum("world_player_cards", before));
    expect(await batchCount()).toBe(0);
  });

  it("updater以外のrole・前提条件不足・lock競合では書き込まない", async () => {
    const inp = await input();
    expect(await applyUpdatePlans(admin, inp)).toMatchObject({ ok: false, code: "wrong_session_role" });
    const bad = await asUpdater(() => applyUpdatePlans(admin, { ...inp, prerequisites: { ...inp.prerequisites, dryRun: { ...inp.prerequisites.dryRun, verified: false } } }));
    expect(bad).toMatchObject({ ok: false, code: "prerequisites_failed", failures: ["dry_run_not_verified"] });
    await other.query("select pg_advisory_lock($1::bigint)", [productionWriteLockKey()]);
    try {
      expect(await asUpdater(() => applyUpdatePlans(admin, inp))).toMatchObject({ ok: false, code: "lock_not_acquired" });
    } finally {
      await other.query("select pg_advisory_unlock($1::bigint)", [productionWriteLockKey()]);
    }
    expect(await batchCount()).toBe(0);
  });

  it("removed候補を含む計画は適用しない(物理削除・tombstoneは自動化しない)", async () => {
    const inp = await input();
    const withRemoved = { ...inp.plans[0], removedCandidates: ["900000000000099"] };
    expect(await asUpdater(() => applyUpdatePlans(admin, { ...inp, plans: [withRemoved] }))).toMatchObject({ ok: false, code: "unsupported_changes" });
  });

  it("undo計画で更新前の値へ戻し、undo batchを追記する(元のbatchと追加行はそのまま)", async () => {
    const inp = await input();
    const beforeRow = (await readWorld()).find((x) => x.world_card_id === "900000000000001")!;
    const r = await asUpdater(() => applyUpdatePlans(admin, inp));
    if (!r.ok) throw new Error(r.code);
    const u = await asUpdater(() => applyUndoPlan(admin, SCHEMA, r.undo[0]));
    expect(u.ok, JSON.stringify(u)).toBe(true);
    if (!u.ok) return;
    expect(u.restored).toBe(1);
    expect(u.insertedIdentitiesRequiringManualRemoval).toEqual(["900000000000003"]);
    const restored = (await readWorld()).find((x) => x.world_card_id === "900000000000001")!;
    expect(computeUpdateRowChecksum("world_player_cards", restored)).toBe(computeUpdateRowChecksum("world_player_cards", beforeRow));
    expect(restored.team).toBe("Old FC");
    const batches = await admin.query(`select batch_id, status, source, notes from ${SCHEMA}.import_batches order by created_at, source`);
    expect(batches.rows.map((b) => b.status)).toEqual(["verified", "verified"]);
    expect(batches.rows.find((b) => b.batch_id === r.tables[0].batchId)?.status).toBe("verified");
    expect(batches.rows.find((b) => b.batch_id === u.undoBatchId)).toMatchObject({ source: "undo", notes: `undo of ${r.tables[0].batchId}` });
  });
});
