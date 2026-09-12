"use client";

/**
 * ブラウザー(Client Component)から使うSupabaseクライアント。
 *
 * - `createBrowserClient`(`@supabase/ssr`)は、認証Cookieの読み書きをブラウザーの
 *   `document.cookie`経由で自動的に行う(サーバー側のCookieハンドリングとは別実装)。
 * - Publishable key(`sb_publishable_`)以外は受理しない({@link getSupabaseEnv}が
 *   Secret key/旧anon-JWT形式を拒否する)。Secret keyはこのファイルには一切登場しない。
 * - 環境変数が未設定/不正な場合は例外を投げず`null`を返す。呼び出し側は
 *   「未設定環境」を安全に表示する(Section 16の必須シナリオ)。
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let cached: SupabaseClient | null | undefined;

/** 検証済みの環境変数からブラウザー用クライアントを生成する。未設定/不正なら`null`。 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const env = getSupabaseEnv();
  if (!env.ok) {
    cached = null;
    return null;
  }
  cached = createBrowserClient(env.config.url, env.config.publishableKey);
  return cached;
}

/** テスト専用: キャッシュされたクライアントをリセットする。 */
export function resetSupabaseBrowserClientForTesting(): void {
  cached = undefined;
}
