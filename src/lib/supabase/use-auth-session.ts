"use client";

/**
 * 認証状態(未設定/確認中/未ログイン/ログイン済み)を購読するクライアント専用フック。
 *
 * - 画面へ渡すのは確認済みメールアドレスだけ(内部UUID・アクセストークン・
 *   リフレッシュトークンは一切含めない)。
 * - `getUser()`で初期状態をSupabase Auth側へ実際に問い合わせて確認し、
 *   以後は`onAuthStateChange`の通知だけで状態を更新する。
 */
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./client";

export type AuthSessionState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; email: string | null };

export function useSupabaseSession(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>({ status: "loading" });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setState({ status: "unconfigured" });
      return;
    }

    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setState(data.user ? { status: "authenticated", email: data.user.email ?? null } : { status: "unauthenticated" });
      })
      .catch(() => {
        // ネットワーク不通等でSupabase Authへ到達できない場合も、読み込み中のまま止まらず
        // 安全側(未ログイン扱い)へフォールバックする。
        if (!active) return;
        setState({ status: "unauthenticated" });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState(session?.user ? { status: "authenticated", email: session.user.email ?? null } : { status: "unauthenticated" });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
