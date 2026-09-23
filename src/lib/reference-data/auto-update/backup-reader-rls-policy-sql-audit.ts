import type { GuardCheck } from "../real-import-guards";

/**
 * Backup reader専用RLS SELECT policyのSQL案
 * (`docs/production-readiness/sql/create-/rollback-/verify-*-backup-reader-rls-policies*.sql`)の静的監査。
 * 生SQLのテキストだけを検査し、実DB・実ネットワークへは一切接続しない。
 */

export const BACKUP_READER_ROLE = "reference_data_backup_reader";

/** 追加する専用policy(名前とtableの組は固定)。 */
export const BACKUP_READER_POLICIES: ReadonlyArray<{ readonly table: string; readonly policy: string }> = Object.freeze([
  { table: "world_player_cards", policy: "world_player_cards_backup_reader_select" },
  { table: "managers", policy: "managers_backup_reader_select" },
  { table: "player_card_analysis", policy: "player_card_analysis_backup_reader_select" },
  { table: "import_batches", policy: "import_batches_backup_reader_select" },
]);

/** 既存(anon/authenticated向け)で変更してはならないpolicy。 */
export const EXISTING_PUBLIC_READ_POLICIES: ReadonlyArray<{ readonly table: string; readonly policy: string }> = Object.freeze([
  { table: "world_player_cards", policy: "world_player_cards_select_all" },
  { table: "managers", policy: "managers_select_all" },
  { table: "player_card_analysis", policy: "player_card_analysis_select_all" },
]);

/** `--`行コメントを取り除く(文字列リテラル内の`--`は保持する)。 */
export function stripSqlLineComments(sql: string): string {
  let out = "";
  let inQuote = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inQuote) {
      out += ch;
      if (ch === "'") inQuote = false;
      continue;
    }
    if (ch === "'") {
      inQuote = true;
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

/** コメントと単一引用符の文字列リテラルを取り除いた、キーワード検査用のSQL。 */
export function sqlCodeOnly(sql: string): string {
  return stripSqlLineComments(sql).replace(/'(?:[^']|'')*'/g, "''");
}

const DESIGN_BANNER = [/DO NOT RUN/i, /DESIGN ONLY/i, /REQUIRES SEPARATE APPROVAL/i, /PRODUCTION NOT APPLIED/i];
const VERIFY_BANNER = [/READ ONLY/i, /METADATA ONLY/i, /DOES NOT READ USER ROW DATA/i, /DOES NOT READ REFERENCE_DATA ROW DATA/i];

function bannerCheck(rawSql: string, phrases: RegExp[], label: string): GuardCheck {
  const header = rawSql.slice(0, 2500);
  const missing = phrases.filter((re) => !re.test(header));
  return missing.length === 0 ? { ok: true } : { ok: false, reason: `${label}の安全宣言が不足している(${missing.length}項目)` };
}

