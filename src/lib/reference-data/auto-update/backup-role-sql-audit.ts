import type { GuardCheck } from "../real-import-guards";
import { BACKUP_TARGET_TABLES } from "./backup-target";

/**
 * Backup専用read-only role(reference_data_backup_reader)のSQL案
 * (`docs/production-readiness/sql/create-reference-data-backup-role.sql`・
 * `verify-reference-data-backup-role.sql`・`rollback-reference-data-backup-role.sql`)の
 * 静的監査。生SQLファイルのテキストを対象に検査する(`production-ops-sql-audit.ts`と
 * 同じ方針)。このモジュール自体は実DB・実ネットワークへ一切接続しない。
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

const CREATE_ROLLBACK_BANNER_PHRASES = [/DO NOT RUN/i, /DESIGN ONLY/i, /REQUIRES SEPARATE APPROVAL/i, /PRODUCTION NOT APPLIED/i];
const CREATE_ONLY_BANNER_PHRASES = [/DOES NOT CREATE OR STORE A PASSWORD/i, /DOES NOT GRANT USER-DATA ACCESS/i];
const VERIFY_BANNER_PHRASES = [/READ ONLY/i, /METADATA ONLY/i, /DOES NOT READ USER ROW DATA/i];

/** role作成SQL/rollback SQL共通の安全宣言(DO NOT RUN等4項目)を確認する。 */
export function assertHasRoleSafetyBanner(rawSql: string): GuardCheck {
  const header = rawSql.slice(0, 2000);
  const missing = CREATE_ROLLBACK_BANNER_PHRASES.filter((re) => !re.test(header));
  if (missing.length > 0) {
    return { ok: false, reason: `role作成/rollback SQL共通の安全宣言が不足している(${missing.length}項目)` };
  }
  return { ok: true };
}

/** role作成SQL専用の追加安全宣言(パスワード非生成・利用者データ非付与)を確認する。 */
export function assertHasCreateRoleBanner(rawSql: string): GuardCheck {
  const header = rawSql.slice(0, 2000);
  const missing = CREATE_ONLY_BANNER_PHRASES.filter((re) => !re.test(header));
  if (missing.length > 0) {
    return { ok: false, reason: `role作成SQL専用の安全宣言が不足している(${missing.length}項目)` };
  }
  return { ok: true };
}

/** 確認用SQL専用の安全宣言(READ ONLY/METADATA ONLY等)を確認する。 */
export function assertHasVerifySqlBanner(rawSql: string): GuardCheck {
  const header = rawSql.slice(0, 2000);
  const missing = VERIFY_BANNER_PHRASES.filter((re) => !re.test(header));
  if (missing.length > 0) {
    return { ok: false, reason: `確認用SQL専用の安全宣言が不足している(${missing.length}項目)` };
  }
  return { ok: true };
}

/** password句(literal)が一切含まれていないことを確認する。 */
export function assertNoPasswordLiteral(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  if (/\bpassword\s+'/i.test(sql) || /\bpassword\s*=/i.test(sql)) {
    return { ok: false, reason: "password句(literal)が含まれている(このSQLはパスワードを設定しない設計)" };
  }
  return { ok: true };
}

