"use client";

/**
 * 認証状態(未設定/確認中/未ログイン/ログイン済み)を購読するクライアント専用フック。
 *
 * - 画面(表示用途)へ渡すのは確認済みメールアドレスだけ(アクセストークン・
 *   リフレッシュトークンは一切含めない)。
 * - `userId`はSupabase Authの認証済みユーザーID(UUID)であり、
 *   `my-team-cloud-provenance.ts`が誤保存防止用の非秘密ハッシュを計算するための
 *   内部入力としてのみ利用する。呼び出し側はこの値をUI・ログ・報告へ
 *   一切表示しないこと(認証・認可の判定にも使わない。RLSの代替ではない)。
 * - `getUser()`で初期状態をSupabase Auth側へ実際に問い合わせて確認し、
 *   以後は`onAuthStateChange`の通知だけで状態を更新する。
 */
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./client";

export type AuthSessionState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; email: string | null; userId: string };

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
        setState(data.user ? { status: "authenticated", email: data.user.email ?? null, userId: data.user.id } : { status: "unauthenticated" });
      })
      .catch(() => {
        // ネットワーク不通等でSupabase Authへ到達できない場合も、読み込み中のまま止まらず
        // 安全側(未ログイン扱い)へフォールバックする。
        if (!active) return;
        setState({ status: "unauthenticated" });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState(session?.user ? { status: "authenticated", email: session.user.email ?? null, userId: session.user.id } : { status: "unauthenticated" });
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
