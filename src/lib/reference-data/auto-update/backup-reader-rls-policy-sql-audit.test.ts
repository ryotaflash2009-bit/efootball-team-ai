import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  auditApplyPolicySql,
  auditRollbackPolicySql,
  auditPolicyVerifySql,
  assertApplyCreatesExactlyFourSelectOnlyPolicies,
  assertRollbackDropsOnlyFourBackupPolicies,
  assertNoRoleWideningInPolicies,
  assertNoSecretsOrConnectionInfo,
  sqlCodeOnly,
  BACKUP_READER_POLICIES,
} from "./backup-reader-rls-policy-sql-audit";

const SQL_DIR = resolve(__dirname, "../../../../docs/production-readiness/sql");
const APPLY = readFileSync(resolve(SQL_DIR, "create-reference-data-backup-reader-rls-policies.sql"), "utf8");
const ROLLBACK = readFileSync(resolve(SQL_DIR, "rollback-reference-data-backup-reader-rls-policies.sql"), "utf8");
const PRE = readFileSync(resolve(SQL_DIR, "verify-reference-data-backup-reader-rls-policies-pre-apply.sql"), "utf8");
const POST = readFileSync(resolve(SQL_DIR, "verify-reference-data-backup-reader-rls-policies-post-apply.sql"), "utf8");
const SCHEMA_SQL = readFileSync(resolve(SQL_DIR, "create-reference-data-schema.sql"), "utf8");

const failures = (checks: { ok: boolean; reason?: string }[]) => checks.filter((c) => !c.ok).map((c) => c.reason);

describe("既存のreference_data policy(リポジトリ内のschema SQL、Productionの実状態の断定ではない)", () => {
  it("anon/authenticated向けSELECT policyは3件だけで、import_batchesにはpolicyもGRANTも無い", () => {
    const code = sqlCodeOnly(SCHEMA_SQL);
    const policies = [...code.matchAll(/create policy (\w+)\s+on reference_data\.(\w+)\s+for select\s+to anon, authenticated\s+using \(true\);/g)].map((m) => `${m[2]}:${m[1]}`);
    expect(policies.sort()).toEqual(["managers:managers_select_all", "player_card_analysis:player_card_analysis_select_all", "world_player_cards:world_player_cards_select_all"]);
    expect(code).not.toMatch(/create policy \w+\s+on reference_data\.import_batches/);
    expect(code).not.toMatch(/grant select on reference_data\.import_batches/);
  });

  it("対象4テーブルはすべてRLS有効かつFORCE", () => {
    for (const t of ["world_player_cards", "managers", "player_card_analysis", "import_batches"]) {
      expect(SCHEMA_SQL).toContain(`alter table reference_data.${t} enable row level security;`);
      expect(SCHEMA_SQL).toContain(`alter table reference_data.${t} force row level security;`);
    }
  });

  it("新しいpolicy名は既存policy名と衝突しない", () => {
    for (const { policy } of BACKUP_READER_POLICIES) expect(SCHEMA_SQL).not.toContain(policy);
  });
});

describe("create-reference-data-backup-reader-rls-policies.sql(実ファイル)", () => {
  it("静的監査に合格する", () => {
    expect(failures(auditApplyPolicySql(APPLY))).toEqual([]);
  });

  it("4policyの名前・table対応・SELECT only・backup roleだけ・PERMISSIVE・USING (true)・WITH CHECK無し", () => {
    const code = sqlCodeOnly(APPLY).replace(/\s+/g, " ").toLowerCase();
    for (const { table, policy } of BACKUP_READER_POLICIES) {
      expect(code).toContain(`create policy ${policy} on reference_data.${table} as permissive for select to reference_data_backup_reader using (true);`);
    }
    expect(code).not.toMatch(/with check/);
  });

  it("事前確認で想定外の状態(role不存在・privileged role・RLS/FORCE無効・owner・名前衝突・類似policy・既存policy相違)を例外で停止する", () => {
    expect(APPLY).toMatch(/role reference_data_backup_reader does not exist/);
    expect(APPLY).toMatch(/must be NOSUPERUSER and NOBYPASSRLS/);
    expect(APPLY).toMatch(/must have RLS enabled and forced/);
    expect(APPLY).toMatch(/must not own/);
    expect(APPLY).toMatch(/already exists \(not overwritten\)/);
    expect(APPLY).toMatch(/unexpected policy already targets reference_data_backup_reader/);
    expect(APPLY).toMatch(/differ from the expected three anon\/authenticated SELECT policies/);
  });

  it("IF NOT EXISTS/OR REPLACEで想定外の状態を黙って通過させない", () => {
    expect(sqlCodeOnly(APPLY)).not.toMatch(/if not exists|or replace/i);
  });
});

