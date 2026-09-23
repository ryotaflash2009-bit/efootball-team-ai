import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { areInternalPagesVisible, isInternalPagePath } from "@/lib/public-info/internal-pages";

/** 存在しないpath。ここへrewriteするとアプリ共通のnot-found画面がHTTP 404で返る。 */
const HIDDEN_INTERNAL_PAGE_REWRITE = "/__internal-page-not-available";

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
  // 開発者向け内部ページは、表示不可の環境ではレンダリング前に404にする(fail-closed)。
  // ページ側のnotFound()だけでは、loading.tsxによるstreaming開始後でHTTP statusが200のままになるため。
  if (isInternalPagePath(request.nextUrl.pathname.replace(/\/+$/, "") || "/") && !areInternalPagesVisible()) {
    return NextResponse.rewrite(new URL(HIDDEN_INTERNAL_PAGE_REWRITE, request.url), { status: 404 });
  }

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
