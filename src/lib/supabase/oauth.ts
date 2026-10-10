import { resolveAuthRedirectOrigin } from "./account-availability";
import { resolveSafeInternalPath } from "./safe-redirect";

/**
 * Google OAuth（2026-10-11 の認証の方針: アカウント登録・ログインの主な経路は Google。メール＋パスワードの新規登録は提供しない）。
 *
 * - 公開の状態はコードの値（環境変数ではない）。本人が Google Cloud と Supabase の設定を終え、Production 適用前のテスト
 *   （docs/production-readiness/auth-google-oauth-plan.md §7）に合格した後に PR で "enabled" に変える。既定は "disabled"（fail closed）。
 * - 方式は redirect（popup は使わない）。モバイルの Safari・Chrome で popup はブロックされやすく、Supabase の PKCE はリダイレクトで完結する。
 * - 戻り先は自サイトの `/auth/callback` だけ。`flow=google` を付けて、メールのリンクの失敗（期限切れ等）と OAuth の失敗（キャンセル等）を区別する。
 * - Google のメールアドレスが既存のアカウントと同じでも、TeamAIXI のデータ（端末内・クラウド）は自動では統合しない
 *   （端末内のゲストのデータの引き継ぎは本人が `/account/local-data-migration?source=guest` で選ぶ）。
 */
export type GoogleOAuthMode = "disabled" | "enabled";
export const GOOGLE_OAUTH_MODE: GoogleOAuthMode = "disabled";

export const OAUTH_FLOW_PARAM = "flow";
export const OAUTH_FLOW_GOOGLE = "google";

/**
 * Google のボタンを出してよいか。"enabled" のとき、またはローカル開発ホストで `?oauthPreview=1` のとき（black-box でボタンと
 * 失敗の表示を検証し続けるため。テストダブルで実 Supabase には接続しない）。本番・プレビューのホストではクエリだけでは出ない。
 */
export function isGoogleOAuthAvailable(
  hostname: string,
  search: string,
  isLocalDevHostname: (h: string) => boolean,
  mode: GoogleOAuthMode = GOOGLE_OAUTH_MODE,
): boolean {
  if (mode === "enabled") return true;
  if (!isLocalDevHostname(hostname)) return false;
  return new URLSearchParams(search).get("oauthPreview") === "1";
}

/**
 * `signInWithOAuth` の redirectTo。`<origin>/auth/callback?flow=google&next=<安全な内部パス>`。
 * origin は NEXT_PUBLIC_SITE_URL（https の origin として正しいとき）を優先し、プレビューの URL を本番の設定へ混ぜない。
 * Supabase の Redirect URLs の許可リスト（`<origin>/auth/callback**`）が最終の防御。
 */
export function buildGoogleRedirectTo(currentOrigin: string, next: string | null, configured?: string): string {
  const origin = resolveAuthRedirectOrigin(currentOrigin, configured);
  const safeNext = resolveSafeInternalPath(next, "/account");
  const u = new URL("/auth/callback", origin);
  u.searchParams.set(OAUTH_FLOW_PARAM, OAUTH_FLOW_GOOGLE);
  u.searchParams.set("next", safeNext);
  return u.toString();
}

export type OAuthCallbackFailure = "oauth_cancelled" | "oauth_failed" | "unavailable";

/**
 * OAuth の戻り（`/auth/callback?flow=google&error=…`）の失敗の理由。`flow=google` でなければ null（メールのリンクの扱いに任せる）。
 * Google の画面で「キャンセル」すると `error=access_denied` で戻る。生の error_description は使わない。
 */
export function oauthCallbackFailure(search: string): OAuthCallbackFailure | null {
  const q = new URLSearchParams(search);
  if (q.get(OAUTH_FLOW_PARAM) !== OAUTH_FLOW_GOOGLE) return null;
  if (!q.has("error") && !q.has("error_code")) return null;
  const error = q.get("error") ?? "";
  if (error === "access_denied") return "oauth_cancelled";
  if (error === "temporarily_unavailable" || error === "server_error") return "unavailable";
  return "oauth_failed";
}

/** callback の `flow=google` か（code の交換の失敗を OAuth の失敗として表示するため）。 */
export function isGoogleFlow(search: string): boolean {
  return new URLSearchParams(search).get(OAUTH_FLOW_PARAM) === OAUTH_FLOW_GOOGLE;
}
