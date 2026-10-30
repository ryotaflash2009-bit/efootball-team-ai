import { describe, it, expect } from "vitest";
import { placeCardInSlot } from "./place-card";
import { emptySquad } from "./squad-storage";

const A = "88039581945292";
const B = "88036360587367";
const RC_B = "88033139494348"; // A と同じ選手（カード ID の下位 20 ビットが同じ）

function squadWith(slotCard: string | null) {
  const sq = emptySquad("t", "4-3-3");
  const slotId = sq.slots[0].slotId;
  return { sq: { ...sq, slots: sq.slots.map((s) => (s.slotId === slotId ? { ...s, worldCardId: slotCard } : s)) }, slotId };
}

describe("placeCardInSlot", () => {
  it("空いている枠に置く", () => {
    const { sq, slotId } = squadWith(null);
    const r = placeCardInSlot(sq, slotId, B);
    expect(r.ok && r.squad.slots.find((s) => s.slotId === slotId)?.worldCardId).toBe(B);
  });
  it("選手がいる枠は外してから置く（元のカードは残らない）", () => {
    const { sq, slotId } = squadWith(A);
    const r = placeCardInSlot(sq, slotId, B);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.squad.slots.find((s) => s.slotId === slotId)?.worldCardId).toBe(B);
    expect([...r.squad.slots.map((s) => s.worldCardId), ...r.squad.substitutes.map((s) => s.worldCardId)]).not.toContain(A);
  });
  it("同じ選手の別のカードが別の場所にいれば置けない", () => {
    const { sq, slotId } = squadWith(null);
    const other = sq.slots[1].slotId;
    const withA = { ...sq, slots: sq.slots.map((s) => (s.slotId === other ? { ...s, worldCardId: A } : s)) };
    const r = placeCardInSlot(withA, slotId, RC_B);
    expect(r.ok).toBe(false);
  });
  it("元のスカッドは変えない", () => {
    const { sq, slotId } = squadWith(A);
    placeCardInSlot(sq, slotId, B);
    expect(sq.slots.find((s) => s.slotId === slotId)?.worldCardId).toBe(A);
  });
});