/** 接続文字列・Project ID・メールアドレス・token・API keyらしき文字列が含まれていないことを確認する。 */
export function assertNoConnectionInfoOrSecrets(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  const patterns: { name: string; re: RegExp }[] = [
    { name: "postgres接続文字列", re: /postgres(?:ql)?:\/\/\S+/i },
    { name: "Supabaseホスト名", re: /\bsupabase\.co\b/i },
    { name: "メールアドレス", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
    { name: "service role key様文字列", re: /sb_secret_/i },
    { name: "JWT様トークン", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
    { name: "api_key様文字列", re: /api[_-]?key\s*[:=]/i },
  ];
  for (const p of patterns) {
    if (p.re.test(sql)) {
      return { ok: false, reason: `${p.name}が含まれている` };
    }
  }
  return { ok: true };
}

/** 利用者データテーブル・reference_data_ops・public schema全体への参照を含まないことを確認する。 */
export function assertNoUserDataOrOpsSchemaReference(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  if (/\b(auth\.users|my_team_snapshots|rls_probe_records)\b/i.test(sql)) {
    return { ok: false, reason: "利用者データテーブルへの参照が含まれている" };
  }
  if (/\bgrant\b[^;]*\breference_data_ops\b/i.test(sql)) {
    return { ok: false, reason: "reference_data_opsへの権限付与が含まれている" };
  }
  if (/\bgrant\b[^;]*\bon\s+schema\s+public\b/i.test(sql) || /\bgrant\b[^;]*\ball\s+tables\s+in\s+schema\s+public\b/i.test(sql)) {
    return { ok: false, reason: "public schema全体への権限付与が含まれている" };
  }
  return { ok: true };
}

const ELEVATED_PRIVILEGE_WORDS = ["superuser", "createdb", "createrole", "replication", "bypassrls"] as const;

/** SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLSが、NOの否定形以外で出現していないことを確認する。 */
export function assertNoElevatedPrivilegeGranted(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  for (const word of ELEVATED_PRIVILEGE_WORDS) {
    // "no"+word(例: nosuperuser)、または直前が"no "(例: no superuser)は許容する。
    const re = new RegExp(`(?<!no)(?<!no )\\b${word}\\b`, "i");
    if (re.test(sql)) {
      return { ok: false, reason: `${word.toUpperCase()}がNOの否定形以外で出現している(付与されている疑い)` };
    }
  }
  return { ok: true };
}

const ALLOWED_GRANT_PRIVILEGES = new Set(["select", "usage"]);
const FORBIDDEN_GRANT_KEYWORDS = ["insert", "update", "delete", "truncate", "references", "trigger", "all", "all privileges"];

/** GRANT文が付与する権限が、SELECT/USAGEだけであることを確認する(GRANT OPTION・広範なALL PRIVILEGESも拒否)。 */
export function assertGrantsAreSelectOrUsageOnly(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  const grantStatements = sql.match(/\bgrant\b[\s\S]*?;/gi) ?? [];
  for (const stmt of grantStatements) {
    if (/\bwith\s+grant\s+option\b/i.test(stmt)) {
      return { ok: false, reason: "GRANT OPTIONを伴うGRANT文が含まれている" };
    }
    const beforeOn = stmt.toLowerCase().split(/\bon\b/)[0];
    for (const forbidden of FORBIDDEN_GRANT_KEYWORDS) {
      const re = new RegExp(`\\b${forbidden}\\b`, "i");
      if (re.test(beforeOn)) {
        return { ok: false, reason: `GRANT文にSELECT/USAGE以外の権限(${forbidden.toUpperCase()})が含まれている` };
      }
    }
    void ALLOWED_GRANT_PRIVILEGES;
  }
  return { ok: true };
}

export function assertNoDynamicSql(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  if (/\bdo\s*\$/i.test(sql) || /\bexecute\s+(format\s*\(|')/i.test(sql)) {
    return { ok: false, reason: "動的SQL(DO/EXECUTE)が含まれている" };
  }
  return { ok: true };
}

/** role名が固定の"reference_data_backup_reader"だけであり、文字列連結・パラメータ化された識別子を使っていないことを確認する。 */
export function assertRoleNameFixed(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  if (!/\breference_data_backup_reader\b/.test(sql)) {
    return { ok: false, reason: "reference_data_backup_readerという固定role名が見つからない" };
  }
  if (/\|\|\s*'?role'?|format\s*\(\s*'%I'|quote_ident\s*\(/i.test(sql)) {
    return { ok: false, reason: "role名が文字列連結・動的識別子で組み立てられている疑いがある" };
  }
  return { ok: true };
}

/** GRANT対象が、許可された4テーブルとちょうど一致することを確認する(create SQLだけに適用)。 */
export function assertExactlyFourTargetTablesGranted(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  const missing = BACKUP_TARGET_TABLES.filter((t) => !new RegExp(`reference_data\\.${t}\\b`).test(sql));
  if (missing.length > 0) {
    return { ok: false, reason: `GRANT対象に不足しているテーブルがある: ${missing.join(",")}` };
  }
  return { ok: true };
}

/** 確認用SQLが、実テーブルの行データを一切FROM参照していないことを確認する(metadataだけを使うこと)。 */
export function assertVerifySqlIsMetadataOnly(rawSql: string): GuardCheck {
  const sql = stripLineComments(rawSql);
  if (/\bfrom\s+reference_data\.\w+/i.test(sql)) {
    return { ok: false, reason: "確認用SQLがreference_dataの実テーブルをFROM参照している(行データを読む疑いがある)" };
  }
  if (/select\s+\*/i.test(sql)) {
    return { ok: false, reason: "確認用SQLにSELECT *が含まれている" };
  }
  const requiredFunctions = ["has_schema_privilege", "has_table_privilege", "pg_roles"];
  const missing = requiredFunctions.filter((fn) => !sql.includes(fn));
  if (missing.length > 0) {
    return { ok: false, reason: `確認用SQLに必要なmetadata関数/ビューが含まれていない: ${missing.join(",")}` };
  }
  return { ok: true };
}

export function auditCreateRoleSql(rawSql: string): GuardCheck[] {
  return [
    assertHasRoleSafetyBanner(rawSql),
    assertHasCreateRoleBanner(rawSql),
    assertNoPasswordLiteral(rawSql),
    assertNoConnectionInfoOrSecrets(rawSql),
    assertNoUserDataOrOpsSchemaReference(rawSql),
    assertNoElevatedPrivilegeGranted(rawSql),
    assertGrantsAreSelectOrUsageOnly(rawSql),
    assertNoDynamicSql(rawSql),
    assertRoleNameFixed(rawSql),
    assertExactlyFourTargetTablesGranted(rawSql),
  ];
}

export function auditVerifyRoleSql(rawSql: string): GuardCheck[] {
  return [
    assertHasVerifySqlBanner(rawSql),
    assertNoPasswordLiteral(rawSql),
    assertNoConnectionInfoOrSecrets(rawSql),
    assertNoUserDataOrOpsSchemaReference(rawSql),
    assertNoDynamicSql(rawSql),
    assertRoleNameFixed(rawSql),
    assertVerifySqlIsMetadataOnly(rawSql),
  ];
}

export function auditRollbackRoleSql(rawSql: string): GuardCheck[] {
  return [
    assertHasRoleSafetyBanner(rawSql),
    assertNoPasswordLiteral(rawSql),
    assertNoConnectionInfoOrSecrets(rawSql),
    assertNoUserDataOrOpsSchemaReference(rawSql),
    assertNoDynamicSql(rawSql),
    assertRoleNameFixed(rawSql),
  ];
}
