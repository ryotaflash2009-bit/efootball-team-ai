import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildIsolatedReferenceSchemaDdl, REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { UPDATE_TABLE_CONTRACTS } from "./update-contract";
import { buildManagersCandidate, readManagersProductionState, type ManagersProductionState } from "./stage4-managers";
import { readWorldProductionState } from "./stage4-world";
import { PLAN_READER_ROLES, parseStateSnapshot, runPlanReadPreflight, serializeStateSnapshot } from "./stage4-state-snapshot";
import { buildAlterRolePasswordSql, buildScramSha256Verifier } from "../../../../scripts/lib/scram-verifier.mjs";
import { currentManagerRows, managersResponse, seedImportBatch, worldRow } from "./__fixtures__/stage4-fixtures";

/**
 * 承認1回化: Plan の読み取り専用 role(リポジトリの create-reference-data-plan-reader-role.sql)を使い捨て
 * PostgreSQL の隔離 schema に作り、preflight が「読める・書けない」を正しく判定すること、読み取りが通ること、
 * 状態スナップショットを JSON 経由で復元しても同じ候補(checksum)になることを確かめる。
 * role は cluster 全体の名前のため、開始時に既存なら中止し、終了時に削除する。
 */

const SCHEMA = "reference_data_plan_read_test";
const ROLE = "reference_data_plan_reader";
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SQL_DIR = path.join(ROOT, "docs", "production-readiness", "sql");
const readSql = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
const toSchema = (sql: string, schema: string) => sql.replace(/\breference_data\b(?!_)/g, schema);
const PASSWORD = "PlanReader-Disposable-Test-Only-Password-0001";
const FETCHED = "2026-09-24T09:00:00.000Z";

const config = buildTestOnlyPgConfigFromEnv(process.env);
let admin: Client;
let connected = false;
let roleCreated = false;

async function insertRows(table: keyof typeof UPDATE_TABLE_CONTRACTS, rows: readonly Record<string, unknown>[]): Promise<void> {
  const contract = UPDATE_TABLE_CONTRACTS[table];
  for (const row of rows) {
    const cols = contract.productionColumns.filter((c) => c in row && c !== "created_at" && c !== "updated_at");
    const values = cols.map((c) => (row[c] != null && contract.jsonbColumns.includes(c) ? JSON.stringify(row[c]) : row[c] ?? null));
    await admin.query(`insert into ${SCHEMA}.${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`, values);
  }
}

async function asReader<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ ...config, user: ROLE, password: PASSWORD });
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
  if ((await admin.query("select to_regrole($1) is not null as e", [ROLE])).rows[0].e === true) throw new Error(`${ROLE} already exists in the isolated DB; refusing to reuse it`);
  await admin.query(`drop schema if exists ${SCHEMA} cascade`);
  await admin.query(
    buildIsolatedReferenceSchemaDdl(SCHEMA, {
      base: readSql(REPOSITORY_REFERENCE_SQL_FILES.base),
      detailExtension: readSql(REPOSITORY_REFERENCE_SQL_FILES.detailExtension),
      nameSortKeyExtension: readSql(REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension),
      analysisNameExtension: readSql(REPOSITORY_REFERENCE_SQL_FILES.analysisNameExtension),
    }),
  );
  for (const t of ["world_player_cards", "managers", "import_batches", "player_card_analysis"]) {
    await admin.query(`alter table ${SCHEMA}.${t} enable row level security`);
    await admin.query(`alter table ${SCHEMA}.${t} force row level security`);
  }
  await admin.query(toSchema(readSql("create-reference-data-plan-reader-role.sql"), SCHEMA));
  roleCreated = true;
  await admin.query(buildAlterRolePasswordSql(ROLE, buildScramSha256Verifier(PASSWORD)));
  await insertRows("import_batches", [seedImportBatch()]);
  await insertRows("managers", currentManagerRows());
  await insertRows("world_player_cards", [worldRow()]);
}, 60000);

afterAll(async () => {
  if (!connected) return;
  await admin.query(`drop schema if exists ${SCHEMA} cascade`);
  if (roleCreated && (await admin.query("select to_regrole($1) is not null as e", [ROLE])).rows[0].e === true) {
    await admin.query(`drop owned by ${ROLE}`);
    await admin.query(`drop role ${ROLE}`);
  }
  await admin.end();
}, 30000);

describe("Planの読み取り専用role(使い捨てPostgreSQL)", () => {
  it("読み取り専用transactionでpreflightに合格し、World・managers・import_batchesを読める(書き込み権限0)", async () => {
    await asReader(async (c) => {
      await c.query("begin read only");
      const pre = await runPlanReadPreflight(c, SCHEMA);
      expect(pre.problems).toEqual([]);
      expect(pre.facts).toEqual({ role: ROLE, readOnlyTransaction: true });
      const m = await readManagersProductionState(c, SCHEMA, PLAN_READER_ROLES);
      expect(m.managers.length).toBe(currentManagerRows().length);
      const w = await readWorldProductionState(c, SCHEMA, PLAN_READER_ROLES);
      expect(w.counts.world_player_cards).toBe(1);
      await expect(c.query(`insert into ${SCHEMA}.import_batches (source) values ('x')`)).rejects.toThrow();
      await c.query("rollback");
    });
  });

  it("書き込み権限・読み取り専用でないtransaction・許可外roleはpreflightで停止する", async () => {
    await admin.query(`grant insert on ${SCHEMA}.managers to ${ROLE}`);
    try {
      await asReader(async (c) => {
        await c.query("begin read only");
        expect((await runPlanReadPreflight(c, SCHEMA)).problems).toContain("plan_write_privilege:managers:insert");
        await c.query("rollback");
      });
    } finally {
      await admin.query(`revoke insert on ${SCHEMA}.managers from ${ROLE}`);
    }
    await asReader(async (c) => {
      expect((await runPlanReadPreflight(c, SCHEMA)).problems).toContain("plan_not_read_only_transaction");
    });
    await admin.query("begin read only");
    try {
      const p = (await runPlanReadPreflight(admin, SCHEMA)).problems;
      expect(p).toContain("plan_role_not_allowed");
    } finally {
      await admin.query("rollback");
    }
    await expect(asReader(async (c) => {
      await c.query("begin read only");
      try {
        return await readManagersProductionState(c, SCHEMA);
      } finally {
        await c.query("rollback");
      }
    })).rejects.toThrow("wrong_role");
  });

  it("Productionから読んだ状態をJSONスナップショットにしても同じ候補(plan・source checksum)になる", async () => {
    const state = await asReader(async (c) => {
      await c.query("begin read only");
      try {
        return await readManagersProductionState(c, SCHEMA, PLAN_READER_ROLES);
      } finally {
        await c.query("rollback");
      }
    });
    const now = "2026-09-24T10:00:00.000Z";
    const direct = await buildManagersCandidate(managersResponse(), FETCHED, state.managers, now);
    const snap = serializeStateSnapshot("managers", FETCHED, state);
    const replayed = await buildManagersCandidate(managersResponse(), FETCHED, parseStateSnapshot<ManagersProductionState>(snap.text, "managers", snap.sha256).managers, now);
    expect(replayed.plan.planChecksum).toBe(direct.plan.planChecksum);
    expect(replayed.candidate.sourceChecksum).toBe(direct.candidate.sourceChecksum);
    expect(replayed.plan.report.beforeChecksum).toBe(direct.plan.report.beforeChecksum);
  });
});
