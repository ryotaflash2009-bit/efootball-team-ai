/**
 * 認証メールのリンク（/auth/confirm と /auth/callback）の検証と、失敗理由の一般化（純関数）。
 *
 * - メールのリンクは `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<種類>`（Supabase 公式の推奨）。
 *   メール事業者のリンク事前取得（迷惑メール検査）でトークンが先に使われないよう、トークンの検証は
 *   利用者がボタンを押したときだけ行う。
 * - 戻り先は種類ごとの固定の内部パスだけ（メールやクエリから任意の遷移先を受け取らない）。
 * - Supabase の生のエラー文（error_description 等）は画面へ出さない。理由コードへ一般化する。
 */

export const EMAIL_LINK_TYPES = ["email", "recovery", "invite", "email_change", "magiclink"] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

/** 確認後の固定の遷移先。 */
const NEXT_BY_TYPE: Record<EmailLinkType, string> = {
  email: "/account",
  magiclink: "/account",
  invite: "/auth/update-password",
  recovery: "/auth/update-password",
  email_change: "/account",
};

/** Supabase の token hash（通常は16進、PKCE では pkce_ 接頭辞）。長さ・文字種を制限する。 */
const TOKEN_HASH_RE = /^(pkce_)?[A-Za-z0-9_-]{16,256}$/;

export type ConfirmParams = { ok: true; tokenHash: string; type: EmailLinkType; next: string } | { ok: false; reason: "link_invalid" };

export function parseConfirmParams(search: string): ConfirmParams {
  const q = new URLSearchParams(search);
  const tokenHash = q.get("token_hash") ?? "";
  const type = q.get("type") ?? "";
  if (!TOKEN_HASH_RE.test(tokenHash)) return { ok: false, reason: "link_invalid" };
  if (!(EMAIL_LINK_TYPES as readonly string[]).includes(type)) return { ok: false, reason: "link_invalid" };
  return { ok: true, tokenHash, type: type as EmailLinkType, next: NEXT_BY_TYPE[type as EmailLinkType] };
}

export type EmailLinkFailure = "link_expired" | "link_invalid" | "rate_limited" | "not_configured" | "unavailable" | "unknown";

interface RawAuthError {
  status?: number | null;
  code?: string | null;
}

/** verifyOtp / exchangeCodeForSession / リダイレクトの error_code を一般化する（期限切れと使用済みは区別しない）。 */
export function classifyEmailLinkFailure(error: RawAuthError | null | undefined): EmailLinkFailure {
  if (!error) return "unknown";
  const code = error.code ?? "";
  if (error.status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return "rate_limited";
  if (code === "otp_expired" || code === "flow_state_expired") return "link_expired";
  if (code === "otp_disabled" || code === "bad_code_verifier" || code === "flow_state_not_found" || code === "validation_failed" || code === "bad_jwt") return "link_invalid";
  if (error.status === 401 || error.status === 403) return "link_expired";
  // 認証サービス側の障害（5xx）。リンクは使われていない可能性が高いので「無効」とは言わず、時間をおいた再試行を案内する。
  if (typeof error.status === "number" && error.status >= 500) return "unavailable";
  return "unknown";
}

/** /auth/callback に Supabase がエラーを付けて戻したとき（?error=…&error_code=… またはフラグメント）の理由。 */
export function callbackErrorFromQuery(search: string): EmailLinkFailure | null {
  const q = new URLSearchParams(search);
  if (!q.has("error") && !q.has("error_code")) return null;
  const reason = classifyEmailLinkFailure({ code: q.get("error_code") });
  return reason === "unknown" ? "link_invalid" : reason;
}

/** サインイン画面の ?authError= の値 → 表示する辞書キー（未知の値は一般的な失敗）。 */
export type AuthErrorMessageKey =
  | "authErrorLinkExpired"
  | "authErrorLinkInvalid"
  | "authErrorRateLimited"
  | "authErrorNotConfigured"
  | "authErrorServiceUnavailable"
  | "authErrorOAuthCancelled"
  | "authErrorOAuthFailed"
  | "signInFailedMessage";

export function authErrorMessageKey(value: string | null): AuthErrorMessageKey | null {
  if (!value) return null;
  switch (value) {
    case "link_expired":
      return "authErrorLinkExpired";
    case "link_invalid":
    case "missing_code":
    case "callback_failed":
      return "authErrorLinkInvalid";
    case "rate_limited":
      return "authErrorRateLimited";
    case "not_configured":
      return "authErrorNotConfigured";
    case "unavailable":
      return "authErrorServiceUnavailable";
    case "oauth_cancelled":
      return "authErrorOAuthCancelled";
    case "oauth_failed":
      return "authErrorOAuthFailed";
    default:
      return "signInFailedMessage";
  }
}
