import { describe, it, expect } from "vitest";
import { classifyProductionPreflightResult, type ProductionReadonlyPreflightResult } from "./production-readonly-preflight-result";

function baseResult(): ProductionReadonlyPreflightResult {
  return {
    database_info: {
      current_database: "postgres",
      current_user: "postgres",
      session_user: "postgres",
      version: "PostgreSQL 15.1",
      ssl: true,
      transaction_isolation: "read committed",
      statement_timeout: "0",
      lock_timeout: "0",
    },
    schema_info: {
      reference_data_exists: true,
      reference_data_ops_exists: false,
      public_exists: true,
      auth_exists: true,
    },
    table_info: [
      { schema: "reference_data", table: "world_player_cards", owner: "postgres" },
      { schema: "reference_data", table: "managers", owner: "postgres" },
      { schema: "reference_data", table: "player_card_analysis", owner: "postgres" },
      { schema: "reference_data", table: "import_batches", owner: "postgres" },
    ],
    column_info: [],
    constraint_info: [],
    index_info: [],
    rls_info: [
      { schema: "reference_data", table: "world_player_cards", rls_enabled: true, rls_forced: true },
      { schema: "reference_data", table: "managers", rls_enabled: true, rls_forced: true },
      { schema: "reference_data", table: "player_card_analysis", rls_enabled: true, rls_forced: true },
    ],
    policy_info: [
      { schema: "reference_data", table: "world_player_cards", policy_name: "select_all", command: "SELECT", roles: ["anon", "authenticated"], using: "true", with_check: null },
      { schema: "reference_data", table: "managers", policy_name: "select_all", command: "SELECT", roles: ["anon", "authenticated"], using: "true", with_check: null },
      { schema: "reference_data", table: "player_card_analysis", policy_name: "select_all", command: "SELECT", roles: ["anon", "authenticated"], using: "true", with_check: null },
    ],
    privilege_info: {
      table_grants: [
        { schema: "reference_data", table: "world_player_cards", grantee: "anon", privilege: "SELECT" },
        { schema: "reference_data", table: "world_player_cards", grantee: "authenticated", privilege: "SELECT" },
        { schema: "reference_data", table: "managers", grantee: "anon", privilege: "SELECT" },
        { schema: "reference_data", table: "player_card_analysis", grantee: "anon", privilege: "SELECT" },
      ],
      schema_usage_grants: [{ schema: "reference_data", grantee: "anon", privilege: "USAGE" }],
    },
    row_counts: { world_player_cards: 13009, managers: 66, player_card_analysis: 19, import_batches: 3 },
    ops_schema_status: { schema_exists: false, tables_found: [] },
  };
}

describe("classifyProductionPreflightResult", () => {
  it("設計文書どおりの結果はA(想定どおり)だけを返す", () => {
    const findings = classifyProductionPreflightResult(baseResult());
    expect(findings).toEqual([{ bucket: "A", area: "overall", message: expect.any(String) }]);
  });

  it("reference_dataが存在しない場合はD(blocks)", () => {
    const result = baseResult();
    result.schema_info.reference_data_exists = false;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.area === "schema_info")).toBe(true);
  });

  it("reference_data_opsが既に存在する場合はC(staging適用前に修正必要)", () => {
    const result = baseResult();
    result.schema_info.reference_data_ops_exists = true;
    result.ops_schema_status.schema_exists = true;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "C" && f.area === "schema_info")).toBe(true);
  });

  it("schema_infoとops_schema_statusが矛盾する場合はE(情報不足)", () => {
    const result = baseResult();
    result.ops_schema_status.schema_exists = true; // schema_info側はfalseのまま
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "E" && f.area === "ops_schema_status")).toBe(true);
  });

  it("RLSが無効な場合はD", () => {
    const result = baseResult();
    result.rls_info[0].rls_enabled = false;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.area === "rls_info")).toBe(true);
  });

  it("FORCE RLSだけが無効な場合もD(RLS自体は有効でも不十分)", () => {
    const result = baseResult();
    result.rls_info[0].rls_forced = false;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.area === "rls_info")).toBe(true);
  });

  it("RLS対象テーブルがrls_infoに存在しない場合はD", () => {
    const result = baseResult();
    result.rls_info = result.rls_info.filter((r) => r.table !== "managers");
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.message.includes("managers"))).toBe(true);
  });

  it("SELECTポリシーが無い場合はD", () => {
    const result = baseResult();
    result.policy_info = result.policy_info.filter((p) => p.table !== "world_player_cards");
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.area === "policy_info")).toBe(true);
  });

  it("anon/authenticatedへのINSERT/UPDATE/DELETEポリシーが存在する場合はD", () => {
    const result = baseResult();
    result.policy_info.push({
      schema: "reference_data",
      table: "world_player_cards",
      policy_name: "bad_write",
      command: "UPDATE",
      roles: ["authenticated"],
      using: "true",
      with_check: "true",
    });
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.message.includes("INSERT/UPDATE/DELETE"))).toBe(true);
  });

  it("anon/authenticatedへSELECT以外の権限が付与されている場合はD", () => {
    const result = baseResult();
    result.privilege_info.table_grants.push({ schema: "reference_data", table: "managers", grantee: "anon", privilege: "UPDATE" });
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.area === "privilege_info")).toBe(true);
  });

  it("import_batchesへanon/authenticatedの権限が付与されている場合はD(非公開の想定)", () => {
    const result = baseResult();
    result.privilege_info.table_grants.push({ schema: "reference_data", table: "import_batches", grantee: "anon", privilege: "SELECT" });
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.message.includes("import_batches"))).toBe(true);
  });

  it("件数が0件の場合はD(データ未投入の可能性)", () => {
    const result = baseResult();
    result.row_counts.world_player_cards = 0;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.area === "row_counts")).toBe(true);
  });

  it("件数が設計文書の想定値とわずかに異なる場合はB(docs更新だけ必要)", () => {
    const result = baseResult();
    result.row_counts.managers = 70;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "B" && f.area === "row_counts")).toBe(true);
  });

  it("import_batchesの件数差は個別の期待値が無いため判定しない", () => {
    const result = baseResult();
    result.row_counts.import_batches = 999;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.filter((f) => f.message.includes("import_batches") && f.area === "row_counts")).toEqual([]);
  });

  it("SSLが無効な場合はD", () => {
    const result = baseResult();
    result.database_info.ssl = false;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "D" && f.area === "database_info")).toBe(true);
  });

  it("public/authスキーマが存在しない場合はE", () => {
    const result = baseResult();
    result.schema_info.auth_exists = false;
    const findings = classifyProductionPreflightResult(result);
    expect(findings.some((f) => f.bucket === "E" && f.area === "schema_info")).toBe(true);
  });
});
