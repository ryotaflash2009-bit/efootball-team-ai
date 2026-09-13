import type { StorageScope } from "./types";

/**
 * 現在の保存領域(guest/account)を、プレーンなストレージモジュール(my-team-storage.ts等、
 * Reactフックではない)へ伝える最小限の同期ブリッジ。
 *
 * - 「唯一の真実源」はReact側の`useStorageScope()`。このストアはその結果を
 *   ミラーリングするだけで、独自にスコープを解決しない。
 * - 認証状態確認中(スコープ未解決)は`null`。ストレージモジュール側はnullの間、
 *   読み込みは安全な空値、書き込みは拒否として扱う(「確認中は読み書きしない」)。
 * - スコープが実際に変わった場合だけ購読者へ通知する(同じスコープへの再設定は無視し、
 *   不要な再描画・再読込を避ける)。
 */
function scopeEquals(a: StorageScope | null, b: StorageScope | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "account" && b.kind === "account") return a.scopeId === b.scopeId;
  return true;
}

let current: StorageScope | null = null;
const listeners = new Set<() => void>();

export function getCurrentScope(): StorageScope | null {
  return current;
}

export function setCurrentScope(scope: StorageScope | null): void {
  if (scopeEquals(current, scope)) return;
  current = scope;
  for (const cb of [...listeners]) cb();
}

export function subscribeCurrentScope(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** テスト専用: 次のテストへ影響を残さないよう、状態と購読者を完全にリセットする。 */
export function __resetCurrentScopeForTests(): void {
  current = null;
  listeners.clear();
}
