import { describe, it, expect } from "vitest";
import { discoverYourBest } from "./your-best";
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
