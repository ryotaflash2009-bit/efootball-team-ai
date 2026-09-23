import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildIsolatedReferenceSchemaDdl, REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { checkStage2Metadata, parseStage2Metadata } from "./production-metadata-contract";
import { UPDATER_ROLE_NAME } from "./updater-role";
import { runUpdaterPreflight } from "./production-apply-preflight";
import { runPreflightWithConfig } from "./production-apply-cli";
import { buildAlterRolePasswordSql, buildScramSha256Verifier } from "../../../../scripts/lib/scram-verifier.mjs";

/**
 * Stage 2: 本人がProductionで行う手順(metadata確認 → updater role・policy作成 → SCRAM verifierでpassword設定
 * → metadata再確認)を、Production相当の構成(実DDL・RLS FORCE・Backup reader role/policy)を持つ
 * 使い捨てPostgreSQLで、リポジトリ内のSQLファイルそのままに再現する(schema名だけ隔離schemaへ置換)。
 * roleはcluster全体の名前のため、開始時に既存なら中止し、終了時にrollback SQLで削除する。
 */

const SCHEMA = "reference_data_stage2_test";
const BACKUP_ROLE = "reference_data_backup_reader";
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql");
const read = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
const toTestSchema = (sql: string) => sql.replace(/\breference_data\b(?!_)/g, SCHEMA);
const TEST_PASSWORD = "Stage2-Disposable-Test-Only-Password-0001";

const config = buildTestOnlyPgConfigFromEnv(process.env);
let admin: Client;
let connected = false;
const created = { backup: false, updater: false, anon: false, authenticated: false, authSchema: false, userTable: false };
const USER_TABLE = "public.my_team_snapshots";

/** updaterとしてloginし、`begin read only`の中でpreflightを実行してrollbackする。 */
async function preflightAsUpdater() {
  const as = new Client({ ...config, user: UPDATER_ROLE_NAME, password: TEST_PASSWORD });
  await as.connect();
  try {
    await as.query("begin read only");
    const r = await runUpdaterPreflight(as, SCHEMA);
    await as.query("rollback");
    return r;
  } finally {
    await as.end();
  }
}

async function metadata(phase: "pre" | "post") {
  const r = await admin.query(toTestSchema(read("stage2-production-metadata-check.sql")));
  const json = JSON.stringify({ stage2_metadata: r.rows[0].stage2_metadata });
  // Production(reference_data)のtable名で照合するため、隔離schema名の置換は結果に影響しない。
  return checkStage2Metadata(parseStage2Metadata(json), phase, { schema: SCHEMA });
}

beforeAll(async () => {
  admin = new Client(config);
  await admin.connect();
  connected = true;
  for (const role of [BACKUP_ROLE, UPDATER_ROLE_NAME]) {
    const e = await admin.query("select to_regrole($1) is not null as e", [role]);
    if (e.rows[0].e) throw new Error(`role ${role} already exists in the isolated DB; refusing to reuse it`);
  }
  await admin.query(`drop schema if exists ${SCHEMA} cascade`);
  await admin.query(
    buildIsolatedReferenceSchemaDdl(SCHEMA, {
      base: read(REPOSITORY_REFERENCE_SQL_FILES.base),
      detailExtension: read(REPOSITORY_REFERENCE_SQL_FILES.detailExtension),
      nameSortKeyExtension: read(REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension),
      analysisNameExtension: read(REPOSITORY_REFERENCE_SQL_FILES.analysisNameExtension),
    }),
  );
  for (const t of ["world_player_cards", "managers", "player_card_analysis", "import_batches"]) {
    await admin.query(`alter table ${SCHEMA}.${t} enable row level security`);
    await admin.query(`alter table ${SCHEMA}.${t} force row level security`);
  }
  // Productionと同じ公開SELECT policy(anon/authenticated)を、リポジトリ内DDLの文そのままで作る。
  for (const role of ["anon", "authenticated"] as const) {
    const e = await admin.query("select to_regrole($1) is not null as e", [role]);
    if (!e.rows[0].e) {
      await admin.query(`create role ${role} nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit`);
      created[role] = true;
    }
  }
  const publicPolicies = read(REPOSITORY_REFERENCE_SQL_FILES.base).match(/create policy \w+_select_all[\s\S]*?;/g) ?? [];
  expect(publicPolicies.length).toBe(3);
  for (const p of publicPolicies) await admin.query(toTestSchema(p));
  await admin.query(toTestSchema(read("create-reference-data-backup-role.sql")));
  created.backup = true;
  await admin.query(toTestSchema(read("create-reference-data-backup-reader-rls-policies.sql")));
  // Supabase Productionと同じく、利用者・認証データ(auth.users・public.my_team_snapshots)が存在する状態を作る。
  // 以前の使い捨てDBにはauth schemaが無く、名前解決がnullで通っていたためRun #2の失敗を再現できなかった。
  // (無い場合だけ作り、終了時に自分で作ったものだけ削除する。行は入れない)
  const authExists = await admin.query("select exists (select 1 from pg_catalog.pg_namespace where nspname = 'auth') as e");
  if (!authExists.rows[0].e) {
    await admin.query("create schema auth");
    await admin.query("create table auth.users (id uuid primary key, email text)");
    created.authSchema = true;
  }
  const userTableExists = await admin.query("select to_regclass($1) is not null as e", [USER_TABLE]);
  if (!userTableExists.rows[0].e) {
    await admin.query(`create table ${USER_TABLE} (id uuid primary key, user_id uuid not null, payload jsonb)`);
    await admin.query(`alter table ${USER_TABLE} enable row level security`);
    created.userTable = true;
  }
});

