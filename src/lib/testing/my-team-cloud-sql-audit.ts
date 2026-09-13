import { splitSqlStatements } from "./sql-statement-split";

/**
 * `docs/production-readiness/sql/create-my-team-cloud-schema.sql`の安全性を
 * 構造的に検証する純関数。`rls-probe-sql-audit.ts`と同じ方針
 * (`splitSqlStatements`で個々のSQL文へ分割し、各CREATE POLICY文自身の
 * USING/WITH CHECK句を検証する)を、`my_team_snapshots`向けに適用する。
 */
export interface MyTeamCloudSqlAuditResult {
  ok: boolean;
  issues: string[];
}

const TRUE_POLICY_RE = /\b(using|with\s+check)\s*\(\s*true\s*\)/i;
const SERVICE_ROLE_RE = /service_role/i;
const SECRET_LIKE_RE = /sb_secret_|(?<![A-Za-z0-9_])eyJ[A-Za-z0-9_-]/;
const EMAIL_COLUMN_RE = /\bemail\b/i;
const DYNAMIC_SQL_RE = /\bexecute\s+(format\s*\(|'|")/i;
const AUTH_USERS_MUTATION_RE = /\b(alter|drop|truncate)\s+table\s+(?:public\.)?auth\.users\b/i;
const SYSTEM_SCHEMA_MUTATION_RE = /\b(alter|drop)\s+schema\s+(auth|storage|realtime|extensions|graphql|graphql_public|pgsodium|vault)\b/i;

function findPolicyStatement(statements: string[], tableName: string, kind: string): string | undefined {
  const policyRe = new RegExp(`create\\s+policy\\s+\\S+\\s+on\\s+(?:public\\.)?${tableName}\\b`, "i");
  const kindRe = new RegExp(`for\\s+${kind}\\b`, "i");
  return statements.find((s) => policyRe.test(s) && kindRe.test(s));
}

function usingHasAuthUid(stmt: string): boolean {
  return /using\s*\([^)]*auth\.uid\(\)[^)]*\)/is.test(stmt);
}
function withCheckHasAuthUid(stmt: string): boolean {
  return /with\s+check\s*\([^)]*auth\.uid\(\)[^)]*\)/is.test(stmt);
}

