import { describe, it, expect } from "vitest";
import { countNotOwnedInSquad } from "./not-owned";

const sq = (slots: (string | null)[], subs: string[] = []) => ({
  slots: slots.map((worldCardId, i) => ({ slotId: `s${i}`, worldCardId })),
  substitutes: subs.map((worldCardId, i) => ({ subId: `b${i}`, worldCardId })),
}) as unknown as Parameters<typeof countNotOwnedInSquad>[0];

describe("countNotOwnedInSquad", () => {
  it("所持でない先発・控えのカードを数える（空き枠は数えない）", () => {
    expect(countNotOwnedInSquad(sq(["1", "2", null], ["3"]), new Set(["1"]))).toBe(2);
  });
  it("すべて所持なら 0・空のスカッドも 0", () => {
    expect(countNotOwnedInSquad(sq(["1"], ["2"]), new Set(["1", "2"]))).toBe(0);
    expect(countNotOwnedInSquad(sq([null, null]), new Set())).toBe(0);
  });
  it("同じカードは 1 回だけ", () => {
    expect(countNotOwnedInSquad(sq(["1"], ["1"]), new Set())).toBe(1);
  });
});
