import { describe, expect, it } from "vitest";
import { applyRemoval, MIN_SAMPLE_FOR_USAGE, trendBetween, viewMetaSnapshot, type MetaSnapshot } from "./meta-contract";

const snap = (o: Partial<MetaSnapshot> = {}): MetaSnapshot => ({ subject: "formation", source: "synthetic", generatedAt: "2026-10-07T00:00:00Z", dataAsOf: "2026-10-06T00:00:00Z", sampleSize: 0, shares: { "4-3-3": 0.5, "4-2-3-1": 0.3, "3-5-2": 0.2 }, removedCount: 0, ...o });

describe("メタ分析の契約", () => {
  it("合成のデータは警告つき・信頼度は低い・割合の大きい順", () => {
    const v = viewMetaSnapshot(snap(), "2026-10-07T00:00:00Z");
    expect(v.warnings).toEqual(["synthetic_data"]);
    expect(v.confidence).toBe("low");
    expect(v.rows.map((r) => r.key)).toEqual(["4-3-3", "4-2-3-1", "3-5-2"]);
  });

  it("オプトインの統計: 母数が最小に満たなければ公開しない・偏りの警告", () => {
    const small = viewMetaSnapshot(snap({ source: "opt-in-usage", sampleSize: MIN_SAMPLE_FOR_USAGE - 1 }), "2026-10-07T00:00:00Z");
    expect(small.publishable).toBe(false);
    expect(small.rows).toEqual([]);
    expect(small.warnings).toEqual(["opt_in_bias", "small_sample"]);
    const ok = viewMetaSnapshot(snap({ source: "opt-in-usage", sampleSize: 600 }), "2026-10-07T00:00:00Z");
    expect(ok).toMatchObject({ publishable: true, confidence: "high", warnings: ["opt_in_bias"] });
  });

  it("古いデータ・割合の合計の不一致を警告する", () => {
    const v = viewMetaSnapshot(snap({ source: "reference", dataAsOf: "2026-09-01T00:00:00Z", shares: { a: 0.5, b: 0.2 } }), "2026-10-07T00:00:00Z");
    expect(v.warnings).toEqual(["shares_not_normalized", "stale"]);
    expect(v.confidence).toBe("low");
  });

  it("同意の撤回で母数を減らし、記録する・時系列の差は同じ対象と出典だけ", () => {
    expect(applyRemoval(snap({ sampleSize: 60 }), 15)).toMatchObject({ sampleSize: 45, removedCount: 15 });
    expect(trendBetween(snap(), snap({ shares: { "4-3-3": 0.4, "4-2-3-1": 0.4, "3-5-2": 0.2 } }))).toEqual([
      { key: "3-5-2", delta: 0 }, { key: "4-2-3-1", delta: 0.1 }, { key: "4-3-3", delta: -0.1 },
    ]);
    expect(trendBetween(snap(), snap({ source: "reference" }))).toBeNull();
  });
});
