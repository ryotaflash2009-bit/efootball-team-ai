import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createPostgresQueryClient, buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { buildProductionLikeSchemaDdlForIsolatedTesting, buildBackupIsolatedSchemaDdl, BACKUP_RESTORE_TEST_SCHEMA, PRODUCTION_REFERENCE_DATA_SCHEMA } from "./backup-schema";
import { runSourcePreflight, type ExpectedSourceIdentity } from "./backup-source-preflight";
import { runProductionBackup } from "./run-production-backup";
import { FakeR2Client } from "./backup-r2-client";
import { BACKUP_READER_POLICIES } from "./backup-reader-rls-policy-sql-audit";

/**
 * Backup reader専用RLS SELECT policyのapply/rollback SQL(実ファイルそのもの)を、
 * GitHub ActionsのPostgreSQL service container(使い捨て、実Production・実Supabaseとは
 * 無関係)に対して実行し、次の3状態を再現する:
 *   A: 現状相当(RLS有効+FORCE、anon/authenticated向けpolicyのみ、NOBYPASSRLSのBackup role)
 *      → Backup roleからは0行、preflight/Backupはblocked
 *   B: apply SQL実行後 → Backup roleだけが4テーブルを読める、preflight/Backup成功、
 *      anon/authenticatedの既存動作とimport_batchesの非公開は不変
 *   C: rollback SQL実行後 → 専用policyだけが消え、再び0行・blocked、role/grant不変
 * R2はFakeR2Client、暗号化はfake ageスクリプトで、実通信は一切行わない。
 *
 * 通常の`npx vitest run`には含まれない(`vitest.postgres.config.ts`でだけ実行される)。
 * このセッションのローカルWindows環境にはPostgreSQLが無く、ローカルでは実行していない
 * (CIのReference data PostgreSQL validationが初回の実行になる)。
 */

const SQL_DIR = resolve(__dirname, "../../../../docs/production-readiness/sql");
const APPLY_SQL = readFileSync(resolve(SQL_DIR, "create-reference-data-backup-reader-rls-policies.sql"), "utf8");
const ROLLBACK_SQL = readFileSync(resolve(SQL_DIR, "rollback-reference-data-backup-reader-rls-policies.sql"), "utf8");
const PRE_SQL = readFileSync(resolve(SQL_DIR, "verify-reference-data-backup-reader-rls-policies-pre-apply.sql"), "utf8");
const POST_SQL = readFileSync(resolve(SQL_DIR, "verify-reference-data-backup-reader-rls-policies-post-apply.sql"), "utf8");

const RECIPIENT = "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
const BACKUP_ROLE = "reference_data_backup_reader";
const TEST_ROLES = ["anon", "authenticated", BACKUP_ROLE] as const;
const TABLES = ["world_player_cards", "managers", "player_card_analysis", "import_batches"] as const;
const SCHEMA = PRODUCTION_REFERENCE_DATA_SCHEMA;
const SEED_ISO = "2020-01-01T00:00:00.000Z";

const config = buildTestOnlyPgConfigFromEnv(process.env);
const backupIdentity: ExpectedSourceIdentity = { database: config.database, currentUser: BACKUP_ROLE, sessionUser: config.user };

let admin: Client;
let backupReader: Client;
let anon: Client;
let connected = { admin: false, backupReader: false, anon: false };
const createdRoles: string[] = [];
let scratchDir: string;
let fakeAgePath: string;
let pgMajor = 16;