describe("rollback-reference-data-backup-reader-rls-policies.sql(実ファイル)", () => {
  it("静的監査に合格する", () => {
    expect(failures(auditRollbackPolicySql(ROLLBACK))).toEqual([]);
  });

  it("今回の4policyだけを削除し、既存anon/authenticated policy・role・table・RLS設定に触れない", () => {
    const code = sqlCodeOnly(ROLLBACK).toLowerCase();
    expect(code.match(/drop policy/g)?.length).toBe(4);
    for (const existing of ["world_player_cards_select_all", "managers_select_all", "player_card_analysis_select_all"]) {
      expect(code).not.toMatch(new RegExp(`drop policy ${existing}\\b`));
    }
    expect(code).not.toMatch(/drop role|alter role|alter table|revoke|grant/);
  });

  it("想定外の定義なら何も削除せずに停止する", () => {
    expect(ROLLBACK).toMatch(/differ from the expected definition \(none removed\)/);
    expect(ROLLBACK).toMatch(/expected exactly four backup reader policies \(none removed\)/);
  });
});

describe("pre/post verification SQL(実ファイル)", () => {
  it("pre-apply SQLはmetadata onlyの単一SELECT/WITHで静的監査に合格する", () => {
    expect(failures(auditPolicyVerifySql(PRE))).toEqual([]);
  });

  it("post-apply SQLはmetadata onlyの単一SELECT/WITHで静的監査に合格する", () => {
    expect(failures(auditPolicyVerifySql(POST))).toEqual([]);
  });

  it("pre-apply SQLは要求された確認項目をすべて含む", () => {
    for (const key of [
      "current_database", "current_user", "session_user", "role_exists", "login", "superuser", "createdb", "createrole", "replication", "bypassrls",
      "reference_data_exists", "rls_enabled", "rls_forced", "table_owner", "owner_is_backup_role", "backup_role_reference_data_usage",
      "backup_role_can_select", "backup_role_can_insert", "backup_role_can_update", "backup_role_can_delete", "backup_role_can_truncate",
      "backup_role_can_references", "backup_role_can_trigger", "reference_data_policies", "new_policy_name_conflicts",
      "policies_targeting_backup_role", "similar_policies", "import_batches_policy_count", "user_data_table_privileges",
    ]) {
      expect(PRE).toContain(key);
    }
    expect(PRE).toContain("'my_team_snapshots'");
    expect(PRE).toContain("'users'");
  });

  it("post-apply SQLはall_checks_passと各合格条件を出力する", () => {
    for (const key of [
      "new_policy_count", "new_policies_exact", "policies_targeting_backup_role_count", "existing_policies_unchanged", "import_batches_private",
      "backup_role_not_privileged", "backup_role_select_only", "rls_enabled_and_forced", "no_user_data_access", "all_checks_pass",
    ]) {
      expect(POST).toContain(`'${key}'`);
    }
  });
});

