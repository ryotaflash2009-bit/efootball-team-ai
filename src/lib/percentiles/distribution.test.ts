import { describe, it, expect } from "vitest";
import { buildValueCounts, isValidValueCounts, toCumulative, percentileOf, bucketOf, MIN_POPULATION } from "./distribution";

describe("F-071 分布（値ごとの件数・累積）", () => {
  it("値ごとの件数と累積件数", () => {
    const vc = buildValueCounts([70, 72, 72, 75]);
    expect(vc).toEqual({ min: 70, counts: [1, 0, 2, 0, 0, 1] });
    expect(isValidValueCounts(vc)).toBe(true);
    const d = toCumulative(vc);
    expect(d).toMatchObject({ n: 4, min: 70, max: 75, below: [0, 1, 1, 3, 3, 3] });
  });

  it("範囲外・非整数は生成時に例外", () => {
    expect(() => buildValueCounts([101])).toThrow();
    expect(() => buildValueCounts([-1])).toThrow();
    expect(() => buildValueCounts([70.5])).toThrow();
  });

  it("壊れた件数の表を拒否する", () => {
    expect(isValidValueCounts({ min: 70, counts: [0, 1] })).toBe(false);
    expect(isValidValueCounts({ min: 70, counts: [1, -1, 1] })).toBe(false);
    expect(isValidValueCounts({ min: 99, counts: [1, 1, 1] })).toBe(false);
    expect(isValidValueCounts({ min: 70, counts: [1, 1.5, 1] })).toBe(false);
    expect(isValidValueCounts(null)).toBe(false);
  });
});

describe("F-071 パーセンタイル（midrank）", () => {
  const d = toCumulative(buildValueCounts([70, 72, 72, 75]));

  it("同値は中央順位で数える（下側 + 上位 = 100）", () => {
    const p = percentileOf(d, 72)!;
    expect(p.lowerPercent).toBe(50); // (1 + 2/2) / 4
    expect(p.topPercent).toBe(50); // (1 + 2/2) / 4
    expect(percentileOf(d, 70)!.lowerPercent).toBe(12.5);
    expect(percentileOf(d, 75)!.topPercent).toBe(12.5);
  });

  it("端: 最小・最大・分布の外・分布の中の欠番", () => {
    expect(percentileOf(d, 60)).toMatchObject({ lowerPercent: 0, topPercent: 100 });
    expect(percentileOf(d, 90)).toMatchObject({ lowerPercent: 100, topPercent: 0 });
    expect(percentileOf(d, 73)).toMatchObject({ lowerPercent: 75, topPercent: 25 });
  });

  it("全員同値なら 50", () => {
    const same = toCumulative(buildValueCounts([80, 80, 80]));
    expect(percentileOf(same, 80)).toMatchObject({ lowerPercent: 50, topPercent: 50 });
  });

  it("空の分布・非整数の値は null", () => {
    expect(percentileOf(toCumulative(buildValueCounts([])), 70)).toBeNull();
    expect(percentileOf(d, 72.5)).toBeNull();
  });
});

describe("F-071 区分", () => {
  it("四捨五入した整数%で区分し、上位0%は出さない", () => {
    const n = 10_000;
    expect(bucketOf(0.3, n)).toBe("top_lt1");
    expect(bucketOf(0.6, n)).toBe("top1");
    expect(bucketOf(1.2, n)).toBe("top1");
    expect(bucketOf(4.6, n)).toBe("top5");
    expect(bucketOf(10.4, n)).toBe("top10");
    expect(bucketOf(25, n)).toBe("top25");
    expect(bucketOf(50.4, n)).toBe("top50");
    expect(bucketOf(50.6, n)).toBe("below_median");
    expect(bucketOf(100, n)).toBe("below_median");
  });

  it("小さな母集団では細かい区分を出さない・母数が少なすぎれば表示しない", () => {
    expect(bucketOf(0.3, 999)).toBe("top1");
    expect(bucketOf(0.3, 99)).toBe("top5");
    expect(bucketOf(1, 99)).toBe("top5");
    expect(bucketOf(10, MIN_POPULATION - 1)).toBeNull();
    expect(bucketOf(Number.NaN, 10_000)).toBeNull();
  });
});
