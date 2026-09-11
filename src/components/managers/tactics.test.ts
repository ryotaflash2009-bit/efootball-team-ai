import { describe, it, expect } from "vitest";
import { TACTICS, tacticTier, topTactic, managerInitials } from "./tactics";
import type { TacticalProficiencies } from "@/lib/managers/types";

const P = (o: Partial<TacticalProficiencies>): TacticalProficiencies => ({
  possessionGame: null,
  quickCounter: null,
  longBallCounter: null,
  outWide: null,
  longBall: null,
  overload: null,
  ...o,
});

describe("戦術メタ", () => {
  it("6項目・略称・英名・和名がそろう", () => {
    expect(TACTICS).toHaveLength(6);
    for (const t of TACTICS) {
      expect(t.abbr.length).toBeGreaterThan(0);
      expect(t.en.length).toBeGreaterThan(0);
      expect(t.ja.length).toBeGreaterThan(0);
    }
    expect(TACTICS.map((t) => t.abbr)).toEqual(["PG", "QC", "LBC", "OW", "LB", "O"]);
  });

  it("tacticTier は数値帯で段階を返す（色だけに依存しない土台）", () => {
    expect(tacticTier(95)).toBe("elite");
    expect(tacticTier(85)).toBe("high");
    expect(tacticTier(72)).toBe("mid");
    expect(tacticTier(63)).toBe("low");
    expect(tacticTier(40)).toBe("poor");
    expect(tacticTier(null)).toBe("none");
  });

  it("topTactic は最高適性を返す（同値は定義順で最初）", () => {
    expect(topTactic(P({ possessionGame: 68, quickCounter: 90, outWide: 89 }))?.abbr).toBe("QC");
    expect(topTactic(P({ possessionGame: 89, outWide: 89 }))?.abbr).toBe("PG");
    expect(topTactic(P({}))).toBeNull();
  });

  it("managerInitials", () => {
    expect(managerInitials("Antonio Conte")).toBe("AC");
    expect(managerInitials("Pep Guardiola")).toBe("PG");
    expect(managerInitials("Ronald")).toBe("RO");
    expect(managerInitials("  ")).toBe("?");
  });
});
