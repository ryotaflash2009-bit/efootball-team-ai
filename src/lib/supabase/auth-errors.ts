/**
 * Supabase Authが返す生のエラー(メッセージ文字列・ステータスコード)を、
 * 画面へ安全に表示できる一般化された理由コードへ変換する純関数群。
 *
 * - 生のエラーメッセージ(英語の内部文言)をそのまま画面に出さない。
 * - サインインの失敗理由は「メールアドレスかパスワードのどちらが間違っているか」を
 *   区別しない(メールアドレス存在調査への悪用防止)。
 * - 呼び出し側は返ってきたコードをja/en辞書のキーへマッピングして表示する。
 */

export type SignInFailureReason = "INVALID_CREDENTIALS" | "RATE_LIMITED" | "UNKNOWN";
export type SignUpFailureReason = "WEAK_PASSWORD" | "INVALID_EMAIL" | "RATE_LIMITED" | "UNKNOWN";
export type PasswordResetFailureReason = "RATE_LIMITED" | "UNKNOWN";
export type ResendFailureReason = "RATE_LIMITED" | "UNKNOWN";

interface RawAuthError {
  message?: string | null;
  status?: number | null;
  code?: string | null;
}

function isRateLimited(error: RawAuthError): boolean {
  return error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit";
}

/** サインイン失敗を一般化する。理由を問わず既定は"認証情報が正しくない"扱いにする。 */
export function classifySignInFailure(error: RawAuthError): SignInFailureReason {
  if (isRateLimited(error)) return "RATE_LIMITED";
  if (error.code === "invalid_credentials" || error.status === 400) return "INVALID_CREDENTIALS";
  return "UNKNOWN";
}

/** サインアップ失敗を分類する。既存アカウントの有無は区別しない(呼び出し側で成功文言に統一する)。 */
export function classifySignUpFailure(error: RawAuthError): SignUpFailureReason {
  if (isRateLimited(error)) return "RATE_LIMITED";
  if (error.code === "weak_password") return "WEAK_PASSWORD";
  if (error.code === "invalid_email" || error.code === "email_address_invalid") return "INVALID_EMAIL";
  return "UNKNOWN";
}

export function classifyPasswordResetFailure(error: RawAuthError): PasswordResetFailureReason {
  if (isRateLimited(error)) return "RATE_LIMITED";
  return "UNKNOWN";
}

/**
 * 確認メール再送信の失敗を分類する。
 * 「既に確認済みのため再送信できない」場合もSupabaseはエラーを返すが、
 * ここでは区別せずUNKNOWN扱いにする(メールアドレス存在・確認状態の調査への悪用防止。
 * 「確認済みならログインできます」という案内は、結果に関わらず常時表示する静的な文言で足りる)。
 */
export function classifyResendFailure(error: RawAuthError): ResendFailureReason {
  if (isRateLimited(error)) return "RATE_LIMITED";
  return "UNKNOWN";
}
