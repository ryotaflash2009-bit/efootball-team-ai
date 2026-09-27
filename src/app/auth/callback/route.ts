import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSafeInternalPath } from "@/lib/supabase/safe-redirect";
import { callbackErrorFromQuery, classifyEmailLinkFailure } from "@/lib/supabase/email-link";

/**
 * Supabase Authのメール確認/パスワード再設定リンクの着地点（PKCE の code 交換）。
 *
 * - `code`をSupabase Authセッションへ安全に交換する(公式`exchangeCodeForSession`)。
 * - 遷移先は{@link resolveSafeInternalPath}で検証済みの内部パスのみ(外部URLへは絶対に遷移しない)。
 * - `code`・トークン・セッション情報は画面へ一切表示せず、失敗時も一般化した理由コードだけを返す
 *   （Supabase が付ける error_description などの生の文は使わない）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const signIn = (reason: string) => NextResponse.redirect(new URL(`/auth/sign-in?authError=${reason}`, request.url));

  // リンクが期限切れ・無効なとき、Supabase は ?error=…&error_code=… を付けて戻す。
  const linkError = callbackErrorFromQuery(url.search);
  if (linkError) return signIn(linkError);

  const code = url.searchParams.get("code");
  const next = resolveSafeInternalPath(url.searchParams.get("next"), "/account");

  if (!code) return signIn("missing_code");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return signIn("not_configured");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const reason = classifyEmailLinkFailure(error as { status?: number; code?: string });
    return signIn(reason === "unknown" ? "callback_failed" : reason);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
