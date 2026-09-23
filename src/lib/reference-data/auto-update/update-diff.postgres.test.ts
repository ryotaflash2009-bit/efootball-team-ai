import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { runGuardedCleanup } from "./postgres-test-lifecycle";
import { buildSourceSnapshot, buildStagingDataset, type SnapshotTable } from "./source-snapshot";
import { normalizeWorldPlayerRecord, toWorldSourceRow, type WorldSourceRow } from "./source-world";
import { toManagerSourceRow, type ManagerSourceRow } from "./source-managers";
import { computeUpdateDiff, type UpdateDiffPlan } from "./update-diff";
import { UPDATE_TABLE_CONTRACTS, computeUpdateRowChecksum, computeUpdateTableChecksum } from "./update-contract";

/**
 * Phase C: diff計画の行が、リポジトリ内の実DDL(create-reference-data-schema.sql・
 * extend-reference-data-detail-schema.sql・extend-name-sort-key-schema.sql)の制約を満たし、
 * PostgreSQLへ書いて読み戻してもrow checksumが変わらないこと(jsonb key順・text[]・timestamptz・
 * integerの往復)、適用後に再diffすると変更0になることを、使い捨てPostgreSQLで検証する。
 *
 * 通常のvitestからは除外(`*.postgres.test.ts`)。接続先はPHASE2_TEST_PG_*(localhost・
 * テスト専用DB名だけ)。実Supabase・Productionへは接続しない。対象は隔離schema
 * `reference_data_diff_test`だけで、終了時にそのschemaだけを削除する。
 */

const SCHEMA = "reference_data_diff_test";
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql");
const FIX = path.join(__dirname, "__fixtures__", "source");
const FETCHED_AT = "2026-09-23T00:00:00.000Z";
const TABLES = ["import_batches", "world_player_cards", "managers"] as const;

/** 実DDLファイルから、対象3 tableのcreate table文と、対象tableへのalter table文だけを取り出す。 */
function buildDdlFromRepositorySql(): string {
  const base = readFileSync(path.join(SQL_DIR, "create-reference-data-schema.sql"), "utf8");
  const ext = ["extend-reference-data-detail-schema.sql", "extend-name-sort-key-schema.sql"].map((f) => readFileSync(path.join(SQL_DIR, f), "utf8")).join("\n");
  const statements: string[] = [`create schema ${SCHEMA};`];
  for (const t of TABLES) {
    const m = base.match(new RegExp(`create table if not exists reference_data\\.${t} \\([\\s\\S]*?\\n\\);`));
    if (!m) throw new Error(`DDLに${t}が見つからない`);
    statements.push(m[0]);
  }
  for (const m of ext.matchAll(/alter table reference_data\.(world_player_cards|managers)\b[\s\S]*?;/g)) statements.push(m[0]);
  return statements.join("\n").replace(/reference_data\./g, `${SCHEMA}.`);
}

const config = buildTestOnlyPgConfigFromEnv(process.env);
let client: Client;
let connected = false;
let schemaReady = false;

beforeAll(async () => {
  client = new Client(config);
  await client.connect();
  connected = true;
  await client.query(`drop schema if exists ${SCHEMA} cascade`);
  await client.query(buildDdlFromRepositorySql());
  schemaReady = true;
});

afterAll(async () => {
  if (!connected) return;
  await runGuardedCleanup([{ ready: schemaReady, run: () => client.query(`drop schema if exists ${SCHEMA} cascade`).then(() => undefined) }]);
  await client.end();
});

function stagingFor(table: SnapshotTable, rows: readonly (WorldSourceRow | ManagerSourceRow)[]) {
  const n = rows.length;
  const world = table === "world_player_cards";
  return buildStagingDataset(
    buildSourceSnapshot({
      table, scope: "full", fetchedAt: FETCHED_AT, attempts: [], rows, rejected: [], expectedPageSize: n,
      pages: [{ page: 1, recordCount: n, contentHash: "h", bodyBytes: 1, totalCount: world ? n : null, totalPages: world ? 1 : null, hasNext: false }],
    }),
  );
}

async function readTable(table: SnapshotTable): Promise<Record<string, unknown>[]> {
  const r = await client.query(`select * from ${SCHEMA}.${table}`);
  return r.rows;
}

