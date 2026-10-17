import { describe, expect, it } from "vitest";
import { NEW_CARDS_SEEN_KEY, addedTimesOf, cacheNewCardTimes, freshCachedTimes, markNewCardsSeen, readNewCardsSeenState, unseenNewCardCount } from "./seen";

const mem = () => {
  const store = new Map<string, string>();
  return { store, s: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } };
};

describe("サイドメニューの新しいカードの件数（2026-10-17）", () => {
  it("最後に見た時刻より後に追加されたものだけ数える。未設定なら全部・時刻の無いものは除く", () => {
    const times = addedTimesOf([{ addedAt: "2026-10-15T01:00:00Z" }, { addedAt: "2026-10-16T01:00:00Z" }, { addedAt: null }, {}]);
    expect(times).toHaveLength(2);
    expect(unseenNewCardCount(times, null)).toBe(2);
    expect(unseenNewCardCount(times, "2026-10-15T12:00:00Z")).toBe(1);
    expect(unseenNewCardCount(times, "2026-10-17T00:00:00Z")).toBe(0);
  });

  it("見た時刻と 5 分のキャッシュを 1 つのキーに保存し、互いを消さない", () => {
    const { store, s } = mem();
    cacheNewCardTimes([1, 2], 1_000, s);
    markNewCardsSeen(new Date("2026-10-17T00:00:00Z"), s);
    const st = readNewCardsSeenState(s);
    expect(st).toEqual({ seenAt: "2026-10-17T00:00:00.000Z", cache: { at: 1_000, times: [1, 2] } });
    expect([...store.keys()]).toEqual([NEW_CARDS_SEEN_KEY]);
    expect(freshCachedTimes(st, 1_000 + 299_999)).toEqual([1, 2]);
    expect(freshCachedTimes(st, 1_000 + 300_000)).toBeNull();
  });

  it("空の一覧はキャッシュしない。壊れた値・保存の例外は「未設定」", () => {
    const { store, s } = mem();
    cacheNewCardTimes([], 1_000, s);
    expect(store.size).toBe(0);
    store.set(NEW_CARDS_SEEN_KEY, "broken");
    expect(readNewCardsSeenState(s)).toEqual({ seenAt: null, cache: null });
    const throwing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readNewCardsSeenState(throwing)).toEqual({ seenAt: null, cache: null });
    expect(() => markNewCardsSeen(new Date(), throwing)).not.toThrow();
  });
});
