import type { ImpactCard } from "./team-impact";

export type NewCardForClient = ImpactCard & { provisional?: boolean };

const TTL_MS = 5 * 60 * 1000;
const SESSION_KEY = "efootball-team-ai:new-cards-cache:v1";
let cached: { at: number; promise: Promise<NewCardForClient[]> } | null = null;

function readSession(now: number): NewCardForClient[] | null {
  try {
    const raw = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at?: unknown; cards?: unknown };
    if (typeof v.at !== "number" || now - v.at < 0 || now - v.at >= TTL_MS || !Array.isArray(v.cards)) return null;
    return v.cards as NewCardForClient[];
  } catch {
    return null;
  }
}

function writeSession(at: number, cards: NewCardForClient[]): void {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at, cards }));
  } catch {
    /* 保存できなくても動く（次の読み込みで読み直すだけ） */
  }
}

/**
 * /api/world/new-cards を 5 分に 1 回だけ読む（2026-10-17）。同じページに提案の欄が 2 つ（スカッドの比較）あっても、
 * スカッドの編集を続けて開いても、要求は 1 回（そのタブの sessionStorage に 5 分だけ残す・公開のデータだけ）。
 * 失敗は空の一覧（保存せず、次の呼び出しで読み直す）。
 */
export function fetchNewCardsOnce(): Promise<NewCardForClient[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.promise;
  const fromSession = readSession(now);
  if (fromSession) {
    cached = { at: now, promise: Promise.resolve(fromSession) };
    return cached.promise;
  }
  const promise = fetch("/api/world/new-cards")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { cards?: NewCardForClient[] } | null) => {
      if (!Array.isArray(j?.cards)) throw new Error("new-cards unavailable");
      writeSession(now, j.cards);
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
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}