/** 計画のinsert/updateを、実DDLのtableへparameterized SQLで書く(隔離schemaだけ)。 */
async function applyPlan(plan: UpdateDiffPlan): Promise<void> {
  const contract = UPDATE_TABLE_CONTRACTS[plan.table];
  const writable = contract.productionColumns.filter((c) => !["created_at", "updated_at"].includes(c));
  const value = (row: Readonly<Record<string, unknown>>, col: string) => {
    if (col === "dataset_version") return "phase-c-test";
    if (col === "import_batch_id") return null;
    const v = row[col];
    return contract.jsonbColumns.includes(col) && v != null ? JSON.stringify(v) : v;
  };
  for (const r of plan.inserts) {
    const params = writable.map((c) => value(r.row, c));
    await client.query(`insert into ${SCHEMA}.${plan.table} (${writable.join(",")}) values (${writable.map((_, i) => `$${i + 1}`).join(",")})`, params);
  }
  for (const u of plan.updates) {
    const cols = writable.filter((c) => c !== contract.primaryKeyColumn);
    const params = [...cols.map((c) => value(u.row, c)), u.row[contract.primaryKeyColumn]];
    await client.query(`update ${SCHEMA}.${plan.table} set ${cols.map((c, i) => `${c} = $${i + 1}`).join(",")} where ${contract.primaryKeyColumn} = $${cols.length + 1}`, params);
  }
}

const worldRows = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: unknown[] }).players
  .map((p) => toWorldSourceRow(normalizeWorldPlayerRecord(p), FETCHED_AT))
  .flatMap((r) => (r.ok ? [r.row] : []));
const managerRows = (JSON.parse(readFileSync(path.join(FIX, "managers-synthetic.json"), "utf8")) as unknown[])
  .map((m) => toManagerSourceRow(m, FETCHED_AT))
  .flatMap((r) => (r.ok ? [r.row] : []));

describe("Phase C diff × 実DDL(使い捨てPostgreSQL)", () => {
  for (const [table, rows] of [["world_player_cards", worldRows], ["managers", managerRows]] as const) {
    it(`${table}: insert計画は実DDLの制約を満たし、読み戻したrow checksumが計画と一致する`, async () => {
      const plan = computeUpdateDiff({ table, currentRows: await readTable(table), staging: stagingFor(table, rows) });
      expect(plan.blockingReasons).toEqual([]);
      expect(plan.inserts.length).toBe(rows.length);
      await applyPlan(plan);
      const back = await readTable(table);
      expect(Object.keys(back[0]).sort()).toEqual([...UPDATE_TABLE_CONTRACTS[table].productionColumns].sort());
      const byId = new Map(plan.inserts.map((r) => [String(r.row[UPDATE_TABLE_CONTRACTS[table].primaryKeyColumn]), r.rowChecksum]));
      for (const row of back) expect(computeUpdateRowChecksum(table, row)).toBe(byId.get(String(row[UPDATE_TABLE_CONTRACTS[table].primaryKeyColumn])));
      expect(computeUpdateTableChecksum(table, back)).toBe(plan.report.afterChecksum);
    });

    it(`${table}: 適用後の再diffは変更0、sourceの変化はupdateとして適用でき再diffで0になる`, async () => {
      const again = computeUpdateDiff({ table, currentRows: await readTable(table), staging: stagingFor(table, rows) });
      expect(again.report.unchangedCount).toBe(rows.length);
      expect(again.inserts.length + again.updates.length).toBe(0);

      const changed = rows.map((r, i) => (i === 0 ? { ...r, name_en: `${String(r.name_en)} Updated`, name_sort_key: `${String(r.name_sort_key)} updated` } : r));
      const upd = computeUpdateDiff({ table, currentRows: await readTable(table), staging: stagingFor(table, changed) });
      expect(upd.updates.map((u) => u.changedFields)).toEqual([["name_en", "name_sort_key"]]);
      await applyPlan(upd);
      const back = await readTable(table);
      expect(computeUpdateTableChecksum(table, back)).toBe(upd.report.afterChecksum);
      const final = computeUpdateDiff({ table, currentRows: back, staging: stagingFor(table, changed) });
      expect(final.inserts.length + final.updates.length).toBe(0);
    });
  }
});
