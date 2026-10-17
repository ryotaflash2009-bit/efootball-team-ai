import type { ImpactCard } from "./team-impact";

export type NewCardForClient = ImpactCard & { provisional?: boolean };

const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; promise: Promise<NewCardForClient[]> } | null = null;

/**
 * /api/world/new-cards をページの中で 5 分に 1 回だけ読む（2026-10-17）。同じページに提案の欄が 2 つ（スカッドの比較）あっても要求は 1 回。
 * ブラウザーの保存（localStorage / sessionStorage）は使わない（新しいキーを作らない・development-safety-policy §4）。
 * 失敗は空の一覧（次の呼び出しで読み直す）。
 */
export function fetchNewCardsOnce(): Promise<NewCardForClient[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.promise;
  const promise = fetch("/api/world/new-cards")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { cards?: NewCardForClient[] } | null) => {
      if (!Array.isArray(j?.cards)) throw new Error("new-cards unavailable");
      return j.cards;
    })
    .catch(() => {
      cached = null;
      return [] as NewCardForClient[];
    });
  cached = { at: now, promise };
  return promise;
}

export function _resetNewCardsCache(): void {
  cached = null;
}
