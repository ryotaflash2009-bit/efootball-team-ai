/**
 * Supabase Auth(技術検証)の環境変数を安全に検証する純関数群。
 *
 * - ここでは実際の値(URL・鍵)を一切ハードコードしない。呼び出し側が
 *   `process.env.NEXT_PUBLIC_SUPABASE_URL` 等を読み取って渡す。
 * - 検証結果(エラー)には、入力された実際の値を一切含めない
 *   (`SupabaseEnvResult` の失敗ケースはエラーコードだけを持つ)。呼び出し側は
 *   このコードをja/en辞書経由の安全な文言へ変換してから表示する。
 * - Publishable key(`sb_publishable_` 接頭辞、新形式)だけを受理する。
 *   Secret key(`sb_secret_`)や、旧形式のJWT(anon/service_role、`eyJ`で始まる)は
 *   明示的に拒否する(「古い非推奨のanon/service_role中心の例をそのまま採用しない」という方針)。
 */

export interface SupabaseEnvConfig {
  url: string;
  publishableKey: string;
}

export type SupabaseEnvValidationError =
  | "MISSING_URL"
  | "INVALID_URL"
  | "MISSING_PUBLISHABLE_KEY"
  | "INVALID_PUBLISHABLE_KEY_FORMAT"
  | "SECRET_KEY_DETECTED"
  | "SERVICE_ROLE_KEY_DETECTED";

export type SupabaseEnvResult = { ok: true; config: SupabaseEnvConfig } | { ok: false; error: SupabaseEnvValidationError };

const PUBLISHABLE_KEY_RE = /^sb_publishable_[A-Za-z0-9_-]+$/;
const SECRET_KEY_RE = /^sb_secret_/;
/** 旧形式のJWT(anon/service_role とも "eyJ" で始まる自己記述式トークン)を丸ごと拒否する。 */
const LEGACY_JWT_RE = /^eyJ/;

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * 環境変数の生値(未検証)を受け取り、安全な設定オブジェクトへ変換する。
 * 失敗時は理由コードだけを返し、実際の値は一切含めない。
 */
export function validateSupabaseEnv(env: { url?: string | null; publishableKey?: string | null }): SupabaseEnvResult {
  const rawUrl = env.url ?? "";
  const rawKey = env.publishableKey ?? "";

  if (rawUrl.trim() === "") return { ok: false, error: "MISSING_URL" };
  if (hasWhitespace(rawUrl)) return { ok: false, error: "INVALID_URL" };
  if (!isHttpsUrl(rawUrl)) return { ok: false, error: "INVALID_URL" };

  if (rawKey.trim() === "") return { ok: false, error: "MISSING_PUBLISHABLE_KEY" };
  if (hasWhitespace(rawKey)) return { ok: false, error: "INVALID_PUBLISHABLE_KEY_FORMAT" };
  if (SECRET_KEY_RE.test(rawKey)) return { ok: false, error: "SECRET_KEY_DETECTED" };
  if (LEGACY_JWT_RE.test(rawKey)) return { ok: false, error: "SERVICE_ROLE_KEY_DETECTED" };
  if (!PUBLISHABLE_KEY_RE.test(rawKey)) return { ok: false, error: "INVALID_PUBLISHABLE_KEY_FORMAT" };

  return { ok: true, config: { url: rawUrl, publishableKey: rawKey } };
}

/** 実行時の`process.env`から検証済み設定を得る(サーバー・ブラウザー双方の呼び出しコードから共通利用)。 */
export function getSupabaseEnv(): SupabaseEnvResult {
  return validateSupabaseEnv({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
