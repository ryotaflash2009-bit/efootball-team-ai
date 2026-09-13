"use client";

import { useEffect, useRef, useState } from "react";
import { useSupabaseSession } from "@/lib/supabase/use-auth-session";
import { computeAccountScopeId } from "./scope-id";
import type { StorageScope } from "./types";

/**
 * 現在の保存領域(guest/account)を解決するクライアント専用フック。
 *
 * - 認証状態の確認が完了するまでは`"loading"`を返す(未ログイン領域を先に表示してから
 *   アカウント領域へ切り替わる、という大きなちらつきを避けるため)。
 * - スコープID計算は非同期(SHA-256)のため、認証済みと判定してから実際にスコープが
 *   確定するまでの間も`"loading"`のまま保つ。
 * - アカウントが切り替わった場合(同一`"authenticated"`のまま別ユーザーIDへ変わった場合を含む)、
 *   直ちに`"loading"`へ戻してから再解決する。古い(遅延した)解決結果は、直近の要求と
 *   一致しない限り反映しない(古い非同期応答の破棄)。
 * - このフック自体はlocalStorageへ一切書き込まない(読み取り・計算だけ)。
 * - ユーザーIDが一時的に取得できない異常系は、安全側としてguest扱いにする
 *   (認証済みアカウント領域へは絶対にアクセスしない)。
 */
export type ScopeResolutionState = { status: "loading" } | { status: "resolved"; scope: StorageScope };

export function useStorageScope(): ScopeResolutionState {
  const session = useSupabaseSession();
  const [state, setState] = useState<ScopeResolutionState>({ status: "loading" });
  const requestIdRef = useRef(0);

  const currentUserId = session.status === "authenticated" ? session.userId : null;

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    if (session.status === "loading") {
      setState({ status: "loading" });
      return;
    }
    if (session.status === "unauthenticated" || session.status === "unconfigured") {
      setState({ status: "resolved", scope: { kind: "guest" } });
      return;
    }

    // authenticated: スコープID計算が終わるまでは"loading"のまま。
    setState({ status: "loading" });
    computeAccountScopeId(currentUserId).then((scopeId) => {
      if (requestIdRef.current !== requestId) return; // 古い応答は破棄する
      if (!scopeId) {
        setState({ status: "resolved", scope: { kind: "guest" } });
        return;
      }
      setState({ status: "resolved", scope: { kind: "account", scopeId } });
    });
  }, [session.status, currentUserId]);

  return state;
}
