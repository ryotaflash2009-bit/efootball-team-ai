import { splitSqlStatements } from "./sql-statement-split";

/**
 * Supabase Advisor対応(Auth RLS Initialization Plan最適化 / rls_auto_enable()の
 * 不要なEXECUTE権限REVOKE)向けSQLの安全性を構造的に検証する純関数群。
 *
 * `rls-probe-sql-audit.ts`・`my-team-cloud-sql-audit.ts`はCREATE TABLE/CREATE POLICY
 * (新規作成)を前提とした監査であり、本ファイルが対象とするALTER POLICY/REVOKE/GRANTだけの
 * 差分SQL(既存オブジェクトの一部だけを書き換える)には構造が異なるため流用せず、
 * 専用の監査関数として新設する。
 *
 * 実Supabaseへは一切接続しない(SQL文字列だけを検証する純関数)。
 */

export interface SqlAuditResult {
  ok: boolean;
  issues: string[];
}

const SERVICE_ROLE_RE = /service_role/i;
const SECRET_LIKE_RE = /sb_secret_|(?<![A-Za-z0-9_])eyJ[A-Za-z0-9_-]/;
const AUTH_USERS_MUTATION_RE = /\b(alter|drop|truncate)\s+table\s+(?:public\.)?auth\.users\b/i;
const SYSTEM_SCHEMA_MUTATION_RE = /\b(alter|drop)\s+schema\s+(auth|storage|realtime|extensions|graphql|graphql_public|pgsodium|vault)\b/i;
const DESTRUCTIVE_RE = /\b(drop\s+table|truncate|delete\s+from|insert\s+into)\b/i;
const ANON_PUBLIC_GRANT_RE = /\bto\s+(?:public|anon)\b/i;

/**
 * `--`行コメントを取り除く(`splitSqlStatements`はコメントを次の実文へそのまま
 * 連結する設計のため、構造チェックをコメント本文の説明的な言い回しに惑わされず
 * 実際のSQLコードだけに対して行うための前処理)。`'...'`文字列リテラル内の`--`は
 * 対象にしない(このファイル群にそのようなリテラルは登場しないが、念のため
 * シングルクォート状態を追跡する)。
 */