/** 秘密情報・接続情報・Project Ref等の混入を検査する(全文、コメント含む)。 */
export function assertNoSecretsOrConnectionInfo(rawSql: string): GuardCheck {
  const patterns: Array<[RegExp, string]> = [
    [/postgres(ql)?:\/\//i, "接続文字列"],
    [/https?:\/\//i, "URL"],
    [/supabase\.(co|com|net)/i, "Supabaseホスト名"],
    [/pooler\./i, "pooler hostname"],
    [/\bpassword\b/i, "password"],
    [/eyJ[A-Za-z0-9_-]{10,}/, "JWT様token"],
    [/AGE-SECRET-KEY/i, "age秘密鍵"],
    [/-----BEGIN/i, "PEMブロック"],
    [/\b[a-z]{20}\b/, "Project Ref様の20文字識別子"],
  ];
  for (const [re, label] of patterns) {
    if (re.test(rawSql)) return { ok: false, reason: `${label}らしき文字列が含まれている` };
  }
  return { ok: true };
}

const FORBIDDEN_IN_ALL: Array<[RegExp, string]> = [
  [/\bgrant\b/i, "GRANT"],
  [/\brevoke\b/i, "REVOKE"],
  [/\balter\s+role\b/i, "ALTER ROLE"],
  [/\bcreate\s+role\b/i, "CREATE ROLE"],
  [/\bdrop\s+role\b/i, "DROP ROLE"],
  [/\bbypassrls\b/i, "BYPASSRLS"],
  [/\balter\s+table\b/i, "ALTER TABLE"],
  [/\bdisable\s+row\s+level\s+security\b/i, "DISABLE ROW LEVEL SECURITY"],
  [/\bno\s+force\s+row\s+level\s+security\b/i, "NO FORCE ROW LEVEL SECURITY"],
  [/\bdrop\s+table\b/i, "DROP TABLE"],
  [/\bdrop\s+schema\b/i, "DROP SCHEMA"],
  [/\balter\s+policy\b/i, "ALTER POLICY"],
  [/\bowner\s+to\b/i, "OWNER TO"],
  [/\bexecute\b/i, "動的SQL(EXECUTE)"],
  [/\bformat\s*\(/i, "動的SQL(format)"],
  [/\bcascade\b/i, "CASCADE"],
  [/\bsecurity\s+definer\b/i, "SECURITY DEFINER"],
  [/\b(insert|update|delete|truncate)\b/i, "書込み文"],
  [/\bset\s+role\b/i, "SET ROLE"],
];

function forbiddenCheck(code: string, extra: Array<[RegExp, string]> = []): GuardCheck {
  for (const [re, label] of [...FORBIDDEN_IN_ALL, ...extra]) {
    if (re.test(code)) return { ok: false, reason: `禁止された構文(${label})が含まれている` };
  }
  return { ok: true };
}

/** 利用者データ・auth系テーブルを行データとして参照していないことを確認する。 */
function noUserDataRowReference(code: string): GuardCheck {
  if (/\bfrom\s+(auth|public)\./i.test(code) || /\bjoin\s+(auth|public)\./i.test(code)) {
    return { ok: false, reason: "auth/public schemaのテーブルを行データとして参照している" };
  }
  if (/\bfrom\s+reference_data\./i.test(code) || /\bjoin\s+reference_data\./i.test(code)) {
    return { ok: false, reason: "reference_dataの行データを参照している" };
  }
  return { ok: true };
}

function transactionCheck(code: string): GuardCheck {
  const trimmed = code.trim().toLowerCase();
  if (!/^begin\s*;/.test(trimmed) || !/commit\s*;\s*$/.test(trimmed)) {
    return { ok: false, reason: "begin;で始まりcommit;で終わるtransactionになっていない" };
  }
  return { ok: true };
}

/** Apply SQLの`create policy`文を、固定の4件と完全に一致する形でのみ許可する。 */
export function assertApplyCreatesExactlyFourSelectOnlyPolicies(rawSql: string): GuardCheck {
  const code = sqlCodeOnly(rawSql);
  const statements = [...code.matchAll(/\bcreate\s+policy\b[\s\S]*?;/gi)].map((m) => m[0].replace(/\s+/g, " ").trim().toLowerCase());
  if (statements.length !== BACKUP_READER_POLICIES.length) {
    return { ok: false, reason: `create policyが${BACKUP_READER_POLICIES.length}件ではない(${statements.length}件)` };
  }
  for (const { table, policy } of BACKUP_READER_POLICIES) {
    const expected = `create policy ${policy} on reference_data.${table} as permissive for select to ${BACKUP_READER_ROLE} using (true);`;
    if (!statements.includes(expected)) {
      return { ok: false, reason: `${policy}が想定の定義(SELECT・PERMISSIVE・${BACKUP_READER_ROLE}だけ・USING (true))と一致しない` };
    }
  }
  if (/\bwith\s+check\b/i.test(code)) return { ok: false, reason: "WITH CHECKが含まれている" };
  return { ok: true };
}

/** Rollback SQLの`drop policy`文を、固定の4件と完全に一致する形でのみ許可する。 */
export function assertRollbackDropsOnlyFourBackupPolicies(rawSql: string): GuardCheck {
  const code = sqlCodeOnly(rawSql);
  const statements = [...code.matchAll(/\bdrop\s+policy\b[\s\S]*?;/gi)].map((m) => m[0].replace(/\s+/g, " ").trim().toLowerCase());
  if (statements.length !== BACKUP_READER_POLICIES.length) {
    return { ok: false, reason: `drop policyが${BACKUP_READER_POLICIES.length}件ではない(${statements.length}件)` };
  }
  for (const { table, policy } of BACKUP_READER_POLICIES) {
    if (!statements.includes(`drop policy ${policy} on reference_data.${table};`)) {
      return { ok: false, reason: `${policy}のdrop文が想定(IF EXISTS/CASCADE無し・固定table)と一致しない` };
    }
  }
  for (const { policy } of EXISTING_PUBLIC_READ_POLICIES) {
    if (statements.some((s) => s.includes(` ${policy} `))) {
      return { ok: false, reason: `既存policy(${policy})を削除しようとしている` };
    }
  }
  if (/\bcreate\s+policy\b/i.test(code)) return { ok: false, reason: "rollbackにcreate policyが含まれている" };
  return { ok: true };
}

/** 対象外のrole(anon/authenticated/PUBLIC/service_role/postgres)を新たな対象にしていないことを確認する。 */
export function assertNoRoleWideningInPolicies(rawSql: string): GuardCheck {
  const code = sqlCodeOnly(rawSql);
  const toClauses = [...code.matchAll(/\bcreate\s+policy\b[\s\S]*?\bto\s+([\w\s,]+?)\s+using\b/gi)].map((m) => m[1].trim().toLowerCase());
  for (const clause of toClauses) {
    if (clause !== BACKUP_READER_ROLE) {
      return { ok: false, reason: `policyの対象roleが${BACKUP_READER_ROLE}だけではない(${clause})` };
    }
  }
  return { ok: true };
}

export function auditApplyPolicySql(rawSql: string): GuardCheck[] {
  const code = sqlCodeOnly(rawSql);
  return [
    bannerCheck(rawSql, DESIGN_BANNER, "apply SQL"),
    transactionCheck(code),
    forbiddenCheck(code, [[/\bdrop\s+policy\b/i, "DROP POLICY"]]),
    assertApplyCreatesExactlyFourSelectOnlyPolicies(rawSql),
    assertNoRoleWideningInPolicies(rawSql),
    noUserDataRowReference(code),
    assertNoSecretsOrConnectionInfo(rawSql),
  ];
}

export function auditRollbackPolicySql(rawSql: string): GuardCheck[] {
  const code = sqlCodeOnly(rawSql);
  return [
    bannerCheck(rawSql, DESIGN_BANNER, "rollback SQL"),
    transactionCheck(code),
    forbiddenCheck(code, [[/\bdrop\s+policy\s+if\s+exists\b/i, "DROP POLICY IF EXISTS"]]),
    assertRollbackDropsOnlyFourBackupPolicies(rawSql),
    noUserDataRowReference(code),
    assertNoSecretsOrConnectionInfo(rawSql),
  ];
}

/** 確認用SQLがmetadataだけを読む単一のSELECT/WITH文であることを確認する。 */
export function auditPolicyVerifySql(rawSql: string): GuardCheck[] {
  const code = sqlCodeOnly(rawSql);
  const trimmed = code.trim().toLowerCase();
  const statementCount = code.split(";").filter((s) => s.trim().length > 0).length;
  return [
    bannerCheck(rawSql, VERIFY_BANNER, "確認用SQL"),
    /^(with|select)\b/.test(trimmed) && statementCount === 1
      ? { ok: true }
      : { ok: false, reason: "確認用SQLが単一のSELECT/WITH文ではない" },
    forbiddenCheck(code, [
      [/\b(create|drop)\b/i, "CREATE/DROP"],
      [/\bdo\s+\$\$/i, "DOブロック"],
      [/\bbegin\b/i, "transaction制御"],
    ]),
    noUserDataRowReference(code),
    /to_regclass\(/i.test(code) && /to_regrole\(/i.test(code)
      ? { ok: true }
      : { ok: false, reason: "to_regclass/to_regroleによる安全な存在確認を使っていない" },
    assertNoSecretsOrConnectionInfo(rawSql),
  ];
}
