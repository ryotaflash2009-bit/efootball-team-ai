import type { GuardCheck } from "./real-import-guards";

/**
 * Supabase Session pooler接続文字列を、テンプレート([YOUR-PASSWORD]プレースホルダーを含む)と
 * DBパスワードを別々に受け取って安全に組み立てる純関数群。
 *
 * - ここには実際のネットワーク接続・Read-Host等の対話処理は一切含まない。
 * - 戻り値・例外メッセージのいずれにも、入力された接続文字列・パスワードの実値を含めない
 *   (エラー理由は常に定型文であり、入力値を埋め込まない)。
 */

export const PASSWORD_PLACEHOLDER = "[YOUR-PASSWORD]";

export function countPlaceholderOccurrences(template: string, placeholder: string = PASSWORD_PLACEHOLDER): number {
  if (!template) return 0;
  return template.split(placeholder).length - 1;
}

export function checkExactlyOnePlaceholder(count: number): GuardCheck {
  if (count === 0) return { ok: false, reason: `接続文字列テンプレートに${PASSWORD_PLACEHOLDER}が見つからない` };
  if (count > 1) return { ok: false, reason: `接続文字列テンプレートに${PASSWORD_PLACEHOLDER}が複数件あり、1件に確定できない` };
  return { ok: true };
}

export function checkNonEmpty(value: string | null | undefined, label: string): GuardCheck {
  if (!value || value.trim() === "") return { ok: false, reason: `${label}が空` };
  return { ok: true };
}

/**
 * RFC3986のuserinfo/password部分として安全な形へ、パスワードを1回だけパーセントエンコードする。
 * `encodeURIComponent`が素通りする `! ' ( ) *` も追加でエンコードする(二重エンコードは行わない)。
 */
export function encodePasswordForUri(password: string): string {
  return encodeURIComponent(password).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** プレースホルダーがちょうど1件であることを前提に、そこだけを置換する(見つからない/複数は例外)。 */
export function substitutePlaceholderOnce(template: string, replacement: string, placeholder: string = PASSWORD_PLACEHOLDER): string {
  const count = countPlaceholderOccurrences(template, placeholder);
  if (count !== 1) {
    throw new Error("substitutePlaceholderOnce: プレースホルダーがちょうど1件ではない状態で呼び出された");
  }
  return template.split(placeholder).join(replacement);
}

export type PoolerType = "session" | "transaction" | "direct" | "unknown";

export interface ConnectionStringStructureResult extends GuardCheck {
  poolerType?: PoolerType;
}

const SESSION_POOLER_HOST_RE = /\.pooler\.supabase\.com$/i;
const DIRECT_HOST_RE = /^db\.[a-z0-9-]+\.supabase\.co$/i;
const SESSION_POOLER_PORT = "5432";
const TRANSACTION_POOLER_PORT = "6543";

/**
 * 完成済み接続文字列(秘密情報を含みうる)の「構造」だけを検証する。
 * 戻り値・例外のいずれにも接続文字列の実値(ホスト名・ユーザー名等)を含めない。
 */
export function validateConnectionStringStructure(connectionString: string): ConnectionStringStructureResult {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return { ok: false, reason: "接続文字列のURI解析に失敗した" };
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return { ok: false, reason: "接続文字列のスキームがpostgresql/postgresではない" };
  }

  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (dbName !== "postgres") {
    return { ok: false, reason: "対象データベース名が想定外(postgresではない)" };
  }

  const host = url.hostname;
  const port = url.port;

  if (SESSION_POOLER_HOST_RE.test(host)) {
    if (port === TRANSACTION_POOLER_PORT) {
      return { ok: false, reason: "Transaction pooler形式(ポート6543)が指定された(今回はSession poolerのみ許可)", poolerType: "transaction" };
    }
    if (port !== SESSION_POOLER_PORT) {
      return { ok: false, reason: "poolerホストだが想定外のポートが指定された(Session poolerのポート5432ではない)", poolerType: "unknown" };
    }
    return { ok: true, poolerType: "session" };
  }

  if (DIRECT_HOST_RE.test(host)) {
    return { ok: false, reason: "Direct connection形式が指定された(今回はSession poolerのみ許可)", poolerType: "direct" };
  }

  return { ok: false, reason: "既知のSession pooler/Direct connectionいずれの形式とも一致しない", poolerType: "unknown" };
}

export interface BuildConnectionStringInput {
  template: string;
  password: string;
}

export interface BuildConnectionStringResult extends GuardCheck {
  /** 検証に成功した場合のみ設定される。呼び出し側もログ・画面へは出力しないこと。 */
  connectionString?: string;
  poolerType?: PoolerType;
}

/**
 * テンプレート+パスワードから接続文字列を組み立て、構造を検証するまでを1つにまとめたエントリポイント。
 * 失敗時は理由(定型文、入力値を含まない)だけを返す。
 */
export function buildAndValidateConnectionString(input: BuildConnectionStringInput): BuildConnectionStringResult {
  const templateCheck = checkNonEmpty(input.template, "接続文字列テンプレート");
  if (!templateCheck.ok) return templateCheck;

  const passwordCheck = checkNonEmpty(input.password, "DBパスワード");
  if (!passwordCheck.ok) return passwordCheck;

  const placeholderCount = countPlaceholderOccurrences(input.template);
  const placeholderCheck = checkExactlyOnePlaceholder(placeholderCount);
  if (!placeholderCheck.ok) return placeholderCheck;

  const encodedPassword = encodePasswordForUri(input.password);
  const connectionString = substitutePlaceholderOnce(input.template, encodedPassword);

  const structureCheck = validateConnectionStringStructure(connectionString);
  if (!structureCheck.ok) return structureCheck;

  return { ok: true, connectionString, poolerType: structureCheck.poolerType };
}
