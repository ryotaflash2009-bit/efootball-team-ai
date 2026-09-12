import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Supabase Authのセッションを更新するミドルウェア(公式パターン)。
 *
 * - `supabase.auth.getUser()`を呼ぶことで、期限切れ間近のセッションCookieを
 *   Supabase Auth側との実通信で検証・更新する(`getSession()`だけを信頼しない)。
 * - 環境変数が未設定/不正な場合は何もせずリクエストをそのまま通す
 *   (「未設定環境でもクラッシュしない」というSection 16の必須要件)。
 * - ここでは認可(ページ単位のログイン必須化)は行わない。各ページ側が
 *   未ログイン状態を安全に表示する(本PoCの方針)。
 */
export async function middleware(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env.ok) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.config.url, env.config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
