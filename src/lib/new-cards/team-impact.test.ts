import { describe, it, expect } from "vitest";
import { newCardTeamImpact, comparableOvr, type ImpactCard } from "./team-impact";

const card = (id: string, pos: string | null, base: number | null, max: number | null): ImpactCard => ({ worldCardId: id, nameJa: null, nameEn: `P${id}`, registeredPosition: pos, ovrBase: base, ovrMax: max });

describe("新しいカードと My Team の比較（2026-10-17）", () => {
  it("同じポジションの所持の最高を上回るものだけを、差の大きい順に出す", () => {
    const owned = [card("1", "CF", 85, 100), card("2", "CF", 88, 102), card("3", "GK", 80, 99)];
    const r = newCardTeamImpact([card("10", "CF", 90, 105), card("11", "CF", 85, 101), card("12", "GK", 83, 103)], owned);
    expect(r.map((x) => [x.card.worldCardId, x.delta, x.bestOwned?.worldCardId])).toEqual([
      ["12", 4, "3"],
      ["10", 3, "2"],
    ]);
    expect(r[0].basis).toBe("max");
  });

  it("最大 OVR が無いカード（暫定）は基本の OVR どうしで比べる", () => {
    const r = newCardTeamImpact([card("20", "CB", 86, null)], [card("4", "CB", 84, 101)]);
    expect(r[0]).toMatchObject({ basis: "base", newOvr: 86, ownedOvr: 84, delta: 2 });
    expect(comparableOvr(card("x", "CB", 80, null), card("y", "CB", 79, 99))).toEqual({ basis: "base", a: 80, b: 79 });
  });

  it("持っていないポジションは差なし（null）で後ろに出す。既に持っているカード・ポジション不明は出さない", () => {
    const owned = [card("5", "CF", 85, 100), card("30", "LWF", 90, 104)];
    const r = newCardTeamImpact([card("30", "LWF", 90, 104), card("31", "SS", 88, 103), card("32", null, 99, 110), card("33", "CF", 87, 101)], owned);
    expect(r.map((x) => [x.card.worldCardId, x.delta])).toEqual([
      ["33", 1],
      ["31", null],
    ]);
  });
});
