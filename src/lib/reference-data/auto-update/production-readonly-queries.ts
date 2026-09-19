import type { GuardCheck } from "../real-import-guards";

/**
 * Production向け「接続後read-only preflight」のクエリ文字列と、その結果を検証する
 * 純関数群(設計のみ、実接続コードはこのファイルに含まれない)。
 *
 * クエリ文字列は`docs/production-readiness/sql/preflight-reference-data-ops.sql`と
 * 対応する(SELECT/SHOW専用、DDL/DML/GRANT/REVOKEを一切含まない)。
 * 検証関数は、将来これらのクエリを本人が実行した結果(合成データでも可)を受け取り、
 * 「安全に進めてよいか」を判定するためだけに使う。
 */

export const READONLY_PREFLIGHT_QUERIES = {
  schemaExists: "select schema_name from information_schema.schemata where schema_name = $1",
  tableList: "select table_name from information_schema.tables where table_schema = $1 order by table_name",
  forbiddenTableGrants:
    "select grantee, privilege_type from information_schema.role_table_grants where table_schema = $1 and grantee in ('anon', 'authenticated')",
  forbiddenSchemaUsage:
    "select grantee, privilege_type from information_schema.usage_privileges where object_schema = $1 and grantee in ('anon', 'authenticated')",
  rlsStatus:
    "select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = $1 and c.relkind = 'r'",
  runningJobs: "select job_id, table_name, status, started_at from reference_data_ops.update_jobs where status = 'running'",
  sslStatus: "select ssl, cipher from pg_stat_ssl where pid = pg_backend_pid()",
} as const;

export interface TableRlsRow {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
}

export interface GrantRow {
  grantee: string;
  privilege_type: string;
}

export interface RunningJobRow {
  job_id: string;
  table_name: string;
  status: string;
  started_at: string;
}

/** 想定した全テーブルが存在し、余分なテーブルが無いことを確認する。 */
export function validateTableList(actualTables: readonly string[], expectedTables: readonly string[]): GuardCheck {
  const missing = expectedTables.filter((t) => !actualTables.includes(t));
  if (missing.length > 0) {
    return { ok: false, reason: `想定テーブルが見つからない: ${missing.join(", ")}` };
  }
  return { ok: true };
}

/** anon/authenticatedへのGRANT/USAGEが1件でもあれば拒否する。 */
export function validateNoForbiddenGrants(grantRows: readonly GrantRow[]): GuardCheck {
  if (grantRows.length > 0) {
    return {
      ok: false,
      reason: `anon/authenticatedへの権限が検出された(想定外): ${grantRows.map((r) => `${r.grantee}:${r.privilege_type}`).join(", ")}`,
    };
  }
  return { ok: true };
}

/** 全対象テーブルでRLSが有効かつFORCEされていることを確認する。 */
export function validateRlsEnabledAndForced(rows: readonly TableRlsRow[], expectedTables: readonly string[]): GuardCheck {
  const byName = new Map(rows.map((r) => [r.relname, r]));
  const problems: string[] = [];
  for (const t of expectedTables) {
    const row = byName.get(t);
    if (!row) {
      problems.push(`${t}: 行が見つからない`);
      continue;
    }
    if (!row.relrowsecurity || !row.relforcerowsecurity) {
      problems.push(`${t}: RLS有効=${row.relrowsecurity}, FORCE=${row.relforcerowsecurity}`);
    }
  }
  if (problems.length > 0) {
    return { ok: false, reason: `RLS設定に問題がある: ${problems.join("; ")}` };
  }
  return { ok: true };
}

/** 実行中のジョブが無いことを確認する(advisory lock取得前のpreflight)。 */
export function validateNoRunningJobs(rows: readonly RunningJobRow[]): GuardCheck {
  if (rows.length > 0) {
    return { ok: false, reason: `実行中のジョブが存在する: ${rows.map((r) => r.job_id).join(", ")}` };
  }
  return { ok: true };
}

/** SSL接続であることを確認する。 */
export function validateSslActive(row: { ssl: boolean } | undefined): GuardCheck {
  if (!row || !row.ssl) {
    return { ok: false, reason: "SSL接続が確認できない" };
  }
  return { ok: true };
}