export function auditMyTeamCloudSql(sql: string, tableName = "my_team_snapshots"): MyTeamCloudSqlAuditResult {
  const issues: string[] = [];
  const statements = splitSqlStatements(sql);

  const enableRlsRe = new RegExp(`alter\\s+table\\s+(?:public\\.)?${tableName}\\s+enable\\s+row\\s+level\\s+security`, "i");
  if (!statements.some((s) => enableRlsRe.test(s))) {
    issues.push("RLSが有効化されていません(ENABLE ROW LEVEL SECURITY)");
  }
  const forceRlsRe = new RegExp(`alter\\s+table\\s+(?:public\\.)?${tableName}\\s+force\\s+row\\s+level\\s+security`, "i");
  if (!statements.some((s) => forceRlsRe.test(s))) {
    issues.push("FORCE ROW LEVEL SECURITYが設定されていません");
  }

  const kinds = ["select", "insert", "update", "delete"] as const;
  for (const kind of kinds) {
    const stmt = findPolicyStatement(statements, tableName, kind);
    if (!stmt) {
      issues.push(`${kind.toUpperCase()}ポリシーが見つかりません`);
      continue;
    }
    const roleListMatch = /\bto\s+([\s\S]*?)(?:\busing\b|\bwith\s+check\b|$)/i.exec(stmt);
    const roleList = roleListMatch ? roleListMatch[1] : "";
    const roles = roleList
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);
    if (!roles.includes("authenticated")) {
      issues.push(`${kind.toUpperCase()}ポリシーがauthenticatedロール限定になっていません`);
    }
    if (roles.includes("public") || roles.includes("anon")) {
      issues.push(`${kind.toUpperCase()}ポリシーがpublic/anonへ許可されています`);
    }
    if (TRUE_POLICY_RE.test(stmt)) {
      issues.push(`${kind.toUpperCase()}ポリシーに無条件許可(USING/WITH CHECK (true))が含まれています`);
    }

    if (kind === "select" || kind === "delete") {
      if (!usingHasAuthUid(stmt)) issues.push(`${kind.toUpperCase()}ポリシーのUSING句にauth.uid()条件がありません`);
    }
    if (kind === "insert") {
      if (!withCheckHasAuthUid(stmt)) issues.push("INSERTポリシーのWITH CHECK句にauth.uid()条件がありません");
    }
    if (kind === "update") {
      if (!usingHasAuthUid(stmt)) issues.push("UPDATEポリシーのUSING句にauth.uid()条件がありません");
      if (!withCheckHasAuthUid(stmt)) issues.push("UPDATEポリシーのWITH CHECK句にauth.uid()条件がありません");
    }
  }

  const grantStatements = statements.filter((s) => /^grant\b/i.test(s));
  const tableGrantRe = new RegExp(`\\bon\\s+(?:public\\.)?${tableName}\\b`, "i");
  for (const g of grantStatements) {
    if (tableGrantRe.test(g) && /\bto\s+(?:public|anon)\b/i.test(g)) {
      issues.push("anon/publicへGRANTしています");
    }
  }

  if (SERVICE_ROLE_RE.test(sql)) issues.push("service_roleへの言及があります");
  if (SECRET_LIKE_RE.test(sql)) issues.push("Secret key/JWT形式に見える文字列が含まれています");

  const createTableRe = new RegExp(`create\\s+table[^;]*${tableName}`, "is");
  const createTableStmt = statements.find((s) => createTableRe.test(s));
  if (createTableStmt) {
    if (EMAIL_COLUMN_RE.test(createTableStmt)) issues.push("テーブルにemailカラムが含まれています(所有者判定に使うべきではない)");
    if (!/user_id\s+uuid\s+not\s+null/i.test(createTableStmt)) issues.push("user_idにNOT NULL制約がありません");
    if (!/unique\s*\(\s*user_id\s*\)/i.test(createTableStmt)) issues.push("user_idにunique制約がありません(1ユーザー1行の前提が崩れます)");
    if (!/schema_version\s+text\s+not\s+null/i.test(createTableStmt)) issues.push("schema_versionにNOT NULL制約がありません");
    if (!/team_data\s+jsonb\s+not\s+null/i.test(createTableStmt)) issues.push("team_dataがNOT NULLのjsonb型になっていません");
    if (!/item_count\s+integer\s+not\s+null/i.test(createTableStmt)) issues.push("item_countにNOT NULL制約がありません");
    if (!/item_count\s*>=\s*0/i.test(createTableStmt) || !/item_count\s*<=\s*\d+/i.test(createTableStmt)) {
      issues.push("item_countの上下限チェック制約が見つかりません");
    }
    if (!/item_count\s*=\s*jsonb_array_length/i.test(createTableStmt)) {
      issues.push("item_countとteam_data内配列長を一致させるチェック制約が見つかりません");
    }
  } else {
    issues.push("CREATE TABLE文が見つかりません");
  }

  if (!/default\s+auth\.uid\(\)/i.test(sql)) {
    issues.push("user_idの既定値にauth.uid()が使われていません");
  }

  if (DYNAMIC_SQL_RE.test(sql)) issues.push("動的SQL(EXECUTE)の使用が疑われます");

  const functionStatements = statements.filter((s) => /create\s+(?:or\s+replace\s+)?function\b/i.test(s));
  if (functionStatements.length === 0) {
    issues.push("user_id書き換え防止トリガー関数が見つかりません");
  }
  for (const fn of functionStatements) {
    if (/security\s+definer/i.test(fn)) {
      issues.push("SECURITY DEFINER関数が使われています(必要性の明示的な確認が必要)");
    }
    if (!/set\s+search_path\s*=/i.test(fn)) {
      issues.push("関数にsearch_pathの固定設定がありません");
    }
  }

  if (AUTH_USERS_MUTATION_RE.test(sql)) issues.push("auth.usersを変更/削除/切り詰める文が含まれています");
  if (SYSTEM_SCHEMA_MUTATION_RE.test(sql)) issues.push("Supabaseのシステムスキーマを変更/削除する文が含まれています");

  return { ok: issues.length === 0, issues };
}
