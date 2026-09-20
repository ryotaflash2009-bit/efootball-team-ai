/**
 * `docs/production-readiness/sql/preflight-reference-data-ops.sql`(単一read-only preflight SQL)を
 * 本人がSupabase SQL Editorで手動実行して得たJSON結果を、設計文書の期待値と機械的に
 * 突き合わせるための型と分類ロジック。実DB・実ネットワークへは一切接続しない純関数群。
 *
 * 分類バケット:
 *   A: 想定どおり
 *   B: 設計文書の更新だけ必要
 *   C: staging適用前に修正必要
 *   D: Production applyをblockする重大差異
 *   E: 情報不足(このJSONだけでは判定できない)
 */

export type PreflightBucket = "A" | "B" | "C" | "D" | "E";

export interface PreflightFinding {
  bucket: PreflightBucket;
  area: string;
  message: string;
}

export interface PreflightDatabaseInfo {
  current_database: string;
  current_user: string;
  session_user: string;
  version: string;
  ssl: boolean;
  transaction_isolation: string;
  statement_timeout: string;
  lock_timeout: string;
}

export interface PreflightSchemaInfo {
  reference_data_exists: boolean;
  reference_data_ops_exists: boolean;
  public_exists: boolean;
  auth_exists: boolean;
}

export interface PreflightTableInfoRow {
  schema: string;
  table: string;
  owner: string;
}

export interface PreflightRlsInfoRow {
  schema: string;
  table: string;
  rls_enabled: boolean;
  rls_forced: boolean;
}

export interface PreflightPolicyInfoRow {
  schema: string;
  table: string;
  policy_name: string;
  command: string;
  roles: string[];
  using: string | null;
  with_check: string | null;
}

export interface PreflightPrivilegeRow {
  schema: string;
  table: string;
  grantee: string;
  privilege: string;
}

export interface PreflightPrivilegeInfo {
  table_grants: PreflightPrivilegeRow[];
  schema_usage_grants: { schema: string; grantee: string; privilege: string }[];
}

export interface PreflightRowCounts {
  world_player_cards: number;
  managers: number;
  player_card_analysis: number;
  import_batches: number;
}

export interface PreflightOpsSchemaStatus {
  schema_exists: boolean;
  tables_found: string[];
}

export interface ProductionReadonlyPreflightResult {
  database_info: PreflightDatabaseInfo;
  schema_info: PreflightSchemaInfo;
  table_info: PreflightTableInfoRow[];
  column_info: unknown[];
  constraint_info: unknown[];
  index_info: unknown[];
  rls_info: PreflightRlsInfoRow[];
  policy_info: PreflightPolicyInfoRow[];
  privilege_info: PreflightPrivilegeInfo;
  row_counts: PreflightRowCounts;
  ops_schema_status: PreflightOpsSchemaStatus;
}

const RLS_REQUIRED_TABLES = ["world_player_cards", "managers", "player_card_analysis"] as const;
const EXPECTED_ROW_COUNTS: Record<keyof PreflightRowCounts, number> = {
  world_player_cards: 13009,
  managers: 66,
  player_card_analysis: 19,
  import_batches: 0, // import_batchesは運用に応じて増えるため、目安がないので個別に判定しない
};

function findRls(result: ProductionReadonlyPreflightResult, table: string): PreflightRlsInfoRow | undefined {
  return result.rls_info.find((r) => r.schema === "reference_data" && r.table === table);
}

function checkSchemaExistence(result: ProductionReadonlyPreflightResult): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  if (!result.schema_info.reference_data_exists) {
    findings.push({
      bucket: "D",
      area: "schema_info",
      message: "reference_dataスキーマが存在しない。Production applyの前提そのものが崩れている。",
    });
  }
  if (result.schema_info.reference_data_ops_exists) {
    findings.push({
      bucket: "C",
      area: "schema_info",
      message: "reference_data_opsが既に存在する(想定は未適用)。staging適用前に内容を確認する必要がある。",
    });
  }
  if (!result.schema_info.public_exists || !result.schema_info.auth_exists) {
    findings.push({
      bucket: "E",
      area: "schema_info",
      message: "public/authスキーマの存在確認が想定と異なる。Supabaseプロジェクト自体の構成を要確認。",
    });
  }
  if (result.ops_schema_status.schema_exists !== result.schema_info.reference_data_ops_exists) {
    findings.push({
      bucket: "E",
      area: "ops_schema_status",
      message: "schema_info.reference_data_ops_existsとops_schema_status.schema_existsが矛盾している。",
    });
  }
  if (!result.schema_info.reference_data_ops_exists && result.ops_schema_status.tables_found.length > 0) {
    findings.push({
      bucket: "E",
      area: "ops_schema_status",
      message: "reference_data_opsスキーマ自体は存在しないのに、tables_foundが空でない矛盾した結果。",
    });
  }
  return findings;
}

