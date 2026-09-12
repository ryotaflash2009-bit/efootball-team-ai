/**
 * サーバー側(Server Component/Route Handler/Server Action)から使うSupabaseクライアント。
 *
 * - Next.js 15の`cookies()`は非同期APIのため、このファイルの生成関数も非同期にする。
 * - Cookieの読み書きは`getAll()`/`setAll()`経由(`@supabase/ssr`公式パターン)。
 *   Server Componentから呼ばれた場合、Next.jsはCookie書き込みを許可しないため
 *   `setAll()`の失敗は握りつぶす(ミドルウェアがセッション更新を担当する前提)。
 * - Secret key/service_roleはこのファイルでも一切使用しない(Publishable keyのみ)。
 * - クライアントの入力からuser_idを信頼しない。認証済みユーザーの識別は、必ず
 *   このクライアントの`auth.getUser()`が返すSupabase Authセッションに由来する値を使う。
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

type ServerClientResolver = () => Promise<SupabaseClient | null>;

let resolverOverride: ServerClientResolver | null = null;

async function resolveRealServerClient(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env.ok) return null;

  const cookieStore = await cookies();

  return createServerClient(env.config.url, env.config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* Server Componentからの呼び出しでは書き込み不可。ミドルウェアが更新を担う。 */
        }
      },
    },
  });
}

/** 検証済みの環境変数からサーバー用クライアントを生成する。未設定/不正なら`null`。 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (resolverOverride) return resolverOverride();
  return resolveRealServerClient();
}

/** テスト専用: 実際のSupabase通信・`next/headers`を使わない差し替えを可能にする(本番コードから呼び出さない)。 */
export function setSupabaseServerClientForTesting(resolver: ServerClientResolver | null): void {
  resolverOverride = resolver;
}
