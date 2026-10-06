import { describe, it, expect } from "vitest";
import { discoverYourBest, discoverYourBestExtras } from "./your-best";
import type { CardPercentile } from "@/lib/percentiles/card-percentiles";
import type { PercentileBucket } from "@/lib/percentiles/distribution";

const P = (bucket: PercentileBucket, topPercent: number): CardPercentile => ({ bucket, topPercent, n: 5000 });

describe("F-073 あなたの一番", () => {
  it("規則ごとに、役割の範囲で最も上位のカード（規則の中で最も低い能力で比べる）", () => {
    const r = discoverYourBest([
      { worldCardId: "1", role: "field", percentiles: new Map([["speed", P("top1", 1)], ["acceleration", P("top25", 20)]]) },
      { worldCardId: "2", role: "field", percentiles: new Map([["speed", P("top10", 8)], ["acceleration", P("top10", 9)]]) },
      { worldCardId: "3", role: "gk", percentiles: new Map([["speed", P("top1", 0.5)], ["acceleration", P("top1", 0.5)], ["gkAwareness", P("top5", 4)]]) },
    ]);
    const pace = r.find((e) => e.ruleId === "pace");
    expect(pace).toEqual({ ruleId: "pace", worldCardId: "2", weakestBucket: "top10", candidates: 2 });
    expect(r.find((e) => e.ruleId === "gkAwareness")?.worldCardId).toBe("3");
  });

  it("同点は worldCardId の昇順。中央値未満しかいない規則は出さない", () => {
    const same = new Map([["stamina", P("top25", 20)]]);
    expect(discoverYourBest([
      { worldCardId: "9", role: "field", percentiles: same },
      { worldCardId: "10", role: "field", percentiles: same },
    ]).find((e) => e.ruleId === "stamina")?.worldCardId).toBe("10");
    expect(discoverYourBest([{ worldCardId: "1", role: "field", percentiles: new Map([["stamina", P("below_median", 70)]]) }])).toEqual([]);
  });

  it("カードが無ければ空", () => {
    expect(discoverYourBest([])).toEqual([]);
  });
});

describe("あなたの一番の追加の項目（v2）", () => {
  const card = (worldCardId: string, ovrBase: number | null, ovrMax: number | null, registeredPosition: string | null, cardType: string | null) => ({ worldCardId, ovrBase, ovrMax, registeredPosition, cardType });
  it("最高の OVR・伸びしろ・最も少ないポジション・カード種別", () => {
    const r = discoverYourBestExtras([card("3", 90, 104, "CF", "EPIC"), card("1", 70, 98, "CB", "Standard"), card("2", 85, 100, "CF", "Standard")]);
    expect(r.find((e) => e.id === "highestRated")).toMatchObject({ worldCardId: "3", value: 104, candidates: 3 });
    expect(r.find((e) => e.id === "largestGrowth")).toMatchObject({ worldCardId: "1", value: 28 });
    expect(r.find((e) => e.id === "rarestPosition")).toMatchObject({ worldCardId: "1", label: "CB", value: 1 });
    expect(r.find((e) => e.id === "rarestCardType")).toMatchObject({ worldCardId: "3", label: "EPIC", value: 1 });
  });
  it("同点は worldCardId の小さい方・ラベルの同点はラベルの順（決定的）", () => {
    const r = discoverYourBestExtras([card("9", 80, 100, "CF", "A"), card("5", 80, 100, "CB", "B")]);
    expect(r.find((e) => e.id === "highestRated")!.worldCardId).toBe("5");
    expect(r.find((e) => e.id === "rarestPosition")).toMatchObject({ label: "CB", worldCardId: "5" });
    const again = discoverYourBestExtras([card("5", 80, 100, "CB", "B"), card("9", 80, 100, "CF", "A")]);
    expect(again).toEqual(r);
  });
  it("カードが 1 枚・全員同じポジションや種別・伸びしろ 0・データなしでは出さない", () => {
    expect(discoverYourBestExtras([card("1", 80, 90, "CF", "A")])).toEqual([]);
    const same = discoverYourBestExtras([card("1", 90, 90, "CF", "A"), card("2", 90, 90, "CF", "A")]);
    expect(same.map((e) => e.id)).toEqual(["highestRated"]);
    expect(discoverYourBestExtras([card("1", null, null, null, null), card("2", null, null, null, null)])).toEqual([]);
  });
});
