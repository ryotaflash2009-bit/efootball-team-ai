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
 *
 * 実装はタブ内で単一の購読(モジュール単位のシングルトン)を共有する
 * (`useSyncExternalStore`)。呼び出し側ごとに独立した`getUser()`/`onAuthStateChange`を
 * 都度張ると、後から追加でマウントされた呼び出し側(例: 一覧内の多数のカードに配置された
 * お気に入りボタン)が自分自身の初期状態("loading")を一時的に返してしまい、既に確定済みの
 * 認証状態へ依存する他の機能(アカウント別localStorageスコープ解決)を不必要に
 * 「認証確認中」へ巻き戻してしまう不具合の原因になるため、単一の共有購読へ統一する。
 */
import { useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "./client";

export type AuthSessionState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; email: string | null; userId: string };

const LOADING_STATE: AuthSessionState = { status: "loading" };

let currentState: AuthSessionState = LOADING_STATE;
const listeners = new Set<() => void>();
let started = false;

function notify(): void {
  for (const cb of [...listeners]) cb();
}

function setState(next: AuthSessionState): void {
  currentState = next;
  notify();
}

/** 初回の購読者が現れた時にだけ、実際の`getUser()`/`onAuthStateChange`を開始する。 */
function ensureStarted(): void {
  if (started) return;
  started = true;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    setState({ status: "unconfigured" });
    return;
  }

  supabase.auth
    .getUser()
    .then(({ data }) => {
      setState(data.user ? { status: "authenticated", email: data.user.email ?? null, userId: data.user.id } : { status: "unauthenticated" });
    })
    .catch(() => {
      // ネットワーク不通等でSupabase Authへ到達できない場合も、読み込み中のまま止まらず
      // 安全側(未ログイン扱い)へフォールバックする。
      setState({ status: "unauthenticated" });
    });

  supabase.auth.onAuthStateChange((_event, session) => {
    setState(session?.user ? { status: "authenticated", email: session.user.email ?? null, userId: session.user.id } : { status: "unauthenticated" });
  });
  // タブ(ドキュメント)の生存期間中は購読を維持する(認証状態はページ全体で単一の
  // 真実源であり、個々のコンポーネントのマウント/アンマウントに従属させる必要がないため、
  // 意図的にunsubscribeしない)。
}

function subscribe(callback: () => void): () => void {
  ensureStarted();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): AuthSessionState {
  return currentState;
}

function getServerSnapshot(): AuthSessionState {
  return LOADING_STATE;
}

export function useSupabaseSession(): AuthSessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** テスト専用: 次のテストへ影響を残さないよう、共有状態を完全にリセットする。 */
export function __resetSupabaseSessionForTests(): void {
  currentState = LOADING_STATE;
  listeners.clear();
  started = false;
}
