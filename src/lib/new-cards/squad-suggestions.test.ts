import { describe, it, expect } from "vitest";
import { squadNewCardSuggestions } from "./squad-suggestions";
import type { ImpactCard } from "./team-impact";

const c = (id: string, pos: string, base: number | null, max: number | null): ImpactCard => ({ worldCardId: id, nameJa: null, nameEn: id, registeredPosition: pos, ovrBase: base, ovrMax: max });

describe("スカッドの枠ごとの新しいカードの提案（2026-10-17）", () => {
  it("今の選手より強い同じポジションの新しいカードを枠ごとに 1 枚（差の最も大きいもの）", () => {
    const slots = [
      { slotId: "cf", position: "CF", current: c("a", "CF", 85, 100) },
      { slotId: "lcb", position: "CB", current: c("b", "CB", 88, 104) },
    ];
    const r = squadNewCardSuggestions(slots, [c("n1", "CF", 86, 102), c("n2", "CF", 88, 105), c("n3", "CB", 86, 103)], new Set());
    expect(r.map((x) => [x.slotId, x.suggestion.worldCardId, x.delta])).toEqual([["cf", "n2", 5]]);
  });

  it("空いている枠は最も OVR の高い新しいカード・先に並べる。スカッドにいるカードは提案しない", () => {
    const slots = [
      { slotId: "gk", position: "GK", current: null },
      { slotId: "cf", position: "CF", current: c("a", "CF", 80, 95) },
    ];
    const r = squadNewCardSuggestions(slots, [c("g1", "GK", 82, 99), c("g2", "GK", 84, 101), c("n1", "CF", 90, 104), c("n2", "CF", 91, 106)], new Set(["n2"]));
    expect(r.map((x) => [x.slotId, x.suggestion.worldCardId, x.delta])).toEqual([
      ["gk", "g2", null],
      ["cf", "n1", 9],
    ]);
  });

  it("最大 OVR の無い暫定のカードは基本の OVR どうしで比べる", () => {
    const r = squadNewCardSuggestions([{ slotId: "rb", position: "RB", current: c("a", "RB", 80, 99) }], [c("p", "RB", 83, null)], new Set());
    expect(r[0]).toMatchObject({ basis: "base", newOvr: 83, currentOvr: 80, delta: 3 });
  });

  it("同じカード・同じ選手の別のカードを 2 つの枠に出さない（2 つの CB の枠には別々の選手）", () => {
    const P = (person: number, v: number) => String(v * 1048576 + person);
    const slots = [
      { slotId: "lcb", position: "CB", current: null },
      { slotId: "rcb", position: "CB", current: null },
    ];
    const r = squadNewCardSuggestions(slots, [c(P(7, 1), "CB", 90, 105), c(P(7, 2), "CB", 89, 104), c(P(8, 1), "CB", 85, 100)], new Set());
    expect(r.map((x) => x.suggestion.worldCardId).sort()).toEqual([P(7, 1), P(8, 1)].sort());
  });

  it("スカッドの他の枠にいる選手の別のカードは出さない。その枠の今の選手の別のカードへの入れ替えは出す", () => {
    const P = (person: number, v: number) => String(v * 1048576 + person);
    const slots = [
      { slotId: "cf", position: "CF", current: c(P(1, 1), "CF", 80, 95) },
      { slotId: "lwf", position: "LWF", current: c(P(2, 1), "LWF", 80, 95) },
    ];
    const r = squadNewCardSuggestions(slots, [c(P(1, 2), "CF", 90, 105), c(P(1, 3), "LWF", 90, 106)], new Set([P(1, 1), P(2, 1)]));
    expect(r.map((x) => [x.slotId, x.suggestion.worldCardId])).toEqual([["cf", P(1, 2)]]);
  });
});