describe("静的監査の検出力(合成の悪いSQL)", () => {
  const header = "-- DO NOT RUN\n-- DESIGN ONLY\n-- REQUIRES SEPARATE APPROVAL\n-- PRODUCTION NOT APPLIED\n";
  const policy = (to: string, cmd = "select", extra = "") =>
    BACKUP_READER_POLICIES.map(({ table, policy: p }) => `create policy ${p} on reference_data.${table} as permissive for ${cmd} to ${to} using (true)${extra};`).join("\n");
  const wrap = (body: string) => `${header}begin;\n${body}\ncommit;\n`;

  it("正しい合成SQLは合格する(検査自体の健全性)", () => {
    expect(failures(auditApplyPolicySql(wrap(policy("reference_data_backup_reader"))))).toEqual([]);
  });

  it("対象roleの拡張(anon/authenticated/PUBLIC)を検出する", () => {
    expect(assertNoRoleWideningInPolicies(wrap(policy("reference_data_backup_reader, anon"))).ok).toBe(false);
    expect(assertApplyCreatesExactlyFourSelectOnlyPolicies(wrap(policy("public"))).ok).toBe(false);
  });

  it("SELECT以外のcommand・WITH CHECK・RESTRICTIVEを検出する", () => {
    expect(assertApplyCreatesExactlyFourSelectOnlyPolicies(wrap(policy("reference_data_backup_reader", "all"))).ok).toBe(false);
    expect(assertApplyCreatesExactlyFourSelectOnlyPolicies(wrap(policy("reference_data_backup_reader", "select", " with check (true)"))).ok).toBe(false);
    expect(assertApplyCreatesExactlyFourSelectOnlyPolicies(wrap(policy("reference_data_backup_reader").replace(/as permissive/g, "as restrictive"))).ok).toBe(false);
  });

  it("USING (true)以外の条件を検出する", () => {
    expect(assertApplyCreatesExactlyFourSelectOnlyPolicies(wrap(policy("reference_data_backup_reader").replace(/using \(true\)/g, "using (source = 'x')"))).ok).toBe(false);
  });

  it("GRANT・REVOKE・BYPASSRLS・ALTER ROLE・RLS無効化・FORCE解除・DROP TABLE/SCHEMA・既存policy変更を検出する", () => {
    for (const bad of [
      "grant select on reference_data.import_batches to anon;",
      "revoke select on reference_data.managers from anon;",
      "alter role reference_data_backup_reader bypassrls;",
      "alter table reference_data.managers disable row level security;",
      "alter table reference_data.managers no force row level security;",
      "drop table reference_data.managers;",
      "drop schema reference_data;",
      "drop policy managers_select_all on reference_data.managers;",
      "alter policy managers_select_all on reference_data.managers to anon;",
      "delete from reference_data.managers;",
    ]) {
      expect(failures(auditApplyPolicySql(wrap(`${policy("reference_data_backup_reader")}\n${bad}`))).length, bad).toBeGreaterThan(0);
    }
  });

  it("policy名の重複(同じcreate policyが5件)を検出する", () => {
    const five = `${policy("reference_data_backup_reader")}\ncreate policy managers_backup_reader_select on reference_data.managers as permissive for select to reference_data_backup_reader using (true);`;
    expect(assertApplyCreatesExactlyFourSelectOnlyPolicies(wrap(five)).ok).toBe(false);
  });

  it("rollbackが既存policyを削除する・IF EXISTS/CASCADEを使う・件数が異なる場合を検出する", () => {
    const drops = BACKUP_READER_POLICIES.map(({ table, policy: p }) => `drop policy ${p} on reference_data.${table};`).join("\n");
    expect(failures(auditRollbackPolicySql(wrap(drops)))).toEqual([]);
    expect(assertRollbackDropsOnlyFourBackupPolicies(wrap(`${drops}\ndrop policy managers_select_all on reference_data.managers;`)).ok).toBe(false);
    expect(failures(auditRollbackPolicySql(wrap(drops.replace("drop policy managers_backup", "drop policy if exists managers_backup")))).length).toBeGreaterThan(0);
    expect(failures(auditRollbackPolicySql(wrap(drops.replace("reference_data.managers;", "reference_data.managers cascade;")))).length).toBeGreaterThan(0);
    expect(assertRollbackDropsOnlyFourBackupPolicies(wrap(drops.split("\n").slice(1).join("\n"))).ok).toBe(false);
  });

  it("確認用SQLの書込み・DDL・行データ参照を検出する", () => {
    const vHeader = "-- READ ONLY\n-- METADATA ONLY\n-- DOES NOT READ USER ROW DATA\n-- DOES NOT READ REFERENCE_DATA ROW DATA\n";
    const good = `${vHeader}select to_regclass('reference_data.managers') is not null, to_regrole('reference_data_backup_reader') is not null;`;
    expect(failures(auditPolicyVerifySql(good))).toEqual([]);
    expect(failures(auditPolicyVerifySql(`${vHeader}select count(*) from reference_data.managers, to_regclass('x'), to_regrole('y');`)).length).toBeGreaterThan(0);
    expect(failures(auditPolicyVerifySql(`${vHeader}select 1 from auth.users where to_regclass('x') is null and to_regrole('y') is null;`)).length).toBeGreaterThan(0);
    expect(failures(auditPolicyVerifySql(`${good}\ncreate policy x on reference_data.managers for select to anon using (true);`)).length).toBeGreaterThan(0);
  });

  it("Secret・URL・Project Ref様の文字列を検出する", () => {
    expect(assertNoSecretsOrConnectionInfo("-- postgresql://u:p@h/db").ok).toBe(false);
    expect(assertNoSecretsOrConnectionInfo("-- see https://example.test").ok).toBe(false);
    expect(assertNoSecretsOrConnectionInfo("-- abcdefghijklmnopqrst").ok).toBe(false);
    expect(assertNoSecretsOrConnectionInfo("-- password here").ok).toBe(false);
  });
});