function checkRls(result: ProductionReadonlyPreflightResult): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  for (const table of RLS_REQUIRED_TABLES) {
    const row = findRls(result, table);
    if (!row) {
      findings.push({ bucket: "D", area: "rls_info", message: `${table}がrls_infoに存在しない(テーブル自体が無い可能性)。` });
      continue;
    }
    if (!row.rls_enabled || !row.rls_forced) {
      findings.push({
        bucket: "D",
        area: "rls_info",
        message: `${table}のRLSが設計と一致しない(rls_enabled=${row.rls_enabled}, rls_forced=${row.rls_forced}。両方trueである必要がある)。`,
      });
    }
  }
  return findings;
}

function checkPolicies(result: ProductionReadonlyPreflightResult): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  for (const table of RLS_REQUIRED_TABLES) {
    const policies = result.policy_info.filter((p) => p.schema === "reference_data" && p.table === table);
    const selectPolicies = policies.filter((p) => p.command.toUpperCase() === "SELECT");
    if (selectPolicies.length === 0) {
      findings.push({ bucket: "D", area: "policy_info", message: `${table}にSELECTポリシーが存在しない(anon/authenticatedが読めない)。` });
    }
    const writePolicies = policies.filter((p) => ["INSERT", "UPDATE", "DELETE"].includes(p.command.toUpperCase()));
    if (writePolicies.length > 0) {
      findings.push({
        bucket: "D",
        area: "policy_info",
        message: `${table}にINSERT/UPDATE/DELETEポリシーが存在する(想定は読み取り専用)。`,
      });
    }
  }
  return findings;
}

function checkPrivileges(result: ProductionReadonlyPreflightResult): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  for (const row of result.privilege_info.table_grants) {
    if (row.schema !== "reference_data") continue;
    const isAnonOrAuth = row.grantee === "anon" || row.grantee === "authenticated";
    if (!isAnonOrAuth) continue;
    if (row.table === "import_batches") {
      findings.push({
        bucket: "D",
        area: "privilege_info",
        message: `import_batchesへ${row.grantee}への権限(${row.privilege})が付与されている(想定は非公開)。`,
      });
      continue;
    }
    if (row.privilege.toUpperCase() !== "SELECT") {
      findings.push({
        bucket: "D",
        area: "privilege_info",
        message: `${row.table}へ${row.grantee}へSELECT以外の権限(${row.privilege})が付与されている。`,
      });
    }
  }
  return findings;
}

function checkRowCounts(result: ProductionReadonlyPreflightResult): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  for (const key of Object.keys(EXPECTED_ROW_COUNTS) as (keyof PreflightRowCounts)[]) {
    const actual = result.row_counts[key];
    if (typeof actual !== "number" || Number.isNaN(actual) || actual < 0) {
      findings.push({ bucket: "E", area: "row_counts", message: `${key}の件数が数値として読み取れない。` });
      continue;
    }
    if (key === "import_batches") continue; // 運用で増減するため個別の期待値なし
    if (actual === 0) {
      findings.push({ bucket: "D", area: "row_counts", message: `${key}の件数が0件(データが投入されていない可能性)。` });
    } else if (actual !== EXPECTED_ROW_COUNTS[key]) {
      findings.push({
        bucket: "B",
        area: "row_counts",
        message: `${key}の件数が設計文書の想定値(${EXPECTED_ROW_COUNTS[key]})と異なる(実際: ${actual})。データ更新による差分の可能性が高く、設計文書側の更新を検討。`,
      });
    }
  }
  return findings;
}

function checkDatabaseInfo(result: ProductionReadonlyPreflightResult): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  if (!result.database_info.ssl) {
    findings.push({ bucket: "D", area: "database_info", message: "SSL接続が有効になっていない。" });
  }
  return findings;
}

/** read-only preflight SQLの実行結果(本人がSupabase SQL Editorから貼り付けたJSON)を分類する。 */
export function classifyProductionPreflightResult(result: ProductionReadonlyPreflightResult): PreflightFinding[] {
  const findings: PreflightFinding[] = [
    ...checkSchemaExistence(result),
    ...checkRls(result),
    ...checkPolicies(result),
    ...checkPrivileges(result),
    ...checkRowCounts(result),
    ...checkDatabaseInfo(result),
  ];
  if (findings.length === 0) {
    findings.push({ bucket: "A", area: "overall", message: "全項目が設計文書の想定どおり。" });
  }
  return findings;
}
