import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildIsolatedReferenceSchemaDdl, REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { UPDATER_COLUMN_GRANTS, UPDATER_POLICY_NAMES, UPDATER_ROLE_NAME } from "./updater-role";

/**
 * reference_data_updaterのSQL草案(create role・RLS policy・verify・rollback)を、使い捨てPostgreSQLで
 * そのまま(schema名だけを隔離schemaへ置換して)実行し、DB権限として保持規則が強制されることを確かめる。
 * 通常のvitestからは除外(`*.postgres.test.ts`)。接続先はPHASE2_TEST_PG_*(localhost・テスト専用DB名だけ)。
 * roleはcluster全体の名前のため、開始時に既存なら中止し、終了時にrollback SQL(または後始末)で必ず削除する。
 */

const SCHEMA = "reference_data_updater_role_test";
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql");
const read = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
/** `reference_data`というschema名だけを置換する(`reference_data_updater`等のrole名は置換しない)。 */
const toTestSchema = (sql: string) => sql.replace(/\breference_data\b(?!_)/g, SCHEMA);

const config = buildTestOnlyPgConfigFromEnv(process.env);
let admin: Client;
let connected = false;
let roleCreatedHere = false;

async function asUpdater<T>(fn: () => Promise<T>): Promise<T> {
  await admin.query("begin");
  try {
    await admin.query(`set local role ${UPDATER_ROLE_NAME}`);
    const r = await fn();
    await admin.query("commit");
    return r;
  } catch (e) {
    await admin.query("rollback");
    throw e;
  }
}

async function expectDenied(sql: string, params: unknown[] = [], pattern = /permission denied/): Promise<void> {
  await expect(asUpdater(() => admin.query(sql, params))).rejects.toThrow(pattern);
}

beforeAll(async () => {
  admin = new Client(config);
  await admin.connect();
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
  await admin.query(`create table ${SCHEMA}.player_card_analysis (world_card_id text primary key)`);
  for (const t of ["world_player_cards", "managers", "import_batches", "player_card_analysis"]) {
    await admin.query(`alter table ${SCHEMA}.${t} enable row level security`);
    await admin.query(`alter table ${SCHEMA}.${t} force row level security`);
  }
  await admin.query(
    `insert into ${SCHEMA}.world_player_cards (world_card_id, name_en, ai_styles, efhub_card_id, source, fetched_at, dataset_version)
     values ('100', 'Seed Player', array['Seed Style'], '555', 'world', now(), 'v0')`,
  );
  await admin.query(
    `insert into ${SCHEMA}.managers (internal_manager_id, source, source_manager_id, name_en, name_ja, fetched_at, dataset_version)
     values (1, 'amine250', 'seed', 'Seed Manager', '既存名', now(), 'v0')`,
  );
  await admin.query(
    `insert into ${SCHEMA}.import_batches (batch_id, dataset_version, target_table, source, source_row_count, payload_hash, status)
     values ('11111111-1111-4111-8111-111111111111', 'v0', 'world_player_cards', 'world', 1, $1, 'verified'),
            ('22222222-2222-4222-8222-222222222222', 'v1', 'world_player_cards', 'world', 1, $1, 'pending')`,
    ["a".repeat(64)],
  );

  await admin.query(toTestSchema(read("create-reference-data-updater-role.sql")));
  roleCreatedHere = true;
  await admin.query(toTestSchema(read("create-reference-data-updater-rls-policies.sql")));
});

afterAll(async () => {
  if (!connected) return;
  await admin.query("rollback").catch(() => undefined);
  const still = await admin.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME]);
  if (roleCreatedHere && still.rows[0].e) {
    await admin.query(`drop owned by ${UPDATER_ROLE_NAME}`);
    await admin.query(`drop role ${UPDATER_ROLE_NAME}`);
  }
  await admin.query(`drop schema if exists ${SCHEMA} cascade`);
  await admin.end();
}, 30000);

