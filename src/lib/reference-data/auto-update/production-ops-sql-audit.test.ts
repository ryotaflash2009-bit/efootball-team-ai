import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  auditProductionOpsCreateSql,
  auditProductionOpsRollbackSql,
  auditProductionOpsPreflightSql,
  assertHasDoNotRunBanner,
  assertNoPublicOrAuthSchemaChange,
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

describe("preflight-reference-data-ops.sql(実ファイル)", () => {
  it("静的監査に合格する(SELECT/SHOW専用)", () => {
    const checks = auditProductionOpsPreflightSql(PREFLIGHT_SQL);
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });

  it("DDL/DML/GRANT/REVOKEを一切含まない", () => {
    expect(PREFLIGHT_SQL).not.toMatch(/\b(create\s+table|drop\s+table|insert\s+into|delete\s+from|grant\s|revoke\s)\b/i);
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
