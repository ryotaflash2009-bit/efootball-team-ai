import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSafeInternalPath } from "@/lib/supabase/safe-redirect";
import { callbackErrorFromQuery, classifyEmailLinkFailure } from "@/lib/supabase/email-link";
import { isGoogleFlow, oauthCallbackFailure } from "@/lib/supabase/oauth";

/**
 * Supabase Authのメール確認/パスワード再設定リンクと、Google OAuth（`flow=google`・2026-10-11）の着地点（PKCE の code 交換）。
 *
 * - `code`をSupabase Authセッションへ安全に交換する(公式`exchangeCodeForSession`)。
 * - 遷移先は{@link resolveSafeInternalPath}で検証済みの内部パスのみ(外部URLへは絶対に遷移しない)。
 * - `code`・トークン・セッション情報は画面へ一切表示せず、失敗時も一般化した理由コードだけを返す
 *   （Supabase が付ける error_description などの生の文は使わない）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const signIn = (reason: string) => NextResponse.redirect(new URL(`/auth/sign-in?authError=${reason}`, request.url));

  // Google の画面でキャンセル・失敗したとき（flow=google）。メールのリンクの文言（期限切れ等）と区別する。
  const oauthError = oauthCallbackFailure(url.search);
  if (oauthError) return signIn(oauthError);
  const google = isGoogleFlow(url.search);

  // リンクが期限切れ・無効なとき、Supabase は ?error=…&error_code=… を付けて戻す。
  const linkError = callbackErrorFromQuery(url.search);
  if (linkError) return signIn(linkError);

  const code = url.searchParams.get("code");
  const next = resolveSafeInternalPath(url.searchParams.get("next"), "/account");

  if (!code) return signIn(google ? "oauth_failed" : "missing_code");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return signIn("not_configured");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const reason = classifyEmailLinkFailure(error as { status?: number; code?: string });
    if (google) return signIn(reason === "rate_limited" || reason === "unavailable" ? reason : "oauth_failed");
    return signIn(reason === "unknown" ? "callback_failed" : reason);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
