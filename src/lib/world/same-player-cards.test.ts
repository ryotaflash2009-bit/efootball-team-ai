import { describe, it, expect } from "vitest";
import { otherCardsOfSamePlayer } from "./same-player-cards";

// 実データ: Roberto Carlos の別カード（人物のキーが同じ）と、名前に同じ語を含む別の選手
const RC = ["88039581945292", "88033139494348", "88035555413452"];
const OTHER = "88036360587367";

describe("同じ選手の別のカード（2026-10-11）", () => {
  it("人物のキーが同じカードだけ・自分は除く・OVR の高い順", () => {
    const r = otherCardsOfSamePlayer(RC[0], [
      { worldCardId: RC[0], nameEn: "Roberto Carlos", ovrMax: 101 },
      { worldCardId: RC[1], nameEn: "Roberto Carlos", cardType: "EPIC", ovrMax: 98 },
      { worldCardId: RC[2], nameEn: "Roberto Carlos", cardType: "EPIC", ovrMax: 100 },
      { worldCardId: OTHER, nameEn: "Roberto Carlos (other)", ovrMax: 99 },
      { worldCardId: RC[1], nameEn: "dup", ovrMax: 98 },
      null,
      { worldCardId: "abc" },
    ]);
    expect(r.map((c) => c.worldCardId)).toEqual([RC[2], RC[1]]);
    expect(r[0]).toMatchObject({ cardType: "EPIC", ovrMax: 100 });
  });
  it("ID が不正なら空", () => {
    expect(otherCardsOfSamePlayer("x", [{ worldCardId: RC[1] }])).toEqual([]);
  });
});
