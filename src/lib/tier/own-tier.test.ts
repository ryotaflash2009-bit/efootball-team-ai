import { describe, it, expect } from "vitest";
import { buildOwnTier, sortPositions, pagesNeeded, OWN_TIER_MAX_ENTRIES } from "./own-tier";

const cards = (ovrs: (number | null)[]) => ovrs.map((o, i) => ({ worldCardId: String(1000 + i), ovrMax: o }));

describe("F-090 自前の Tier（最大 OVR のポジション内の順位）", () => {
  it("上位 1% = S・3% = A・6% = B・10% = C、それより下は載せない", () => {
    const list = cards(Array.from({ length: 200 }, (_, i) => 120 - i * 0.1));
    const r = buildOwnTier(list, 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const count = (t: string) => r.entries.filter((e) => e.tier === t).length;
    expect([count("S"), count("A"), count("B"), count("C")]).toEqual([10, 20, 30, 40]);
    expect(r.entries.length).toBe(100);
    expect(r.entries[0]).toMatchObject({ tier: "S", rank: 1, topPercent: 0.1 });
  });

  it("同じ最大 OVR は同じ Tier（最初の順位で決める）", () => {
    const list = cards([110, 105, ...Array(20).fill(100), 99]);
    const r = buildOwnTier(list, 200); // 1% = 2 位まで S、3% = 6 位まで A
    if (!r.ok) throw new Error("not ok");
    const ties = r.entries.filter((e) => e.card.ovrMax === 100);
    expect(new Set(ties.map((e) => e.tier))).toEqual(new Set(["A"]));
    expect(new Set(ties.map((e) => e.rank))).toEqual(new Set([3]));
    expect(r.entries.find((e) => e.card.ovrMax === 99)).toBeUndefined(); // 23 位 = 11.5% → 載せない
  });

  it("母数が少ないポジション・並びが降順でない入力は作らない。最大 OVR の無いカードは除く", () => {
    expect(buildOwnTier(cards([100, 99]), 10)).toEqual({ ok: false, reason: "too_few_cards" });
    expect(buildOwnTier(cards([99, 100]), 100)).toEqual({ ok: false, reason: "not_sorted" });
    const r = buildOwnTier(cards([100, null, 99]), 100);
    expect(r.ok && r.entries.map((e) => e.card.ovrMax)).toEqual([100, 99]);
  });

  it(`載せるのは ${OWN_TIER_MAX_ENTRIES} 件まで`, () => {
    const r = buildOwnTier(cards(Array.from({ length: 400 }, (_, i) => 500 - i)), 4000);
    expect(r.ok && r.entries.length).toBe(OWN_TIER_MAX_ENTRIES);
  });

  it("上位の割合は四捨五入・最小 0.1（0% と出さない）・読むページは C まで（最大 3）", () => {
    const r = buildOwnTier(cards(Array.from({ length: 10 }, (_, i) => 120 - i)), 2253);
    expect(r.ok && r.entries[0].topPercent).toBe(0.1);
    expect([pagesNeeded(500), pagesNeeded(2253), pagesNeeded(10000)]).toEqual([1, 3, 3]);
  });

  it("ポジションの並び: GK から前へ・知らないものは後ろ・形の違うものは除く", () => {
    expect(sortPositions(["CF", "GK", "AMF", "XX", "CB", "bad", "CF"])).toEqual(["GK", "CB", "AMF", "CF", "XX"]);
  });
});