function stripLineComments(sql: string): string {
  let out = "";
  let inSingleQuote = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inSingleQuote) {
      out += ch;
      if (ch === "'") inSingleQuote = false;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      out += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      if (nl === -1) break;
      i = nl - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * `optimize-auth-rls-initplan.sql`/`rollback-auth-rls-initplan.sql`向け監査。
 *
 * @param rawSql 監査対象SQL全文
 * @param expectAuthUidWrapped true: `(select auth.uid())`形式を要求(最適化版)。
 *   false: 素の`auth.uid()`形式を要求(ロールバック版)。
 */
export function auditAuthRlsInitplanSql(rawSql: string, expectAuthUidWrapped: boolean): SqlAuditResult {
  const issues: string[] = [];
  const sql = stripLineComments(rawSql);
  const statements = splitSqlStatements(sql).filter((s) => s.trim().length > 0);

  const expectedPolicies: { name: string; table: string; hasUsing: boolean; hasWithCheck: boolean }[] = [
    { name: "rls_probe_records_select_own", table: "rls_probe_records", hasUsing: true, hasWithCheck: false },
    { name: "rls_probe_records_insert_own", table: "rls_probe_records", hasUsing: false, hasWithCheck: true },
    { name: "rls_probe_records_update_own", table: "rls_probe_records", hasUsing: true, hasWithCheck: true },
    { name: "rls_probe_records_delete_own", table: "rls_probe_records", hasUsing: true, hasWithCheck: false },
    { name: "my_team_snapshots_select_own", table: "my_team_snapshots", hasUsing: true, hasWithCheck: false },
    { name: "my_team_snapshots_insert_own", table: "my_team_snapshots", hasUsing: false, hasWithCheck: true },
    { name: "my_team_snapshots_update_own", table: "my_team_snapshots", hasUsing: true, hasWithCheck: true },
    { name: "my_team_snapshots_delete_own", table: "my_team_snapshots", hasUsing: true, hasWithCheck: false },
  ];

  if (!/\bbegin\b/i.test(sql)) issues.push("BEGINで開始していません(トランザクション境界がない)");
  if (!/\bcommit\b/i.test(sql)) issues.push("COMMITで終了していません(トランザクション境界がない)");

  const alterPolicyStatements = statements.filter((s) => /\balter\s+policy\b/i.test(s));
  if (alterPolicyStatements.length !== expectedPolicies.length) {
    issues.push(`ALTER POLICY文の数が想定と異なる(想定${expectedPolicies.length}件、実際${alterPolicyStatements.length}件)`);
  }

  for (const p of expectedPolicies) {
    const nameRe = new RegExp(`alter\\s+policy\\s+${p.name}\\s+on\\s+(?:public\\.)?${p.table}\\b`, "i");
    const stmt = alterPolicyStatements.find((s) => nameRe.test(s));
    if (!stmt) {
      issues.push(`ポリシー${p.name}を書き換えるALTER POLICY文が見つかりません`);
      continue;
    }
    if (p.hasUsing) {
      const usingMatch = /using\s*\(([^;]*?)\)(?:\s*with\s+check|\s*$)/is.exec(stmt);
      if (!usingMatch) {
        issues.push(`${p.name}: USING句が見つかりません`);
      } else {
        const clause = usingMatch[1];
        if (!/user_id\s*=/.test(clause)) issues.push(`${p.name}: USING句にuser_id比較が見つかりません`);
        const wrapped = /\(\s*select\s+auth\.uid\(\)\s*\)/i.test(clause);
        const bare = /(?<!\(select\s)auth\.uid\(\)/i.test(clause);
        if (expectAuthUidWrapped && !wrapped) issues.push(`${p.name}: USING句が(select auth.uid())形式になっていません`);
        if (!expectAuthUidWrapped && (!bare || wrapped)) issues.push(`${p.name}: USING句が素のauth.uid()形式になっていません`);
      }
    }
    if (p.hasWithCheck) {
      const checkMatch = /with\s+check\s*\(([^;]*?)\)\s*$/is.exec(stmt);
      if (!checkMatch) {
        issues.push(`${p.name}: WITH CHECK句が見つかりません`);
      } else {
        const clause = checkMatch[1];
        if (!/user_id\s*=/.test(clause)) issues.push(`${p.name}: WITH CHECK句にuser_id比較が見つかりません`);
        const wrapped = /\(\s*select\s+auth\.uid\(\)\s*\)/i.test(clause);
        const bare = /(?<!\(select\s)auth\.uid\(\)/i.test(clause);
        if (expectAuthUidWrapped && !wrapped) issues.push(`${p.name}: WITH CHECK句が(select auth.uid())形式になっていません`);
        if (!expectAuthUidWrapped && (!bare || wrapped)) issues.push(`${p.name}: WITH CHECK句が素のauth.uid()形式になっていません`);
      }
    }
    if (ANON_PUBLIC_GRANT_RE.test(stmt)) issues.push(`${p.name}: anon/publicへのロール変更が含まれています`);
  }

  for (const s of statements) {
    if (DESTRUCTIVE_RE.test(s)) issues.push(`破壊的操作の疑いがある文が含まれています: ${s.slice(0, 60)}`);
  }
  if (/\bcreate\s+table\b|\bdrop\s+table\b|\bcreate\s+policy\b|\bdrop\s+policy\b/i.test(sql)) {
    issues.push("CREATE/DROP TABLE・CREATE/DROP POLICYが含まれています(本SQLは既存ポリシーの書き換えのみを想定)");
  }
  if (SERVICE_ROLE_RE.test(sql)) issues.push("service_roleへの言及があります");
  if (SECRET_LIKE_RE.test(sql)) issues.push("Secret key/JWT形式に見える文字列が含まれています");
  if (AUTH_USERS_MUTATION_RE.test(sql)) issues.push("auth.usersを変更/削除/切り詰める文が含まれています");
  if (SYSTEM_SCHEMA_MUTATION_RE.test(sql)) issues.push("Supabaseのシステムスキーマを変更/削除する文が含まれています");

  return { ok: issues.length === 0, issues };
}

/**
 * `revoke-rls-auto-enable-public-execute.sql`/
 * `rollback-revoke-rls-auto-enable-public-execute.sql`向け監査。
 */
export function auditRlsAutoEnableExecuteSql(rawSql: string): SqlAuditResult {
  const issues: string[] = [];
  const sql = stripLineComments(rawSql);
  const statements = splitSqlStatements(sql).filter((s) => s.trim().length > 0);

  if (!/\bbegin\b/i.test(sql)) issues.push("BEGINで開始していません");
  if (!/\bcommit\b/i.test(sql)) issues.push("COMMITで終了していません");

  const targetRe = /function\s+public\.rls_auto_enable\(\)/i;
  const revokeOrGrant = statements.filter((s) => /\b(revoke|grant)\s+execute\b/i.test(s));
  if (revokeOrGrant.length === 0) {
    issues.push("REVOKE EXECUTE / GRANT EXECUTE文が見つかりません");
  }
  if (revokeOrGrant.length > 1) {
    issues.push(`REVOKE/GRANT EXECUTE文が複数あります(想定は1件だけ、実際${revokeOrGrant.length}件)`);
  }
  for (const s of revokeOrGrant) {
    if (!targetRe.test(s)) {
      issues.push(`対象関数がpublic.rls_auto_enable()に限定されていない文があります: ${s.slice(0, 60)}`);
      continue;
    }
    // 実測(2026-09-18)で確認された権限状態: PUBLICのみがEXECUTEを保有し、
    // anon/authenticatedはPUBLIC経由の継承だけだったため、対象ロールは
    // publicだけであるべき(anon/authenticated/postgresへの個別REVOKE/GRANTは不要かつ不一致)。
    const withoutTarget = s.replace(targetRe, "");
    const roleMatch = /\b(?:from|to)\s+([a-z_][a-z0-9_]*)\b/i.exec(withoutTarget);
    if (!roleMatch) {
      issues.push(`REVOKE/GRANT文に対象ロール(from/to)が見つかりません: ${s.slice(0, 60)}`);
    } else if (roleMatch[1].toLowerCase() !== "public") {
      issues.push(`対象ロールがpublic以外です(実測状態と不一致、想定はpublicのみ): ${roleMatch[1]}`);
    }
  }
  if (/\b(revoke|grant)\s+execute\b[^;]*\b(from|to)\s+(anon|authenticated|postgres)\b/i.test(sql)) {
    issues.push("anon/authenticated/postgresを対象としたEXECUTE権限変更が含まれています(実測状態では不要)");
  }

  if (/\bdrop\s+function\b|\balter\s+function\b|\bcreate\s+(?:or\s+replace\s+)?function\b/i.test(sql)) {
    issues.push("関数の削除・変更・再作成が含まれています(本SQLはEXECUTE権限の変更のみを想定)");
  }
  if (DESTRUCTIVE_RE.test(sql)) {
    issues.push("破壊的操作またはデータ操作が含まれています");
  }
  if (/\bdrop\s+event\s+trigger\b/i.test(sql)) {
    issues.push("Event Triggerの削除が疑われます");
  }
  if (SERVICE_ROLE_RE.test(sql)) issues.push("service_roleへの言及があります");
  if (SECRET_LIKE_RE.test(sql)) issues.push("Secret key/JWT形式に見える文字列が含まれています");
  if (AUTH_USERS_MUTATION_RE.test(sql)) issues.push("auth.usersを変更/削除/切り詰める文が含まれています");
  if (SYSTEM_SCHEMA_MUTATION_RE.test(sql)) issues.push("Supabaseのシステムスキーマを変更/削除する文が含まれています");

  return { ok: issues.length === 0, issues };
}
