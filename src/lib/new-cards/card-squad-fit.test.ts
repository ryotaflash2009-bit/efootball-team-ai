import { describe, it, expect } from "vitest";
import { squadsStrengthenedByCard, type SquadFitInput } from "./card-squad-fit";
import type { ImpactCard } from "./team-impact";

const c = (id: string, pos: string, max: number | null): ImpactCard => ({ worldCardId: id, nameJa: null, nameEn: id, registeredPosition: pos, ovrBase: max == null ? null : max - 10, ovrMax: max });
const sq = (squadId: string, slots: SquadFitInput["slots"], extra: string[] = []): SquadFitInput => ({
  squadId,
  squadName: squadId,
  slots,
  inSquad: new Set([...slots.map((s) => s.current?.worldCardId).filter((x): x is string => !!x), ...extra]),
});

describe("1 枚のカードで強くなる保存スカッド（2026-10-26）", () => {
  const card = c("new", "RB", 100);
  it("同じポジションの今の選手より強いスカッドだけ・差の大きい順", () => {
    const out = squadsStrengthenedByCard(card, [
      sq("A", [{ slotId: "rb", position: "RB", current: c("x", "RB", 95) }]),
      sq("B", [{ slotId: "rb", position: "RB", current: c("y", "RB", 90) }]),
      sq("C", [{ slotId: "rb", position: "RB", current: c("z", "RB", 101) }]),
      sq("D", [{ slotId: "cf", position: "CF", current: null }]),
    ]);
    expect(out.map((f) => [f.squadId, f.delta])).toEqual([["B", 10], ["A", 5]]);
  });
  it("空いている枠は差のあるスカッドの後", () => {
    const out = squadsStrengthenedByCard(card, [
      sq("E", [{ slotId: "rb", position: "RB", current: null }]),
      sq("F", [{ slotId: "rb", position: "RB", current: c("w", "RB", 99) }]),
    ]);
    expect(out.map((f) => f.squadId)).toEqual(["F", "E"]);
  });
  it("すでにそのスカッドにいるカードは出さない", () => {
    const out = squadsStrengthenedByCard(card, [sq("G", [{ slotId: "rb", position: "RB", current: c("v", "RB", 80) }], ["new"])]);
    expect(out).toEqual([]);
  });
});