afterAll(async () => {
  if (!connected) return;
  if (created.updater) await admin.query(toTestSchema(read("rollback-reference-data-updater-role.sql"))).catch(() => undefined);
  await admin.query(`drop schema if exists ${SCHEMA} cascade`);
  if (created.userTable) await admin.query(`drop table if exists ${USER_TABLE}`);
  if (created.authSchema) await admin.query("drop schema if exists auth cascade");
  for (const role of [UPDATER_ROLE_NAME, BACKUP_ROLE, "anon", "authenticated"] as const) {
    const e = await admin.query("select to_regrole($1) is not null as e", [role]);
    const mine = role === BACKUP_ROLE ? created.backup : role === UPDATER_ROLE_NAME ? created.updater : created[role];
    if (e.rows[0].e && mine) {
      await admin.query(`drop owned by ${role}`);
      await admin.query(`drop role ${role}`);
    }
  }
  await admin.end();
}, 30000);

describe("Stage 2 Production setup手順の再現(使い捨てPostgreSQL)", () => {
  it("pre: 作成前のmetadataは契約どおり(updater無し・4 tableの列/RLS/owner・Backup reader policy 4件)", async () => {
    const r = await metadata("pre");
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect((await metadata("post")).problems).toContain("updater_role_missing");
  });

  it("post: role・policy作成後のmetadataは契約どおり(列単位grant・policy 9件・利用者データへの権限なし)", async () => {
    await admin.query(toTestSchema(read("create-reference-data-updater-role.sql")));
    created.updater = true;
    await admin.query(toTestSchema(read("create-reference-data-updater-rls-policies.sql")));
    const r = await metadata("post");
    expect(r.problems).toEqual([]);
    expect((await metadata("pre")).problems).toEqual(expect.arrayContaining(["updater_role_already_exists", "updater_policies_already_exist"]));
  });

  it("SCRAM verifierで設定したpasswordでupdaterとしてlogin(平文passwordはSQLに現れない)・誤passwordは拒否", async () => {
    const verifier = buildScramSha256Verifier(TEST_PASSWORD);
    const sql = buildAlterRolePasswordSql(UPDATER_ROLE_NAME, verifier);
    expect(sql).not.toContain(TEST_PASSWORD);
    await admin.query(sql);
    const as = new Client({ ...config, user: UPDATER_ROLE_NAME, password: TEST_PASSWORD });
    await as.connect();
    try {
      const r = await as.query("select current_user::text as u, current_setting('statement_timeout') as st");
      expect(r.rows[0]).toEqual({ u: UPDATER_ROLE_NAME, st: "2min" });
    } finally {
      await as.end();
    }
    const wrong = new Client({ ...config, user: UPDATER_ROLE_NAME, password: `${TEST_PASSWORD}x` });
    await expect(wrong.connect()).rejects.toThrow(/password authentication failed/);
    await wrong.end().catch(() => undefined);
  });

  it("preflight(read-only): updaterとしての接続は契約どおり、admin接続はwrong_role", async () => {
    const as = new Client({ ...config, user: UPDATER_ROLE_NAME, password: TEST_PASSWORD });
    await as.connect();
    try {
      await as.query("begin read only");
      const r = await runUpdaterPreflight(as, SCHEMA);
      await as.query("rollback");
      expect(r.problems).toEqual([]);
      expect(r.ok).toBe(true);
    } finally {
      await as.end();
    }
    await admin.query("begin read only");
    const wrong = await runUpdaterPreflight(admin, SCHEMA);
    await admin.query("rollback");
    expect(wrong.problems).toContain("wrong_role");
  });

  it("Run #2の原因の再現: auth schemaのUSAGEが無いupdaterでは、名前解決(to_regclass)が42501で失敗する", async () => {
    const as = new Client({ ...config, user: UPDATER_ROLE_NAME, password: TEST_PASSWORD });
    await as.connect();
    try {
      await expect(as.query("select to_regclass('auth.users')")).rejects.toMatchObject({ code: "42501" });
      // 新方式(catalog+OID指定)は同じ状態で成功し、権限なしと判定する。
      const r = await as.query(
        "select pg_catalog.has_schema_privilege(current_user, n.oid, 'USAGE') as usage from pg_catalog.pg_namespace n where n.nspname = 'auth'",
      );
      expect(r.rows).toEqual([{ usage: false }]);
    } finally {
      await as.end();
    }
  });

  it("auth USAGEなし・auth.users権限なし・利用者data table権限なしの正常状態でpreflightが成功する", async () => {
    const r = await preflightAsUpdater();
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.facts).toMatchObject({ sensitiveSchemaUsageCount: 0, sensitiveTableAccessCount: 0 });
  });

  it("auth USAGE・auth.users SELECT・利用者data SELECT(table/列)のいずれかがあればfail", async () => {
    const cases: Array<[string, string, string]> = [
      [`grant usage on schema auth to ${UPDATER_ROLE_NAME}`, `revoke usage on schema auth from ${UPDATER_ROLE_NAME}`, "sensitive_schema_usage:auth"],
      [`grant select on auth.users to ${UPDATER_ROLE_NAME}`, `revoke select on auth.users from ${UPDATER_ROLE_NAME}`, "sensitive_access:auth.users"],
      [`grant select (email) on auth.users to ${UPDATER_ROLE_NAME}`, `revoke select (email) on auth.users from ${UPDATER_ROLE_NAME}`, "sensitive_access:auth.users"],
      [`grant select on ${USER_TABLE} to ${UPDATER_ROLE_NAME}`, `revoke select on ${USER_TABLE} from ${UPDATER_ROLE_NAME}`, `sensitive_access:${USER_TABLE}`],
      [`grant select (payload) on ${USER_TABLE} to ${UPDATER_ROLE_NAME}`, `revoke select (payload) on ${USER_TABLE} from ${UPDATER_ROLE_NAME}`, `sensitive_access:${USER_TABLE}`],
      [`grant select on ${USER_TABLE} to public`, `revoke select on ${USER_TABLE} from public`, `sensitive_access:${USER_TABLE}`],
      [`grant select on ${SCHEMA}.player_card_analysis to ${UPDATER_ROLE_NAME}`, `revoke select on ${SCHEMA}.player_card_analysis from ${UPDATER_ROLE_NAME}`, `sensitive_access:${SCHEMA}.player_card_analysis`],
    ];
    for (const [grant, revoke, problem] of cases) {
      await admin.query(grant);
      try {
        const r = await preflightAsUpdater();
        expect(r.ok, grant).toBe(false);
        expect(r.problems, grant).toContain(problem);
      } finally {
        await admin.query(revoke);
      }
    }
    expect((await preflightAsUpdater()).problems).toEqual([]);
  });

  it("owner・BYPASSRLS・SUPERUSER・DELETE・TRUNCATEのいずれかがあればfail", async () => {
    const owner = config.user;
    const cases: Array<[string, string, string]> = [
      // updaterのgrantがあるtableでownerを往復させるとACLが統合されて元に戻らないため、grantの無いtableで確かめる
      // (updater tableのowner検出は単体テストで確認する)。
      [`alter table ${SCHEMA}.player_card_analysis owner to ${UPDATER_ROLE_NAME}`, `alter table ${SCHEMA}.player_card_analysis owner to ${owner}`, "role_owns_table:player_card_analysis"],
      [`alter role ${UPDATER_ROLE_NAME} bypassrls`, `alter role ${UPDATER_ROLE_NAME} nobypassrls`, "role_bypasses_rls"],
      [`alter role ${UPDATER_ROLE_NAME} superuser`, `alter role ${UPDATER_ROLE_NAME} nosuperuser`, "role_is_superuser"],
      [`grant delete on ${SCHEMA}.managers to ${UPDATER_ROLE_NAME}`, `revoke delete on ${SCHEMA}.managers from ${UPDATER_ROLE_NAME}`, "table_grants"],
      [`grant truncate on ${SCHEMA}.world_player_cards to ${UPDATER_ROLE_NAME}`, `revoke truncate on ${SCHEMA}.world_player_cards from ${UPDATER_ROLE_NAME}`, "table_grants"],
    ];
    for (const [change, restore, problem] of cases) {
      await admin.query(change);
      try {
        const r = await preflightAsUpdater();
        expect(r.ok, change).toBe(false);
        expect(r.problems, change).toContain(problem);
      } finally {
        await admin.query(restore);
      }
    }
    expect((await preflightAsUpdater()).problems).toEqual([]);
  });

  it("CLI接続経路: 正常は成功、誤role・誤password・接続失敗・TLS失敗はfail(本文・URL・passwordを出さない)", async () => {
    const ok = await runPreflightWithConfig({ ...config, user: UPDATER_ROLE_NAME, password: TEST_PASSWORD }, SCHEMA);
    expect(ok).toMatchObject({ ok: true, phase: "preflight", reasons: [] });

    const wrongRole = await runPreflightWithConfig(config, SCHEMA);
    expect(wrongRole.ok).toBe(false);
    expect(wrongRole.reasons).toContain("wrong_role");

    const wrongPassword = await runPreflightWithConfig({ ...config, user: UPDATER_ROLE_NAME, password: `${TEST_PASSWORD}x` }, SCHEMA);
    expect(wrongPassword).toMatchObject({ ok: false, phase: "connect", reasons: ["connect_failed:sqlstate_28P01"] });

    const refused = await runPreflightWithConfig({ ...config, port: 1, user: UPDATER_ROLE_NAME, password: TEST_PASSWORD }, SCHEMA);
    expect(refused.ok).toBe(false);
    expect(refused.phase).toBe("connect");
    expect(refused.reasons[0]).toMatch(/^connect_failed:(net_[A-Z0-9_]+|unknown)$/);

    // 使い捨てDBはTLS非対応のため、CA固定のTLS接続は確立できずfailになる(平文へfallbackしない)。
    const tls = await runPreflightWithConfig({ ...config, user: UPDATER_ROLE_NAME, password: TEST_PASSWORD, ssl: { rejectUnauthorized: true, ca: "not-a-real-ca" } }, SCHEMA);
    expect(tls.ok).toBe(false);
    expect(tls.phase).toBe("connect");
    expect(tls.reasons[0]).toMatch(/^connect_failed:(net_[A-Z0-9_]+|unknown)$/);

    for (const s of [ok, wrongRole, wrongPassword, refused, tls]) {
      const text = JSON.stringify(s);
      expect(text).not.toContain(TEST_PASSWORD);
      expect(text).not.toContain(config.password);
      expect(text).not.toMatch(/postgres(ql)?:\/\/|password authentication|permission denied|does not support SSL/i);
    }
  });

  it("誤った設定(policy欠落・DELETE付与)をpost確認で検出する", async () => {
    await admin.query(`drop policy managers_updater_update on ${SCHEMA}.managers`);
    await admin.query(`grant delete on ${SCHEMA}.managers to ${UPDATER_ROLE_NAME}`);
    const r = await metadata("post");
    expect(r.problems).toEqual(expect.arrayContaining(["updater_policies", "updater_table_grants"]));
    await admin.query(`revoke delete on ${SCHEMA}.managers from ${UPDATER_ROLE_NAME}`);
    await admin.query(toTestSchema("create policy managers_updater_update on reference_data.managers as permissive for update to reference_data_updater using (true) with check (true)"));
    expect((await metadata("post")).problems).toEqual([]);
  });
});
