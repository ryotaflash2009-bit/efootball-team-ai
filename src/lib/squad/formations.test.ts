import { describe, it, expect } from "vitest";
import { FORMATIONS, FORMATION_IDS, getFormation, isFormationId } from "./formations";

const REQUIRED = [
  "4-3-3", "4-2-3-1", "4-2-1-3", "4-4-2", "4-2-2-2",
  "4-1-2-3", "3-4-3", "3-4-2-1", "3-5-2", "5-3-2",
];

describe("フォーメーション定義", () => {
  it("必須10種がすべてある", () => {
    for (const id of REQUIRED) expect(FORMATION_IDS).toContain(id);
    expect(FORMATIONS).toHaveLength(10);
  });

  it.each(FORMATIONS.map((f) => [f.id, f] as const))("%s: 11スロット・GK1・slotId重複なし・座標0-100", (_id, f) => {
    expect(f.slots).toHaveLength(11);
    expect(f.slots.filter((s) => s.role === "GK")).toHaveLength(1);
    expect(f.slots.filter((s) => s.position === "GK")).toHaveLength(1);
    const ids = f.slots.map((s) => s.slotId);
    expect(new Set(ids).size).toBe(11);
    for (const s of f.slots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(100);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(100);
      expect(["GK", "DF", "MF", "FW"]).toContain(s.role);
    }
  });

  it.each(FORMATIONS.map((f) => [f.id, f] as const))("%s: 数字部分の合計 + GK = 11", (_id, f) => {
    const nums = f.id.split("-").map(Number);
    const outfield = nums.reduce((a, b) => a + b, 0);
    expect(outfield).toBe(10);
    expect(f.slots.filter((s) => s.role !== "GK")).toHaveLength(outfield);
  });

  it("getFormation は不正IDで既定(4-3-3)へフォールバック", () => {
    expect(getFormation("nope").id).toBe("4-3-3");
    expect(getFormation(null).id).toBe("4-3-3");
    expect(getFormation("4-4-2").id).toBe("4-4-2");
  });

  it("isFormationId", () => {
    expect(isFormationId("3-5-2")).toBe(true);
    expect(isFormationId("9-9-9")).toBe(false);
  });
});
