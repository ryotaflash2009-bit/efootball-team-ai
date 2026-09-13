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
 *
 * 同一ユーザーIDのスコープID計算結果はタブ内でキャッシュする。このフックは一覧内の
 * カードごとのお気に入りボタン等、同一ページ内に多数のインスタンスとして呼び出され得るため、
 * キャッシュが無いと「既に解決済みのはずなのに、後から追加でマウントされたインスタンスだけが
 * 自分自身の初期状態("loading")を共有ストア(`current-scope-store`)へ一時的に押し戻し、
 * 既にアカウント領域を正しく表示していた他の画面までもが一瞬「確認中」に巻き戻る」という
 * 不具合を招く。キャッシュ済みの場合は初回レンダーから同期的に解決済み状態を返す。
 */
export type ScopeResolutionState = { status: "loading" } | { status: "resolved"; scope: StorageScope };

const scopeIdCache = new Map<string, string | null>();

async function computeAccountScopeIdCached(userId: string): Promise<string | null> {
  const cached = scopeIdCache.get(userId);
  if (cached !== undefined) return cached;
  const scopeId = await computeAccountScopeId(userId);
  scopeIdCache.set(userId, scopeId);
  return scopeId;
}

/** `session.status`と`currentUserId`(派生値)だけから解決する。`session`オブジェクト自体は参照しない。 */
function resolveFromStatus(sessionStatus: "loading" | "unauthenticated" | "unconfigured" | "authenticated", currentUserId: string | null): ScopeResolutionState {
  if (sessionStatus === "loading") return { status: "loading" };
  if (sessionStatus === "unauthenticated" || sessionStatus === "unconfigured") {
    return { status: "resolved", scope: { kind: "guest" } };
  }
  // authenticated: キャッシュ済みなら同期的に確定させる(未キャッシュならloadingのまま)。
  if (currentUserId) {
    const cachedScopeId = scopeIdCache.get(currentUserId);
    if (cachedScopeId !== undefined) {
      return { status: "resolved", scope: cachedScopeId ? { kind: "account", scopeId: cachedScopeId } : { kind: "guest" } };
    }
  }
  return { status: "loading" };
}

export function useStorageScope(): ScopeResolutionState {
  const session = useSupabaseSession();
  const sessionStatus = session.status;
  const currentUserId = sessionStatus === "authenticated" ? session.userId : null;
  const [state, setState] = useState<ScopeResolutionState>(() => resolveFromStatus(sessionStatus, currentUserId));
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const resolved = resolveFromStatus(sessionStatus, currentUserId);
    setState(resolved);
    if (resolved.status === "resolved" || !currentUserId) return;

    // 未キャッシュの認証済みユーザー: 実際にスコープID計算が終わるまで待つ。
    computeAccountScopeIdCached(currentUserId).then((scopeId) => {
      if (requestIdRef.current !== requestId) return; // 古い応答は破棄する
      setState({ status: "resolved", scope: scopeId ? { kind: "account", scopeId } : { kind: "guest" } });
    });
  }, [sessionStatus, currentUserId]);

  return state;
}