describe("reference_data_updater(SQL草案を使い捨てPostgreSQLで実行)", () => {
  it("verify SQLの結果が契約と一致する(role属性・列単位grant・policy・RLS FORCE・session設定)", async () => {
    const results = (await admin.query(toTestSchema(read("verify-reference-data-updater-role.sql")))) as unknown as { rows: Record<string, unknown>[] }[];
    const [role, tableGrants, columnGrants, policies, rls, settings] = results.map((r) => r.rows);
    expect(role[0]).toMatchObject({ rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolinherit: false, rolconnlimit: 1 });
    expect(new Set(tableGrants.map((g) => g.privilege_type))).toEqual(new Set(["SELECT"]));
    expect(tableGrants.map((g) => g.table_name).sort()).toEqual(["import_batches", "managers", "world_player_cards"]);
    for (const [table, grants] of Object.entries(UPDATER_COLUMN_GRANTS)) {
      for (const p of ["insert", "update"] as const) {
        const actual = columnGrants.filter((g) => g.table_name === table && g.privilege_type === p.toUpperCase()).map((g) => g.column_name).sort();
        expect(actual, `${table} ${p}`).toEqual([...grants[p]].sort());
      }
    }
    expect(policies.map((p) => p.policyname).sort()).toEqual([...UPDATER_POLICY_NAMES].sort());
    expect(policies.some((p) => p.cmd === "DELETE" || p.cmd === "ALL")).toBe(false);
    expect(rls.every((r) => r.relrowsecurity === true && r.relforcerowsecurity === true)).toBe(true);
    expect(settings.map((s) => s.setting).sort()).toEqual(
      ["idle_in_transaction_session_timeout=60s", "lock_timeout=5s", `search_path=${SCHEMA}`, "statement_timeout=120s"].sort(),
    );
  });

  it("upstream列のINSERT/UPDATEはできるが、保持列・eFHUB列・identityはDB権限でUPDATEできない", async () => {
    await asUpdater(() =>
      admin.query(`insert into ${SCHEMA}.world_player_cards (world_card_id, name_en, source, fetched_at, dataset_version, ai_styles) values ('101', 'New Player', 'world', now(), 'v1', array['A'])`),
    );
    const upd = await asUpdater(() => admin.query(`update ${SCHEMA}.world_player_cards set name_en = 'Renamed', updated_at = now() where world_card_id = '100'`));
    expect(upd.rowCount).toBe(1);
    for (const col of ["ai_styles = array['X']", "appearance = null", "efhub_card_id = null", "efhub_conflicts = '[]'::jsonb", "world_card_id = '999'", "created_at = now()"]) {
      await expectDenied(`update ${SCHEMA}.world_player_cards set ${col} where world_card_id = '100'`);
    }
    await expectDenied(`insert into ${SCHEMA}.world_player_cards (world_card_id, name_en, source, fetched_at, dataset_version, efhub_card_id) values ('102', 'X', 'world', now(), 'v1', '1')`);
    const kept = await admin.query(`select name_en, ai_styles, efhub_card_id from ${SCHEMA}.world_player_cards where world_card_id = '100'`);
    expect(kept.rows[0]).toEqual({ name_en: "Renamed", ai_styles: ["Seed Style"], efhub_card_id: "555" });

    await asUpdater(() => admin.query(`update ${SCHEMA}.managers set possession_game = 80 where internal_manager_id = 1`));
    for (const col of ["name_ja = 'x'", "internal_manager_id = 2", "source_manager_id = 'x'", "formation = '4-3-3'"]) {
      await expectDenied(`update ${SCHEMA}.managers set ${col} where internal_manager_id = 1`);
    }
  });

  it("DELETE・TRUNCATEはできず、player_card_analysisへはアクセスできない", async () => {
    for (const t of ["world_player_cards", "managers", "import_batches"]) {
      await expectDenied(`delete from ${SCHEMA}.${t}`);
      await expectDenied(`truncate ${SCHEMA}.${t}`);
    }
    await expectDenied(`select * from ${SCHEMA}.player_card_analysis`);
    const count = await admin.query(`select count(*)::int as n from ${SCHEMA}.world_player_cards`);
    expect(count.rows[0].n).toBe(2);
  });

  it("import_batchesはpendingの追記と、pending行のstatus遷移だけ(既存の確定行は不変)", async () => {
    await asUpdater(() =>
      admin.query(
        `insert into ${SCHEMA}.import_batches (batch_id, dataset_version, target_table, source, source_row_count, payload_hash, status) values ('33333333-3333-4333-8333-333333333333', 'v2', 'managers', 'amine250', 1, $1, 'pending')`,
        ["b".repeat(64)],
      ),
    );
    await expectDenied(
      `insert into ${SCHEMA}.import_batches (batch_id, dataset_version, target_table, source, source_row_count, payload_hash, status) values ('44444444-4444-4444-8444-444444444444', 'v3', 'managers', 'amine250', 1, $1, 'verified')`,
      ["c".repeat(64)],
      /row-level security/,
    );
    const onVerified = await asUpdater(() => admin.query(`update ${SCHEMA}.import_batches set status = 'rolled_back', rolled_back_at = now() where batch_id = '11111111-1111-4111-8111-111111111111'`));
    expect(onVerified.rowCount).toBe(0);
    const onPending = await asUpdater(() => admin.query(`update ${SCHEMA}.import_batches set status = 'verified', verified_at = now() where batch_id = '22222222-2222-4222-8222-222222222222'`));
    expect(onPending.rowCount).toBe(1);
    await expectDenied(`update ${SCHEMA}.import_batches set payload_hash = $1 where status = 'pending'`, ["d".repeat(64)]);
  });

  it("rollback SQLでpolicy・権限・roleが消え、行データは変わらない", async () => {
    const before = await admin.query(`select count(*)::int as n from ${SCHEMA}.world_player_cards`);
    await admin.query(toTestSchema(read("rollback-reference-data-updater-role.sql")));
    const role = await admin.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME]);
    expect(role.rows[0].e).toBe(false);
    const policies = await admin.query(`select count(*)::int as n from pg_catalog.pg_policies where schemaname = $1`, [SCHEMA]);
    expect(policies.rows[0].n).toBe(0);
    const after = await admin.query(`select count(*)::int as n from ${SCHEMA}.world_player_cards`);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});
