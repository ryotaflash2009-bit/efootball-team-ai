import { describe, it, expect } from "vitest";
import {
  READONLY_PREFLIGHT_QUERIES,
  validateTableList,
  validateNoForbiddenGrants,
  validateRlsEnabledAndForced,
  validateNoRunningJobs,
  validateSslActive,
} from "./production-readonly-queries";
import { PRODUCTION_OPS_ALLOWED_TABLES } from "./production-preflight";

/**
 * すべて合成データだけを使う。実PostgreSQL・実Supabaseへは一切接続しない。
 */
describe("READONLY_PREFLIGHT_QUERIES", () => {
  it("すべてSELECT/SHOWで始まる(DDL/DML/GRANT/REVOKEを含まない)", () => {
    for (const sql of Object.values(READONLY_PREFLIGHT_QUERIES)) {
      expect(sql.trim()).toMatch(/^select|^show/i);
    }
  });

  it("破壊的操作・権限変更キーワードを含まない", () => {
    for (const sql of Object.values(READONLY_PREFLIGHT_QUERIES)) {
      expect(sql).not.toMatch(/\b(drop|truncate|delete|insert|update|grant|revoke|alter)\b/i);
    }
  });
});

describe("validateTableList", () => {
  const expected = PRODUCTION_OPS_ALLOWED_TABLES;

  it("全テーブルが存在すればok", () => {
    expect(validateTableList([...expected], expected).ok).toBe(true);
  });

  it("1件でも欠けていれば拒否", () => {
    const missing = [...expected].slice(1);
    expect(validateTableList(missing, expected).ok).toBe(false);
  });
});

describe("validateNoForbiddenGrants", () => {
  it("権限が0件ならok", () => {
    expect(validateNoForbiddenGrants([]).ok).toBe(true);
  });
  it("anon/authenticatedへの権限が1件でもあれば拒否", () => {
    expect(validateNoForbiddenGrants([{ grantee: "anon", privilege_type: "SELECT" }]).ok).toBe(false);
  });
});

describe("validateRlsEnabledAndForced", () => {
  const tables = ["update_jobs", "approvals"];

  it("全テーブルでRLS有効・FORCEならok", () => {
    const rows = tables.map((t) => ({ relname: t, relrowsecurity: true, relforcerowsecurity: true }));
    expect(validateRlsEnabledAndForced(rows, tables).ok).toBe(true);
  });

  it("RLSが無効なテーブルがあれば拒否", () => {
    const rows = [
      { relname: "update_jobs", relrowsecurity: true, relforcerowsecurity: true },
      { relname: "approvals", relrowsecurity: false, relforcerowsecurity: false },
    ];
    expect(validateRlsEnabledAndForced(rows, tables).ok).toBe(false);
  });

  it("行自体が見つからないテーブルがあれば拒否", () => {
    const rows = [{ relname: "update_jobs", relrowsecurity: true, relforcerowsecurity: true }];
    expect(validateRlsEnabledAndForced(rows, tables).ok).toBe(false);
  });
});

describe("validateNoRunningJobs", () => {
  it("実行中ジョブが0件ならok", () => {
    expect(validateNoRunningJobs([]).ok).toBe(true);
  });
  it("実行中ジョブが1件でもあれば拒否(lock取得前のpreflight)", () => {
    expect(
      validateNoRunningJobs([{ job_id: "j1", table_name: "world_player_cards", status: "running", started_at: "2026-01-01T00:00:00Z" }])
        .ok,
    ).toBe(false);
  });
});

describe("validateSslActive", () => {
  it("SSL有効ならok", () => {
    expect(validateSslActive({ ssl: true }).ok).toBe(true);
  });
  it("SSL無効・行なしなら拒否", () => {
    expect(validateSslActive({ ssl: false }).ok).toBe(false);
    expect(validateSslActive(undefined).ok).toBe(false);
  });
});
