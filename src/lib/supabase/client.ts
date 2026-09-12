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
 * - ブラックボックステスト専用: `window.__EFB_AUTH_TEST_DOUBLE__`が設定されており、かつ
 *   実行ホストが{@link isLocalDevHostname}(localhost等)である場合だけ、実Supabaseへの
 *   接続を行わずそのテストダブルを使う。本番ドメインでは絶対に有効化されない
 *   (ヘッドレスChromeによる自動テストが実メール送信・実Supabase通信を発生させないための仕組み。
 *   本番コードはこのグローバル変数を一切設定しない)。
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";
import { isLocalDevHostname } from "./local-dev";

/** テストダブルが実装すべき最小限のauthメソッド群(実運用コードが使う範囲だけ)。 */
export interface AuthTestDouble {
  signUp: SupabaseClient["auth"]["signUp"];
  resend: SupabaseClient["auth"]["resend"];
  signInWithPassword: SupabaseClient["auth"]["signInWithPassword"];
  signOut: SupabaseClient["auth"]["signOut"];
  getUser: SupabaseClient["auth"]["getUser"];
  onAuthStateChange: SupabaseClient["auth"]["onAuthStateChange"];
  updateUser: SupabaseClient["auth"]["updateUser"];
  resetPasswordForEmail: SupabaseClient["auth"]["resetPasswordForEmail"];
}

/** ブラックボックステスト専用: `.from(table)`だけを差し替えるDB用テストダブル。 */
export interface DbTestDouble {
  from: SupabaseClient["from"];
}

declare global {
  interface Window {
    __EFB_AUTH_TEST_DOUBLE__?: AuthTestDouble;
    __EFB_DB_TEST_DOUBLE__?: DbTestDouble;
  }
}

let cached: SupabaseClient | null | undefined;

function resolveTestDouble(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!isLocalDevHostname(window.location.hostname)) return null;
  const authDouble = window.__EFB_AUTH_TEST_DOUBLE__;
  if (!authDouble) return null;
  const dbDouble = window.__EFB_DB_TEST_DOUBLE__;
  return { auth: authDouble, from: dbDouble?.from } as unknown as SupabaseClient;
}

/** 検証済みの環境変数からブラウザー用クライアントを生成する。未設定/不正なら`null`。 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const testDouble = resolveTestDouble();
  if (testDouble) {
    cached = testDouble;
    return cached;
  }

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
