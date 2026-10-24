import { describe, expect, it } from "vitest";
import { positionSummary } from "./position-summary";
import type { ImpactCard } from "@/lib/new-cards/team-impact";

const c = (id: string, pos: string, base: number | null, max: number | null): ImpactCard => ({ worldCardId: id, nameJa: null, nameEn: id, registeredPosition: pos, ovrBase: base, ovrMax: max });

describe("My Team のポジション別のまとめ（2026-10-25）", () => {
  it("13 のポジションの順に、枚数・最も強いカード・新しいカードで強化できる枚数", () => {
    const rows = positionSummary(
      [c("a", "CF", 85, 100), c("b", "CF", 88, 104), c("g", "GK", 80, 95)],
      [c("n1", "CF", 90, 106), c("n2", "CF", 85, 99), c("n3", "LB", 80, 96), c("n4", "LB", 81, 97), c("b", "CF", 88, 104)],
    );
    expect(rows).toHaveLength(13);
    expect(rows[0].position).toBe("GK");
    const cf = rows.find((r) => r.position === "CF")!;
    expect([cf.count, cf.best?.worldCardId, cf.bestOvr, cf.upgrades]).toEqual([2, "b", 104, 1]);
    // 持っていないポジションは、そのポジションの新しいカードの枚数
    const lb = rows.find((r) => r.position === "LB")!;
    expect([lb.count, lb.best, lb.upgrades]).toEqual([0, null, 2]);
  });
});
