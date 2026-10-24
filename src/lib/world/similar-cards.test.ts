import { describe, it, expect } from "vitest";
import { pickSimilarCards, similarCardsQuery } from "./similar-cards";

// 実データの ID: Roberto Carlos の別カード（人物のキーが同じ）と、別の選手
const RC = ["88039581945292", "88033139494348"];
const OTHER = "88036360587367";

describe("似ているカード（2026-10-25）", () => {
  it("条件: 同じポジション・同じプレースタイル・最大 OVR ±3", () => {
    const q = new URLSearchParams(similarCardsQuery({ registeredPosition: "LB", playingStyle: "Offensive Full-back", ovrMax: 101 }) ?? "");
    expect(Object.fromEntries(q)).toMatchObject({ position: "LB", playingStyle: "Offensive Full-back", minOvr: "98", maxOvr: "104", sort: "ovr_max_desc" });
    expect(similarCardsQuery({ registeredPosition: "LB", playingStyle: null, ovrMax: 90 })).not.toContain("playingStyle");
    expect(similarCardsQuery({ registeredPosition: null, playingStyle: null, ovrMax: 90 })).toBeNull();
    expect(similarCardsQuery({ registeredPosition: "LB", playingStyle: null, ovrMax: null })).toBeNull();
  });
  it("自分と同じ選手の別のカードを除き、OVR の差の小さい順", () => {
    const r = pickSimilarCards(RC[0], 101, [
      { worldCardId: RC[0], ovrMax: 101 },
      { worldCardId: RC[1], ovrMax: 101 },
      { worldCardId: "1000", ovrMax: 98 },
      { worldCardId: OTHER, ovrMax: 102, playingStyle: "Offensive Full-back" },
      { worldCardId: "1001", ovrMax: 100 },
      { worldCardId: "1001", ovrMax: 100 },
      null,
    ]);
    expect(r.map((c) => c.worldCardId)).toEqual([OTHER, "1001", "1000"]);
    expect(r[0].playingStyle).toBe("Offensive Full-back");
  });
  it("最大で 6 枚", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ worldCardId: String(2000 + i), ovrMax: 90 }));
    expect(pickSimilarCards("1", 90, many)).toHaveLength(6);
  });
});
