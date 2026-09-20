import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  auditProductionOpsCreateSql,
  auditProductionOpsRollbackSql,
  auditProductionReadonlyPreflightSql,
  assertHasDoNotRunBanner,
  assertReadOnlyPreflightBanner,
  assertOnlyReadOnlySyntax,
  assertNoDirectOpsSchemaTableReference,
  assertNoSecretLikePatterns,
  assertNoPublicOrAuthSchemaChange,
  assertNoUserDataTableReference,
  assertNoReferenceDataSchemaChange,
  assertNoUnexpectedDestructiveOps,
  assertNoDynamicSqlInRollback,
  assertAllDropsAreSchemaQualified,
  extractCreatedTableNames,
  extractForeignKeyDependencies,
  extractDroppedTableNames,
  assertRollbackObjectSetMatchesCreate,
  assertRollbackOrderRespectsDependencies,
  assertRollbackDropsSchemaLast,
} from "./production-ops-sql-audit";

const REPO_ROOT = resolve(__dirname, "../../../..");
const CREATE_SQL = readFileSync(resolve(REPO_ROOT, "docs/production-readiness/sql/create-reference-data-ops-schema.sql"), "utf8");
const ROLLBACK_SQL = readFileSync(resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-reference-data-ops-schema.sql"), "utf8");
const PREFLIGHT_SQL = readFileSync(resolve(REPO_ROOT, "docs/production-readiness/sql/preflight-reference-data-ops.sql"), "utf8");

describe("create-reference-data-ops-schema.sql(実ファイル)", () => {
  it("静的監査に合格する(DO NOT RUN表示・public/auth非変更・利用者データ非参照・破壊的操作なし・ロールGRANTなし)", () => {
    const checks = auditProductionOpsCreateSql(CREATE_SQL);
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });

  it("reference_data_opsスキーマの作成を含む", () => {
    expect(CREATE_SQL).toMatch(/create schema if not exists reference_data_ops/i);
  });

  it("10テーブルすべてを作成する", () => {
    for (const t of [
      "update_jobs", "approvals", "applied_checksums", "audit_events",
      "staging_world_player_cards", "staging_managers", "staging_player_card_analysis",
      "before_snapshots", "rollback_jobs", "source_metadata_snapshots",
    ]) {
      expect(CREATE_SQL).toMatch(new RegExp(`reference_data_ops\\.${t}\\b`));
    }
  });

  it("RLSを有効化しFORCEする", () => {
    expect(CREATE_SQL).toMatch(/enable row level security/i);
    expect(CREATE_SQL).toMatch(/force row level security/i);
  });

  it("秘密情報らしき文字列を含まない", () => {
    expect(CREATE_SQL).not.toMatch(/sb_secret_|eyJ[A-Za-z0-9_-]{10}|postgres(ql)?:\/\/[^\s]*:[^\s@]*@/i);
  });
});

describe("rollback-reference-data-ops-schema.sql(実ファイル)", () => {
  it("静的監査に合格する(CASCADE不使用・reference_data_ops内の明示DROPだけ・作成SQLとのオブジェクト集合一致・依存順序整合)", () => {
    const checks = auditProductionOpsRollbackSql(CREATE_SQL, ROLLBACK_SQL, "reference_data_ops");
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });

  it("CASCADEはreference_data_ops自体に対してであっても検出する(理由を問わず禁止)", () => {
    const badSql = `
-- DO NOT RUN DESIGN ONLY PRODUCTION NOT APPLIED
drop schema if exists reference_data_ops cascade;
`;
    const checks = auditProductionOpsRollbackSql(CREATE_SQL, badSql, "reference_data_ops");
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("public以外のCASCADEも含め、あらゆるDROP CASCADEを検出する(合成の悪いSQLで確認)", () => {
    const badSql = `
-- DO NOT RUN DESIGN ONLY PRODUCTION NOT APPLIED
drop schema if exists public cascade;
`;
    const checks = auditProductionOpsRollbackSql(CREATE_SQL, badSql, "reference_data_ops");
    expect(checks.some((c) => !c.ok)).toBe(true);
  });

  it("作成SQLで作られる10テーブルすべてを明示DROPしている(不足・想定外なし)", () => {
    const created = extractCreatedTableNames(CREATE_SQL, "reference_data_ops");
    const dropped = extractDroppedTableNames(ROLLBACK_SQL, "reference_data_ops");
    expect(new Set(dropped)).toEqual(new Set(created));
    expect(created.length).toBe(10);
  });

  it("依存関係抽出: update_jobsを参照している9テーブルを検出する", () => {
    const deps = extractForeignKeyDependencies(CREATE_SQL, "reference_data_ops");
    const referencingUpdateJobs = [...deps.entries()].filter(([, parents]) => parents.has("update_jobs")).map(([child]) => child);
    expect(referencingUpdateJobs.sort()).toEqual(
      [
        "approvals",
        "applied_checksums",
        "audit_events",
        "staging_world_player_cards",
        "staging_managers",
        "staging_player_card_analysis",
        "before_snapshots",
        "rollback_jobs",
        "source_metadata_snapshots",
      ].sort(),
    );
  });

  it("テーブル集合の不一致を検出する(合成の悪いSQLで確認)", () => {
    const badRollback = `
-- DO NOT RUN DESIGN ONLY PRODUCTION NOT APPLIED
drop table if exists reference_data_ops.update_jobs;
drop schema if exists reference_data_ops;
`;
    const check = assertRollbackObjectSetMatchesCreate(CREATE_SQL, badRollback, "reference_data_ops");
    expect(check.ok).toBe(false);
  });

  it("依存順序違反を検出する(親のupdate_jobsを子より先にDROPする合成の悪いSQL)", () => {
    const badRollback = `
-- DO NOT RUN DESIGN ONLY PRODUCTION NOT APPLIED
drop table if exists reference_data_ops.update_jobs;
drop table if exists reference_data_ops.approvals;
drop table if exists reference_data_ops.applied_checksums;
drop table if exists reference_data_ops.audit_events;
drop table if exists reference_data_ops.staging_world_player_cards;
drop table if exists reference_data_ops.staging_managers;
drop table if exists reference_data_ops.staging_player_card_analysis;
drop table if exists reference_data_ops.before_snapshots;
drop table if exists reference_data_ops.rollback_jobs;
drop table if exists reference_data_ops.source_metadata_snapshots;
drop schema if exists reference_data_ops;
`;
    const check = assertRollbackOrderRespectsDependencies(CREATE_SQL, badRollback, "reference_data_ops");
    expect(check.ok).toBe(false);
  });

  it("最後の文がschema自体のDROPでない場合を検出する(合成の悪いSQLで確認)", () => {
    const badRollback = `
-- DO NOT RUN DESIGN ONLY PRODUCTION NOT APPLIED
drop schema if exists reference_data_ops;
drop table if exists reference_data_ops.update_jobs;
`;
    const check = assertRollbackDropsSchemaLast(badRollback, "reference_data_ops");
    expect(check.ok).toBe(false);
  });

  it("動的SQL(DO/EXECUTE)を検出する(合成の悪いSQLで確認)", () => {
    const badRollback = `
-- DO NOT RUN DESIGN ONLY PRODUCTION NOT APPLIED
do $$ begin execute format('drop table reference_data_ops.%I', 'update_jobs'); end $$;
`;
    expect(assertNoDynamicSqlInRollback(badRollback).ok).toBe(false);
  });

  it("schema外・未修飾のDROPを検出する(合成の悪いSQLで確認)", () => {
    expect(assertAllDropsAreSchemaQualified("drop table update_jobs;", "reference_data_ops").ok).toBe(false);
    expect(assertAllDropsAreSchemaQualified("drop table other_schema.update_jobs;", "reference_data_ops").ok).toBe(false);
  });

  it("reference_dataスキーマへの変更を検出する(合成の悪いSQLで確認)", () => {
    expect(assertNoReferenceDataSchemaChange("drop table reference_data.world_player_cards;").ok).toBe(false);
    expect(assertNoReferenceDataSchemaChange("drop table reference_data_ops.update_jobs;").ok).toBe(true);
  });
});

describe("preflight-reference-data-ops.sql(実ファイル、単一read-only preflight SQL)", () => {
  it("SHA-256回帰確認: 本人がProduction Supabaseで実際に実行したSQLと同一である(2026-09-20確認済み)", () => {
    const sha256 = createHash("sha256").update(PREFLIGHT_SQL, "utf8").digest("hex");
    expect(sha256).toBe("c7de038cabac96275567bd71cd8ca3d30c2e5f950650f5a3779e5d265664a6b5");
  });

  it("read-only preflight専用の静的監査に合格する(issues: []であること)", () => {
    const checks = auditProductionReadonlyPreflightSql(PREFLIGHT_SQL);
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });

  it("DDL/DML/GRANT/REVOKEを一切含まない(冒頭の安全宣言コメント行を除く実SQL本体)", () => {
    const bodyWithoutCommentLines = PREFLIGHT_SQL.split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(bodyWithoutCommentLines).not.toMatch(/\b(create\s+table|drop\s+table|insert\s+into|delete\s+from|grant\s|revoke\s)\b/i);
  });

  it("read-only preflight専用の安全宣言バナー(READ ONLY/NO DDL/NO DML/NO GRANT OR REVOKE/DOES NOT READ USER ROW DATA/SAFE TO RUN)を含む", () => {
    expect(assertReadOnlyPreflightBanner(PREFLIGHT_SQL).ok).toBe(true);
  });

  it("reference_data_ops.<table>への直接参照を含まない(未適用でも失敗しない)", () => {
    expect(assertNoDirectOpsSchemaTableReference(PREFLIGHT_SQL).ok).toBe(true);
  });

  it("利用者データテーブル(auth.users/my_team_snapshots/rls_probe_records)を参照しない", () => {
    expect(assertNoUserDataTableReference(PREFLIGHT_SQL).ok).toBe(true);
  });

  it("秘密情報らしき文字列(メール・接続文字列・トークン・パスワード)を含まない", () => {
    expect(assertNoSecretLikePatterns(PREFLIGHT_SQL).ok).toBe(true);
  });

  it("SELECT/WITH/SHOW以外の文・DDL/DML/GRANT/REVOKE/動的SQLキーワードを一切含まない", () => {
    expect(assertOnlyReadOnlySyntax(PREFLIGHT_SQL).ok).toBe(true);
  });

  it("必要な12セクションすべてをJSONBオブジェクトのキーとして返す(単一行)", () => {
    for (const key of [
      "database_info",
      "schema_info",
      "table_info",
      "column_info",
      "constraint_info",
      "index_info",
      "rls_info",
      "policy_info",
      "privilege_info",
      "row_counts",
      "ops_schema_status",
      "final_preflight_summary",
    ]) {
      expect(PREFLIGHT_SQL).toContain(`'${key}'`);
    }
  });

  it("トップレベルのselect文が1つだけ(複数結果セットを返さない)", () => {
    const topLevelSelects = PREFLIGHT_SQL.match(/^select\s+jsonb_build_object/gim) ?? [];
    expect(topLevelSelects.length).toBe(1);
  });
});

describe("read-only preflight専用の静的監査関数の検出力(合成の悪いSQL)", () => {
  it("安全宣言バナーの不足を検出する", () => {
    expect(assertReadOnlyPreflightBanner("select 1;").ok).toBe(false);
  });

  it("data-modifying CTE(WITH句内のDELETE)を検出する(トップレベルはselectでも拒否)", () => {
    const badSql = `
-- READ ONLY NO DDL NO DML NO GRANT OR REVOKE DOES NOT READ USER ROW DATA SAFE TO RUN MANUALLY IN SUPABASE SQL EDITOR
with removed as (delete from reference_data.world_player_cards where world_card_id = 'x' returning *)
select count(*) from removed;
`;
    expect(assertOnlyReadOnlySyntax(badSql).ok).toBe(false);
  });

  it("GRANT/REVOKEを検出する", () => {
    expect(assertOnlyReadOnlySyntax("select 1; grant select on reference_data.managers to anon;").ok).toBe(false);
  });

  it("SET ROLE / SECURITY DEFINERを検出する", () => {
    expect(assertOnlyReadOnlySyntax("set role postgres; select 1;").ok).toBe(false);
    expect(assertOnlyReadOnlySyntax("select 1; -- create function ... security definer").ok).toBe(true);
    expect(assertOnlyReadOnlySyntax("create function f() returns int language sql security definer as $$select 1$$;").ok).toBe(false);
  });

  it("reference_data_ops.<table>への直接参照を検出する(未適用時にエラーになる書き方)", () => {
    expect(assertNoDirectOpsSchemaTableReference("select * from reference_data_ops.update_jobs;").ok).toBe(false);
    expect(assertNoDirectOpsSchemaTableReference("select schema_name from information_schema.schemata where schema_name = 'reference_data_ops';").ok).toBe(true);
  });

  it("メールアドレス・接続文字列・JWT様トークン・password=を検出する", () => {
    expect(assertNoSecretLikePatterns("select 'someone@example.com';").ok).toBe(false);
    expect(assertNoSecretLikePatterns("select 'postgres://user:pass@host:5432/db';").ok).toBe(false);
    expect(assertNoSecretLikePatterns("select 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';").ok).toBe(false);
    expect(assertNoSecretLikePatterns("select 'password=hunter2';").ok).toBe(false);
  });

  it("read-only preflight用の合成SQLは全審査に合格する", () => {
    const goodSql = `
-- READ ONLY NO DDL NO DML NO GRANT OR REVOKE DOES NOT READ USER ROW DATA SAFE TO RUN MANUALLY IN SUPABASE SQL EDITOR
with x as (select 1 as n)
select jsonb_build_object('n', (select n from x));
`;
    const checks = auditProductionReadonlyPreflightSql(goodSql);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });
});

describe("静的監査関数の検出力(合成の悪いSQL)", () => {
  it("DO NOT RUN表示が無いSQLを検出する", () => {
    expect(assertHasDoNotRunBanner("create table x (id int);").ok).toBe(false);
  });

  it("public/authスキーマへの変更を検出する", () => {
    expect(assertNoPublicOrAuthSchemaChange("alter table public.my_team_snapshots add column x text;").ok).toBe(false);
    expect(assertNoPublicOrAuthSchemaChange("grant select on auth.users to anon;").ok).toBe(false);
  });

  it("TRUNCATEを検出する", () => {
    expect(assertNoUnexpectedDestructiveOps("truncate table reference_data_ops.update_jobs;").ok).toBe(false);
  });

  it("DROP CASCADEを検出する(対象が何であっても常に拒否)", () => {
    expect(assertNoUnexpectedDestructiveOps("drop schema reference_data cascade;").ok).toBe(false);
  });

  it("reference_data_ops自体へのDROP CASCADEも拒否する(例外なし)", () => {
    expect(assertNoUnexpectedDestructiveOps("drop schema if exists reference_data_ops cascade;").ok).toBe(false);
  });

  it("CASCADEを含まない明示DROPは合格する", () => {
    expect(assertNoUnexpectedDestructiveOps("drop table if exists reference_data_ops.update_jobs;").ok).toBe(true);
  });
});
