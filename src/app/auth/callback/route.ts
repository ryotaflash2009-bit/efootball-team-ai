import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSafeInternalPath } from "@/lib/supabase/safe-redirect";

/**
 * Supabase Authのメール確認/パスワード再設定リンクの着地点。
 *
 * - `code`をSupabase Authセッションへ安全に交換する(公式`exchangeCodeForSession`)。
 * - 遷移先は{@link resolveSafeInternalPath}で検証済みの内部パスのみ(外部URLへは絶対に遷移しない)。
 * - `code`・トークン・セッション情報は画面へ一切表示せず、失敗時も一般化した案内のみ返す。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = resolveSafeInternalPath(url.searchParams.get("next"), "/account");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/sign-in?authError=missing_code", request.url));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth/sign-in?authError=not_configured", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/sign-in?authError=callback_failed", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
