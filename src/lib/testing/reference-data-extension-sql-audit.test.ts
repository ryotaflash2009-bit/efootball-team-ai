import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditReferenceDataExtensionSql } from "./reference-data-sql-audit";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const EXTEND_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/extend-reference-data-detail-schema.sql");
const ROLLBACK_SQL_PATH = resolve(REPO_ROOT, "docs/production-readiness/sql/rollback-reference-data-detail-extension.sql");

describe("auditReferenceDataExtensionSql", () => {
  it("extend-reference-data-detail-schema.sql は監査項目をすべて満たす(issues空)", () => {
    const sql = readFileSync(EXTEND_SQL_PATH, "utf8");
    const result = auditReferenceDataExtensionSql(sql);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("world_player_cards/managers以外へのALTER TABLEを検出する", () => {
    const sql = "alter table reference_data.import_batches add column foo text;";
    const result = auditReferenceDataExtensionSql(sql);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("許可されていないテーブル"))).toBe(true);
  });

  it("player_card_analysis/import_batchesへの変更を検出する", () => {
    const sql = "alter table reference_data.world_player_cards add column x text; alter table reference_data.player_card_analysis add column y text;";
    const result = auditReferenceDataExtensionSql(sql);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("player_card_analysis/import_batches"))).toBe(true);
  });

  it("CREATE TABLEが含まれる場合を検出する", () => {
    const sql = "create table reference_data.new_table (id int); alter table reference_data.managers add column x text;";
    expect(auditReferenceDataExtensionSql(sql).ok).toBe(false);
  });

  it("CREATE/DROP SCHEMAが含まれる場合を検出する", () => {
    const sql = "create schema if not exists reference_data; alter table reference_data.managers add column x text;";
    expect(auditReferenceDataExtensionSql(sql).ok).toBe(false);
  });

  it("POLICY文が含まれる場合を検出する", () => {
    const sql = "alter table reference_data.managers add column x text; create policy p on reference_data.managers for select to anon using (true);";
    expect(auditReferenceDataExtensionSql(sql).ok).toBe(false);
  });

  it("GRANT/REVOKE文が含まれる場合を検出する", () => {
    const sql = "alter table reference_data.managers add column x text; grant select on reference_data.managers to anon;";
    expect(auditReferenceDataExtensionSql(sql).ok).toBe(false);
  });

  it("INSERT INTOが含まれる場合を検出する", () => {
    const sql = "alter table reference_data.managers add column x text; insert into reference_data.managers (internal_manager_id) values (1);";
    expect(auditReferenceDataExtensionSql(sql).ok).toBe(false);
  });

  it("DROP DATABASE/DROP SCHEMA public/TRUNCATE/GRANT ALLはいずれも検出する", () => {
    expect(auditReferenceDataExtensionSql("drop database x; alter table reference_data.managers add column y text;").ok).toBe(false);
    expect(auditReferenceDataExtensionSql("drop schema if exists public cascade; alter table reference_data.managers add column y text;").ok).toBe(false);
    expect(auditReferenceDataExtensionSql("truncate reference_data.managers; alter table reference_data.managers add column y text;").ok).toBe(false);
    expect(auditReferenceDataExtensionSql("alter table reference_data.managers add column y text; grant all on reference_data.managers to anon;").ok).toBe(false);
  });

  it("service_role/secret-likeな文字列を検出する", () => {
    expect(auditReferenceDataExtensionSql("alter table reference_data.managers add column x text; -- service_role").ok).toBe(false);
  });

  it("my_team_snapshots/rls_probe_recordsへの変更を検出する", () => {
    const sql = "alter table reference_data.managers add column x text; alter table public.my_team_snapshots add column y text;";
    expect(auditReferenceDataExtensionSql(sql).ok).toBe(false);
  });

  it("ALTER TABLE文が1つも無い場合は失敗する", () => {
    expect(auditReferenceDataExtensionSql("select 1;").ok).toBe(false);
  });

  it("rollback-reference-data-detail-extension.sql はworld_player_cards/managers以外を変更しない", () => {
    const sql = readFileSync(ROLLBACK_SQL_PATH, "utf8");
    expect(sql).not.toMatch(/drop\s+schema/i);
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/alter\s+table\s+(?:reference_data\.)?(player_card_analysis|import_batches)\b/i);
    expect(sql).not.toMatch(/alter\s+table\s+(?:public\.)?(my_team_snapshots|rls_probe_records)\b/i);
  });
});