async function expectSqlFailure(sql: string, pattern: RegExp): Promise<void> {
  let message = "";
  try {
    await admin.query(sql);
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  await admin.query("rollback").catch(() => undefined);
  expect(message, "SQL should have failed").toMatch(pattern);
}

async function countAs(client: Client, table: string): Promise<number> {
  const r = await client.query(`select count(*) as c from ${SCHEMA}.${table}`);
  return Number(r.rows[0].c);
}

async function postApply(): Promise<Record<string, unknown>> {
  const r = await admin.query(POST_SQL);
  return r.rows[0].backup_reader_rls_post_apply_result as Record<string, unknown>;
}

async function policyCount(): Promise<number> {
  const r = await admin.query(`select count(*) as c from pg_catalog.pg_policies where schemaname = '${SCHEMA}'`);
  return Number(r.rows[0].c);
}

function backupInput(r2Client: FakeR2Client, jobId: string) {
  return {
    prodClient: createPostgresQueryClient(backupReader, { setTestSearchPath: false }),
    verifyClient: createPostgresQueryClient(admin),
    r2Client,
    ageRecipient: RECIPIENT,
    ageCommand: [process.execPath, fakeAgePath],
    jobId,
    now: new Date(),
    schemaVersion: "backup-reader-rls-policy-postgres-test-v1",
    postgresMajorVersion: pgMajor,
    applicationCommitSha: "0".repeat(40),
    category: "pre-apply" as const,
    expectedSourceIdentity: backupIdentity,
  };
}

beforeAll(async () => {
  scratchDir = mkdtempSync(join(tmpdir(), "backup-reader-rls-policy-test-"));
  fakeAgePath = join(scratchDir, "fake-age.mjs");
  writeFileSync(
    fakeAgePath,
    `import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const outPath = args[args.indexOf("-o") + 1];
writeFileSync(outPath, Buffer.concat([Buffer.from("FAKE_AGE:"), readFileSync(args[args.length - 1])]));
`,
  );

  admin = new Client(config);
  await admin.connect();
  connected.admin = true;
  pgMajor = Math.floor(parseInt(String((await admin.query("select current_setting('server_version_num') as v")).rows[0].v), 10) / 10000);

  for (const role of TEST_ROLES) {
    const exists = await admin.query("select to_regrole($1) is not null as e", [role]);
    if (exists.rows[0].e) throw new Error(`test role ${role} already exists in the isolated DB; refusing to reuse it`);
    await admin.query(`create role ${role} nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit`);
    createdRoles.push(role);
  }

  await admin.query(buildProductionLikeSchemaDdlForIsolatedTesting());
  await admin.query(buildBackupIsolatedSchemaDdl(BACKUP_RESTORE_TEST_SCHEMA));
  await admin.query(`truncate table ${SCHEMA}.player_card_analysis, ${SCHEMA}.world_player_cards, ${SCHEMA}.managers, ${SCHEMA}.import_batches cascade`);

  // create-reference-data-schema.sql / create-reference-data-backup-role.sql と同じ権限・RLS構成を再現する。
  await admin.query(`grant usage on schema ${SCHEMA} to anon, authenticated, ${BACKUP_ROLE}`);
  for (const t of ["world_player_cards", "managers", "player_card_analysis"]) {
    await admin.query(`grant select on ${SCHEMA}.${t} to anon, authenticated`);
    await admin.query(`create policy ${t}_select_all on ${SCHEMA}.${t} for select to anon, authenticated using (true)`);
  }
  for (const t of TABLES) {
    await admin.query(`grant select on ${SCHEMA}.${t} to ${BACKUP_ROLE}`);
    await admin.query(`alter table ${SCHEMA}.${t} enable row level security`);
    await admin.query(`alter table ${SCHEMA}.${t} force row level security`);
  }

  await admin.query(
    `insert into ${SCHEMA}.world_player_cards
      (world_card_id, name_en, stats, skills, ai_styles, appearance, efhub_conflicts, source, dataset_version, fetched_at, created_at, updated_at)
     values
      ('1', 'Player One', $1, $2, $3, null, $4, 'efootball-world.com', 'v1', $5, $5, $5),
      ('2', 'Player Two', $1, $2, $3, null, $4, 'efootball-world.com', 'v1', $5, $5, $5)`,
    [JSON.stringify({ ovr: 90 }), ["Long Range Drive"], [], JSON.stringify([]), SEED_ISO],
  );
  await admin.query(
    `insert into ${SCHEMA}.managers
      (internal_manager_id, source, source_manager_id, name_en, boosters, link_up_plays, dataset_version, fetched_at, created_at, updated_at)
     values (1, 'amine250/efootball-managers', '1', 'Manager One', $1, $1, 'v1', $2, $2, $2)`,
    [JSON.stringify([]), SEED_ISO],
  );
  await admin.query(
    `insert into ${SCHEMA}.player_card_analysis
      (world_card_id, player_model, positions, com_skills, player_skills, source, dataset_version, fetched_at, created_at, updated_at)
     values ('1', $1, $2, $3, $3, 'efhub', 'v1', $4, $4, $4)`,
    [JSON.stringify({}), JSON.stringify([]), [], SEED_ISO],
  );
  await admin.query(
    `insert into ${SCHEMA}.import_batches
      (batch_id, dataset_version, target_table, source, source_row_count, inserted_row_count, payload_hash, status, created_at)
     values (gen_random_uuid(), 'v1', 'world_player_cards', 'efootball-world.com', 2, 2, $1, 'verified', $2)`,
    ["0".repeat(64), SEED_ISO],
  );

  backupReader = new Client(config);
  await backupReader.connect();
  connected.backupReader = true;
  await backupReader.query(`set role ${BACKUP_ROLE}`);

  anon = new Client(config);
  await anon.connect();
  connected.anon = true;
  await anon.query("set role anon");
}, 30000);

afterAll(async () => {
  if (connected.backupReader) await backupReader.end().catch(() => undefined);
  if (connected.anon) await anon.end().catch(() => undefined);
  if (connected.admin) {
    await admin.query("rollback").catch(() => undefined);
    const policies = await admin.query(`select tablename, policyname from pg_catalog.pg_policies where schemaname = '${SCHEMA}'`);
    for (const p of policies.rows) {
      await admin.query(`drop policy ${p.policyname} on ${SCHEMA}.${p.tablename}`);
    }
    for (const t of TABLES) {
      await admin.query(`alter table ${SCHEMA}.${t} no force row level security`);
      await admin.query(`alter table ${SCHEMA}.${t} disable row level security`);
    }
    await admin.query(`truncate table ${SCHEMA}.player_card_analysis, ${SCHEMA}.world_player_cards, ${SCHEMA}.managers, ${SCHEMA}.import_batches cascade`);
    await admin.query(`truncate table ${BACKUP_RESTORE_TEST_SCHEMA}.player_card_analysis, ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards, ${BACKUP_RESTORE_TEST_SCHEMA}.managers, ${BACKUP_RESTORE_TEST_SCHEMA}.import_batches cascade`);
    for (const role of [...createdRoles].reverse()) {
      await admin.query(`drop owned by ${role}`);
      await admin.query(`drop role ${role}`);
    }
    await admin.end();
  }
  rmSync(scratchDir, { recursive: true, force: true });
}, 30000);

describe("Backup reader専用RLS SELECT policy(実apply/rollback SQLを使い捨てPostgreSQLで実行)", () => {
  it("状態A(現状相当): Backup roleからはエラー無しで0行、preflightとBackupはblocked、anonの既存動作は正常", async () => {
    for (const t of TABLES) expect(await countAs(admin, t)).toBeGreaterThan(0);
    for (const t of TABLES) expect(await countAs(backupReader, t)).toBe(0);

    const preflight = await runSourcePreflight(createPostgresQueryClient(backupReader, { setTestSearchPath: false }), SCHEMA, backupIdentity);
    expect(preflight.ok).toBe(false);
    expect(preflight.reasons.join(" ")).toMatch(/RLS有効\(FORCE: true\)/);
    for (const d of preflight.tables) {
      expect(d.rlsEnabled).toBe(true);
      expect(d.rlsForced).toBe(true);
      expect(d.ownerIsCurrentUser).toBe(false);
      expect(d.hasApplicableSelectPolicy).toBe(false);
    }

    const r2 = new FakeR2Client();
    const result = await runProductionBackup(backupInput(r2, "rls-state-a"));
    expect(result.ok).toBe(false);
    expect(result.summary.phase).toBe("source-preflight");
    expect(r2.putCalls).toBe(0);

    expect(await countAs(anon, "world_player_cards")).toBe(2);
    await expect(anon.query(`select count(*) from ${SCHEMA}.import_batches`)).rejects.toThrow(/permission denied/);
  });

  it("pre-apply確認SQL(metadata only)は想定どおりの現状を返す", async () => {
    const pre = (await admin.query(PRE_SQL)).rows[0].backup_reader_rls_pre_apply_result;
    expect(pre.role_exists).toBe(true);
    expect(pre.bypassrls).toBe(false);
    expect(pre.superuser).toBe(false);
    expect(pre.reference_data_exists).toBe(true);
    expect(pre.backup_role_reference_data_usage).toBe(true);
    for (const t of pre.tables) {
      expect(t.table_exists).toBe(true);
      expect(t.rls_enabled).toBe(true);
      expect(t.rls_forced).toBe(true);
      expect(t.owner_is_backup_role).toBe(false);
      expect(t.backup_role_can_select).toBe(true);
      for (const k of ["insert", "update", "delete", "truncate", "references", "trigger"]) expect(t[`backup_role_can_${k}`]).toBe(false);
    }
    expect(pre.reference_data_policies.length).toBe(3);
    expect(pre.import_batches_policy_count).toBe(0);
    expect(pre.new_policy_name_conflicts).toEqual([]);
    expect(pre.policies_targeting_backup_role).toEqual([]);
    for (const u of pre.user_data_table_privileges) expect(u.can_select).toBe(false);
  });

  it("想定外の類似policy(Backup roleを対象にした別名policy)があればapply SQLは何も作成せずに停止する", async () => {
    await admin.query(`create policy stray_backup_reader_policy on ${SCHEMA}.managers for select to ${BACKUP_ROLE} using (true)`);
    await expectSqlFailure(APPLY_SQL, /unexpected policy already targets reference_data_backup_reader/);
    await admin.query(`drop policy stray_backup_reader_policy on ${SCHEMA}.managers`);
    expect(await policyCount()).toBe(3);
  });

  it("既存anon/authenticated policyが想定と異なればapply SQLは停止する", async () => {
    await admin.query(`alter policy managers_select_all on ${SCHEMA}.managers to anon`);
    await expectSqlFailure(APPLY_SQL, /differ from the expected three anon\/authenticated SELECT policies/);
    await admin.query(`alter policy managers_select_all on ${SCHEMA}.managers to anon, authenticated`);
    expect(await policyCount()).toBe(3);
  });

  it("状態B(apply後): Backup roleだけが4テーブルを読め、preflight・non-empty policy・export・隔離Restoreが成功する", async () => {
    await admin.query(APPLY_SQL);
    expect(await policyCount()).toBe(7);

    const post = await postApply();
    expect(post.all_checks_pass).toBe(true);
    expect(post.new_policy_count).toBe(4);
    expect(post.existing_policies_unchanged).toBe(true);
    expect(post.import_batches_private).toBe(true);
    expect(post.backup_role_not_privileged).toBe(true);
    expect(post.rls_enabled_and_forced).toBe(true);

    expect(await countAs(backupReader, "world_player_cards")).toBe(2);
    expect(await countAs(backupReader, "managers")).toBe(1);
    expect(await countAs(backupReader, "player_card_analysis")).toBe(1);
    expect(await countAs(backupReader, "import_batches")).toBe(1);

    // anon/authenticatedの既存動作は不変、import_batchesは引き続き非公開
    expect(await countAs(anon, "world_player_cards")).toBe(2);
    await expect(anon.query(`select count(*) from ${SCHEMA}.import_batches`)).rejects.toThrow(/permission denied/);

    // Backup roleに書込み権限は無い
    await expect(backupReader.query(`delete from ${SCHEMA}.managers`)).rejects.toThrow(/permission denied/);

    const preflight = await runSourcePreflight(createPostgresQueryClient(backupReader, { setTestSearchPath: false }), SCHEMA, backupIdentity);
    expect(preflight.reasons).toEqual([]);
    expect(preflight.ok).toBe(true);

    const r2 = new FakeR2Client();
    const result = await runProductionBackup(backupInput(r2, "rls-state-b"));
    expect(result.ok, `reasons: ${JSON.stringify(result.reasons)}`).toBe(true);
    expect(result.summary.restoreVerified).toBe(true);
    expect(result.summary.storageVerified).toBe(true);
    expect(result.summary.rowCounts).toEqual({ world_player_cards: 2, managers: 1, player_card_analysis: 1, import_batches: 1 });
    expect(r2.putCalls).toBe(2);

    // JSONB・text[]がRestore後も保持されている
    const restored = await admin.query(`select stats, skills from ${BACKUP_RESTORE_TEST_SCHEMA}.world_player_cards order by world_card_id`);
    expect(restored.rows[0].stats).toEqual({ ovr: 90 });
    expect(restored.rows[0].skills).toEqual(["Long Range Drive"]);
  }, 30000);

  it("apply済みの状態で再applyすると、同名policyを上書きせず停止する", async () => {
    await expectSqlFailure(APPLY_SQL, /already exists \(not overwritten\)|unexpected policy already targets/);
    expect(await policyCount()).toBe(7);
  });

  it("Backup roleに適用されるRESTRICTIVE policyが追加された想定外状態を、preflightが検出する", async () => {
    await admin.query(`create policy stray_restrictive on ${SCHEMA}.managers as restrictive for select to ${BACKUP_ROLE} using (true)`);
    const preflight = await runSourcePreflight(createPostgresQueryClient(backupReader, { setTestSearchPath: false }), SCHEMA, backupIdentity);
    expect(preflight.ok).toBe(false);
    expect(preflight.reasons.join(" ")).toMatch(/RESTRICTIVE/);
    await admin.query(`drop policy stray_restrictive on ${SCHEMA}.managers`);
  });

  it("専用policyの定義が変わっている(USINGがtrueでない)場合、preflightはblockedになり、rollback SQLは何も削除せず停止する", async () => {
    await admin.query(`alter policy managers_backup_reader_select on ${SCHEMA}.managers using (false)`);
    const preflight = await runSourcePreflight(createPostgresQueryClient(backupReader, { setTestSearchPath: false }), SCHEMA, backupIdentity);
    expect(preflight.ok).toBe(false);
    expect(preflight.reasons.join(" ")).toMatch(/managers/);
    await expectSqlFailure(ROLLBACK_SQL, /differ from the expected definition \(none removed\)/);
    expect(await policyCount()).toBe(7);
    await admin.query(`alter policy managers_backup_reader_select on ${SCHEMA}.managers using (true)`);
  });

  it("状態C(rollback後): 専用4policyだけが消え、Backup roleは再び0行・blocked、既存policy・role属性・grantは不変", async () => {
    const rolesBefore = (await admin.query(`select rolname, rolsuper, rolbypassrls, rolcanlogin from pg_catalog.pg_roles where rolname = any($1) order by rolname`, [[...TEST_ROLES]])).rows;

    await admin.query(ROLLBACK_SQL);
    expect(await policyCount()).toBe(3);
    const remaining = await admin.query(`select policyname from pg_catalog.pg_policies where schemaname = '${SCHEMA}' order by policyname`);
    expect(remaining.rows.map((r) => r.policyname)).toEqual(["managers_select_all", "player_card_analysis_select_all", "world_player_cards_select_all"]);
    for (const { policy } of BACKUP_READER_POLICIES) expect(remaining.rows.map((r) => r.policyname)).not.toContain(policy);

    const post = await postApply();
    expect(post.new_policy_count).toBe(0);
    expect(post.policies_targeting_backup_role_count).toBe(0);
    expect(post.existing_policies_unchanged).toBe(true);
    expect(post.rls_enabled_and_forced).toBe(true);
    expect(post.backup_role_select_only).toBe(true);
    expect(post.all_checks_pass).toBe(false);

    for (const t of TABLES) expect(await countAs(backupReader, t)).toBe(0);
    const preflight = await runSourcePreflight(createPostgresQueryClient(backupReader, { setTestSearchPath: false }), SCHEMA, backupIdentity);
    expect(preflight.ok).toBe(false);

    const rolesAfter = (await admin.query(`select rolname, rolsuper, rolbypassrls, rolcanlogin from pg_catalog.pg_roles where rolname = any($1) order by rolname`, [[...TEST_ROLES]])).rows;
    expect(rolesAfter).toEqual(rolesBefore);
    expect(await countAs(anon, "world_player_cards")).toBe(2);
  });

  it("rollback済みの状態で再rollbackすると、何も削除せず停止する", async () => {
    await expectSqlFailure(ROLLBACK_SQL, /expected exactly four backup reader policies \(none removed\)/);
    expect(await policyCount()).toBe(3);
  });

  it("Run #6相当(policy無し)の空Backupは、引き続きexport前にblockedでR2へは一切uploadしない", async () => {
    const r2 = new FakeR2Client();
    const result = await runProductionBackup(backupInput(r2, "rls-state-c"));
    expect(result.ok).toBe(false);
    expect(result.summary.restoreVerified).toBe(false);
    expect(result.summary.storageVerified).toBe(false);
    expect(r2.putCalls).toBe(0);
  });
});
