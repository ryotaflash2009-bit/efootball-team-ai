/**
 * サイドメニューの「新しいカード」の件数（2026-10-17・本人の承認「作っていいよ」で追加した保存キー 1 つ）。
 *
 * 値（JSON）: { v: 1, seenAt: 最後に新しいカードを見た時刻（ISO・未設定は null）, cache: { at, times } | null }
 * - cache は最近の新しいカードの「追加された時刻」だけ（公開のデータ・5 分）。ページの読み込みごとに API を呼ばないため。
 * - 端末ごとの便利機能だけ（アカウントへは送らない・消えても困らない）。読み書きは必ず try/catch（読めなければ「未設定」）。
 * - 件数 = 最後に見た時刻より後に追加されたカード。未設定なら API が返す範囲（最近 7 日＋暫定）の全部。
 */
export const NEW_CARDS_SEEN_KEY = "efootball-team-ai:new-cards-seen:v1";
export const NEW_CARDS_CACHE_TTL_MS = 5 * 60 * 1000;

export interface NewCardsSeenState {
  seenAt: string | null;
  cache: { at: number; times: number[] } | null;
}

const EMPTY: NewCardsSeenState = { seenAt: null, cache: null };

export function readNewCardsSeenState(storage: Pick<Storage, "getItem"> | null = safeLocalStorage()): NewCardsSeenState {
  try {
    const raw = storage?.getItem(NEW_CARDS_SEEN_KEY) ?? null;
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as { v?: unknown; seenAt?: unknown; cache?: { at?: unknown; times?: unknown } | null };
    if (v?.v !== 1) return EMPTY;
    const seenAt = typeof v.seenAt === "string" && Number.isFinite(Date.parse(v.seenAt)) ? v.seenAt : null;
    const c = v.cache;
    const cache =
      c && typeof c.at === "number" && Number.isFinite(c.at) && Array.isArray(c.times) && c.times.every((t) => typeof t === "number" && Number.isFinite(t))
        ? { at: c.at, times: c.times as number[] }
        : null;
    return { seenAt, cache };
  } catch {
    return EMPTY;
  }
}

function write(state: NewCardsSeenState, storage: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(NEW_CARDS_SEEN_KEY, JSON.stringify({ v: 1, seenAt: state.seenAt, cache: state.cache }));
  } catch {
    /* 保存できなくても動く */
  }
}

export function markNewCardsSeen(now: Date = new Date(), storage: (Pick<Storage, "getItem"> & Pick<Storage, "setItem">) | null = safeLocalStorage()): void {
  write({ ...readNewCardsSeenState(storage), seenAt: now.toISOString() }, storage);
}

/** 新しいカードの追加された時刻を 5 分だけ残す（空の一覧は残さない＝取得の失敗で件数を隠し続けない）。 */
export function cacheNewCardTimes(times: number[], now: number = Date.now(), storage: (Pick<Storage, "getItem"> & Pick<Storage, "setItem">) | null = safeLocalStorage()): void {
  if (times.length === 0) return;
  write({ ...readNewCardsSeenState(storage), cache: { at: now, times } }, storage);
}

export function freshCachedTimes(state: NewCardsSeenState, now: number = Date.now()): number[] | null {
  if (!state.cache) return null;
  const age = now - state.cache.at;
  return age >= 0 && age < NEW_CARDS_CACHE_TTL_MS ? state.cache.times : null;
}

export function addedTimesOf(cards: readonly { addedAt?: string | null }[]): number[] {
  const out: number[] = [];
  for (const c of cards) {
    const t = c.addedAt ? Date.parse(c.addedAt) : Number.NaN;
    if (Number.isFinite(t)) out.push(t);
  }
  return out;
}

/** 最後に見た時刻より後に追加されたカードの枚数。 */
export function unseenNewCardCount(times: readonly number[], seenAt: string | null): number {
  const seen = seenAt ? Date.parse(seenAt) : Number.NEGATIVE_INFINITY;
  return times.filter((t) => t > seen).length;
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
