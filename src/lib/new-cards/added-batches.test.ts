import { describe, expect, it } from "vitest";
import { addedBatches, jstDate } from "./added-batches";

const c = (id: string, addedAt: string | null, ovrMax: number | null, ovrBase: number | null = null) => ({ worldCardId: id, addedAt, ovrMax, ovrBase });

describe("追加された日ごとのまとまり（2026-10-17）", () => {
  it("日本時間の日付でまとめ、新しい日を先に", () => {
    expect(jstDate("2026-10-15T15:30:00Z")).toBe("2026-10-16");
    expect(jstDate("2026-10-15T14:59:59Z")).toBe("2026-10-15");
    const r = addedBatches([c("1", "2026-10-15T14:00:00Z", 100), c("2", "2026-10-15T16:00:00Z", 101), c("3", "2026-10-16T01:00:00Z", 99)]);
    expect(r.map((b) => [b.date, b.count, b.ids])).toEqual([
      ["2026-10-16", 2, ["2", "3"]],
      ["2026-10-15", 1, ["1"]],
    ]);
  });

  it("OVR の高い順に最大 limit 枚（基本の OVR で代わり）・日付の無いものは除く", () => {
    const r = addedBatches([c("a", "2026-10-16T01:00:00Z", null, 80), c("b", "2026-10-16T01:00:00Z", 104), c("c", "2026-10-16T01:00:00Z", 90), c("x", null, 120)], 2);
    expect(r).toEqual([{ date: "2026-10-16", count: 3, ids: ["b", "c"], allIds: ["b", "c", "a"], truncated: true }]);
  });
});
