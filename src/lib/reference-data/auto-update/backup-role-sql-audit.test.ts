import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  auditCreateRoleSql,
  auditVerifyRoleSql,
  auditRollbackRoleSql,
  assertHasRoleSafetyBanner,
  assertHasCreateRoleBanner,
  assertHasVerifySqlBanner,
  assertNoPasswordLiteral,
  assertNoConnectionInfoOrSecrets,
  assertNoUserDataOrOpsSchemaReference,
  assertNoElevatedPrivilegeGranted,
  assertGrantsAreSelectOrUsageOnly,
  assertNoDynamicSql,
  assertRoleNameFixed,
  assertExactlyFourTargetTablesGranted,
  assertVerifySqlIsMetadataOnly,
  assertVerifySqlUsesSafeExistenceCheck,
  assertVerifySqlHasNoWriteOrGrantStatements,
} from "./backup-role-sql-audit";

const REPO_ROOT = resolve(__dirname, "../../../..");
const CREATE_SQL = readFileSync(resolve(REPO_ROOT, "docs/production-readiness/sql/create-reference-data-backup-role.sql"), "utf8");
const VERIFY_SQL = readFileSync(resolve(REPO_ROOT, "docs/production-readiness/sql/verify-reference-data-backup-role.sql"), "utf8");
const ROLLBACK_SQL = readFileSync(resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-reference-data-backup-role.sql"), "utf8");

describe("create-reference-data-backup-role.sql(実ファイル)", () => {
  it("静的監査に合格する(issues: []であること)", () => {
    const checks = auditCreateRoleSql(CREATE_SQL);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("password句を一切含まない", () => {
    expect(CREATE_SQL).not.toMatch(/password\s+'/i);
  });

  it("NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLSをすべて明示する", () => {
    for (const kw of ["nosuperuser", "nocreatedb", "nocreaterole", "noreplication", "nobypassrls"]) {
      expect(CREATE_SQL.toLowerCase()).toContain(kw);
    }
  });

  it("対象4テーブルすべてへSELECTを付与する", () => {
    for (const t of ["world_player_cards", "managers", "player_card_analysis", "import_batches"]) {
      expect(CREATE_SQL).toContain(`reference_data.${t}`);
    }
  });

  it("reference_data schemaへのUSAGEだけを付与する(他schemaへのUSAGE付与を含まない)", () => {
    expect(CREATE_SQL).toMatch(/grant usage on schema reference_data/i);
    expect(CREATE_SQL).not.toMatch(/grant usage on schema (reference_data_ops|public|auth)/i);
  });
});

describe("verify-reference-data-backup-role.sql(実ファイル)", () => {
  it("静的監査に合格する(issues: []であること)", () => {
    const checks = auditVerifyRoleSql(VERIFY_SQL);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("has_table_privilege/has_schema_privilege/pg_rolesだけを使い、実データをFROM参照しない", () => {
    expect(VERIFY_SQL).toContain("has_table_privilege");
    expect(VERIFY_SQL).toContain("has_schema_privilege");
    expect(VERIFY_SQL).toContain("pg_roles");
    expect(VERIFY_SQL).not.toMatch(/from\s+reference_data\.\w+/i);
  });

  it("INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGERの確認項目をすべて含む", () => {
    for (const priv of ["insert", "update", "delete", "truncate", "references", "trigger"]) {
      expect(VERIFY_SQL.toLowerCase()).toContain(`'${priv}'`);
    }
  });

  it("to_regnamespace/to_regclassによる安全な存在確認を使い、生の名前を直接has_schema_privilege/has_table_privilegeへ渡さない", () => {
    expect(assertVerifySqlUsesSafeExistenceCheck(VERIFY_SQL).ok).toBe(true);
  });

  it("SELECT/WITH以外の書き込み・権限変更文(GRANT/INSERT/UPDATE/DELETE/TRUNCATE/ALTER/DROP/CREATE)を含まない", () => {
    expect(assertVerifySqlHasNoWriteOrGrantStatements(VERIFY_SQL).ok).toBe(true);
  });

  it("reference_data_ops/public/authの各schema usageをcoalesceでfalseへ倒し、existsフィールドで不存在と非付与を区別する", () => {
    expect(VERIFY_SQL).toContain("reference_data_ops_exists");
    expect(VERIFY_SQL).toContain("coalesce(has_schema_privilege('reference_data_backup_reader', to_regnamespace('reference_data_ops'), 'usage'), false)");
  });

  it("利用者データテーブル(public.my_team_snapshots・auth.users)へのSELECT有無も、同じ安全な存在確認で確認する", () => {
    expect(VERIFY_SQL).toContain("user_data_table_privileges");
    expect(VERIFY_SQL).toContain("'public', 'my_team_snapshots'");
    expect(VERIFY_SQL).toContain("'auth', 'users'");
  });
});

describe("rollback-reference-data-backup-role.sql(実ファイル)", () => {
  it("静的監査に合格する(issues: []であること)", () => {
    const checks = auditRollbackRoleSql(ROLLBACK_SQL);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("NOLOGIN・REVOKE・DROP ROLEの段階を含む", () => {
    expect(ROLLBACK_SQL).toMatch(/nologin/i);
    expect(ROLLBACK_SQL).toMatch(/revoke select/i);
    expect(ROLLBACK_SQL).toMatch(/drop role if exists/i);
  });

  it("DROP ROLEにCASCADEを使わない", () => {
    expect(ROLLBACK_SQL).not.toMatch(/drop role[^;]*cascade/i);
  });
});

describe("静的監査関数の検出力(合成の悪いSQL)", () => {
  it("安全宣言バナーの不足を検出する", () => {
    expect(assertHasRoleSafetyBanner("create role x;").ok).toBe(false);
    expect(assertHasCreateRoleBanner("-- DO NOT RUN DESIGN ONLY REQUIRES SEPARATE APPROVAL PRODUCTION NOT APPLIED\ncreate role x;").ok).toBe(false);
    expect(assertHasVerifySqlBanner("select 1;").ok).toBe(false);
  });

  it("password句(literal)を検出する", () => {
    expect(assertNoPasswordLiteral("create role x login password 'hunter2';").ok).toBe(false);
    expect(assertNoPasswordLiteral("create role x login password '<placeholder>';").ok).toBe(false);
  });

  it("接続文字列・Supabaseホスト名・メールアドレス・トークンを検出する", () => {
    expect(assertNoConnectionInfoOrSecrets("-- postgres://user:pass@host/db").ok).toBe(true); // コメントは除去される
    expect(assertNoConnectionInfoOrSecrets("select 'postgres://user:pass@host/db';").ok).toBe(false);
    expect(assertNoConnectionInfoOrSecrets("select 'xyz.supabase.co';").ok).toBe(false);
    expect(assertNoConnectionInfoOrSecrets("select 'someone@example.com';").ok).toBe(false);
    expect(assertNoConnectionInfoOrSecrets("select 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';").ok).toBe(false);
  });

  it("利用者データテーブル・reference_data_ops権限付与・public schema全体付与を検出する", () => {
    expect(assertNoUserDataOrOpsSchemaReference("select * from auth.users;").ok).toBe(false);
    expect(assertNoUserDataOrOpsSchemaReference("grant select on all tables in schema reference_data_ops to x;").ok).toBe(false);
    expect(assertNoUserDataOrOpsSchemaReference("grant usage on schema public to x;").ok).toBe(false);
  });

  it("SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLSの付与(NOの否定形以外)を検出する", () => {
    expect(assertNoElevatedPrivilegeGranted("alter role x with superuser;").ok).toBe(false);
    expect(assertNoElevatedPrivilegeGranted("alter role x with createdb;").ok).toBe(false);
    expect(assertNoElevatedPrivilegeGranted("alter role x with bypassrls;").ok).toBe(false);
    expect(assertNoElevatedPrivilegeGranted("alter role x with nosuperuser nocreatedb nocreaterole noreplication nobypassrls;").ok).toBe(true);
  });

  it("GRANT文にSELECT/USAGE以外の権限が含まれる場合を検出する", () => {
    expect(assertGrantsAreSelectOrUsageOnly("grant insert on reference_data.world_player_cards to x;").ok).toBe(false);
    expect(assertGrantsAreSelectOrUsageOnly("grant all privileges on reference_data.world_player_cards to x;").ok).toBe(false);
    expect(assertGrantsAreSelectOrUsageOnly("grant select on reference_data.world_player_cards to x with grant option;").ok).toBe(false);
    expect(assertGrantsAreSelectOrUsageOnly("grant select on reference_data.world_player_cards to x;").ok).toBe(true);
  });

  it("動的SQL(DO/EXECUTE)を検出する", () => {
    expect(assertNoDynamicSql("do $$ begin end $$;").ok).toBe(false);
  });

  it("role名が固定されていること、動的識別子でないことを確認する", () => {
    expect(assertRoleNameFixed("create role reference_data_backup_reader login;").ok).toBe(true);
    expect(assertRoleNameFixed("create role other_role login;").ok).toBe(false);
    expect(assertRoleNameFixed("execute format('create role %I', role_name);").ok).toBe(false);
  });

  it("GRANT対象テーブルが4件揃っていない場合を検出する", () => {
    expect(assertExactlyFourTargetTablesGranted("grant select on reference_data.world_player_cards to x;").ok).toBe(false);
  });

  it("確認用SQLが実テーブルをFROM参照している場合を検出する", () => {
    expect(assertVerifySqlIsMetadataOnly("select * from reference_data.world_player_cards;").ok).toBe(false);
    expect(assertVerifySqlIsMetadataOnly("select has_table_privilege('x','reference_data.y','select'), has_schema_privilege('x','y','usage') from pg_roles;").ok).toBe(true);
  });

  it("確認用SQLが利用者データテーブルをFROM参照している場合(public.my_team_snapshots/auth.users)を検出する", () => {
    expect(assertVerifySqlIsMetadataOnly("select * from public.my_team_snapshots;").ok).toBe(false);
    expect(assertVerifySqlIsMetadataOnly("select * from auth.users;").ok).toBe(false);
  });

  it("has_schema_privilege/has_table_privilegeへ生の名前を直接渡している(to_regnamespace/to_regclass未経由)行を検出する(Production ERROR 3F000の再発防止)", () => {
    // Productionで実際にERROR 3F000を起こした、修正前の生SQLパターン。
    expect(
      assertVerifySqlUsesSafeExistenceCheck(
        "select has_schema_privilege('reference_data_backup_reader', 'reference_data_ops', 'usage'), has_table_privilege('x', to_regclass('y.z'), 'select');",
      ).ok,
    ).toBe(false);
    expect(
      assertVerifySqlUsesSafeExistenceCheck(
        "select has_schema_privilege('x', to_regnamespace('y'), 'usage'), has_table_privilege('x', 'y.z', 'select');",
      ).ok,
    ).toBe(false);
    expect(assertVerifySqlUsesSafeExistenceCheck("select has_schema_privilege('x','y','usage');").ok).toBe(false); // to_regnamespace/to_regclassとも不在
  });

  it("一部の行だけto_regnamespace未経由の生名呼び出しが混在している場合を検出する(全体には両関数が存在していても行単位で検出する)", () => {
    const mixedSql = [
      "select has_schema_privilege('x', to_regnamespace('safe_schema'), 'usage'),",
      "has_schema_privilege('x', 'unsafe_schema', 'usage'),",
      "has_table_privilege('x', to_regclass('y.z'), 'select');",
    ].join("\n");
    expect(assertVerifySqlUsesSafeExistenceCheck(mixedSql).ok).toBe(false);
  });

  it("to_regnamespace/to_regclassを経由したhas_schema_privilege/has_table_privilege呼び出しを合格とする", () => {
    expect(
      assertVerifySqlUsesSafeExistenceCheck(
        "select has_schema_privilege('x', to_regnamespace('y'), 'usage'), has_table_privilege('x', to_regclass('y.z'), 'select');",
      ).ok,
    ).toBe(true);
  });

  it("GRANT/INSERT/UPDATE/DELETE/TRUNCATE/ALTER/DROP/CREATEを意図する文を検出する(権限名の文字列リテラルは誤検出しない)", () => {
    expect(assertVerifySqlHasNoWriteOrGrantStatements("grant select on reference_data.x to y;").ok).toBe(false);
    expect(assertVerifySqlHasNoWriteOrGrantStatements("insert into reference_data.x values (1);").ok).toBe(false);
    expect(assertVerifySqlHasNoWriteOrGrantStatements("update reference_data.x set y = 1;").ok).toBe(false);
    expect(assertVerifySqlHasNoWriteOrGrantStatements("delete from reference_data.x;").ok).toBe(false);
    expect(assertVerifySqlHasNoWriteOrGrantStatements("truncate table reference_data.x;").ok).toBe(false);
    expect(assertVerifySqlHasNoWriteOrGrantStatements("alter table reference_data.x add column y int;").ok).toBe(false);
    expect(assertVerifySqlHasNoWriteOrGrantStatements("drop table reference_data.x;").ok).toBe(false);
    expect(assertVerifySqlHasNoWriteOrGrantStatements("create table reference_data.x (y int);").ok).toBe(false);
    // 権限名としての 'insert'/'update'/'delete'/'truncate' という文字列リテラルは、
    // has_table_privilegeの第3引数として正当に使われるため、誤検出してはいけない。
    expect(
      assertVerifySqlHasNoWriteOrGrantStatements(
        "select has_table_privilege('x','y','insert'), has_table_privilege('x','y','update'), has_table_privilege('x','y','delete'), has_table_privilege('x','y','truncate');",
      ).ok,
    ).toBe(true);
  });
});
