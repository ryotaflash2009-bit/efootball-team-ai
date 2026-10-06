import { describe, expect, it } from "vitest";
import type { StatBreakdown } from "@/lib/progression/types";
import { diagnoseSquad, type SquadDiagnosisInput, type SquadDiagnosisPlayerInput } from "./squad-diagnosis";
import { getFormation } from "./formations";
import { applySquadChanges, IMPROVEMENT_SIMULATION_VERSION, rankBenchSwaps, simulateSquadChanges } from "./improvement-simulation";

const KEYS = [
  "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
  "finishing", "heading", "setPieceTaking", "curl", "defensiveAwareness", "tackling", "aggression",
  "defensiveEngagement", "gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach",
  "speed", "acceleration", "kickingPower", "jumping", "physicalContact", "balance", "stamina",
];
function makeStats(base = 60): StatBreakdown[] {
  return KEYS.map((key) => ({
    key, nameEn: key, group: "offense", baseValue: base, progressionDelta: 0, playerBoosterDelta: 0, managerBoosterDelta: 0, otherDelta: 0,
    uncappedValue: base, finalValue: base, capApplied: false, source: "base", confidence: "confirmed", gameMeasuredBoosterDelta: 0,
    externalVerifiedBoosterDelta: 0, conditionalBoosterDelta: 0, manualTrialBoosterDelta: 0, confirmedB2BoosterDelta: 0,
    experimentalPlayerBoosterDelta: 0, strictFinalValue: base, standardFinalValue: base, conditionalFinalValue: base,
    conditionalCapApplied: false, experimentalFinalValue: base, experimentalCapApplied: false,
  }) as StatBreakdown);
}
function player(o: Partial<SquadDiagnosisPlayerInput>): SquadDiagnosisPlayerInput {
  return { key: "x", worldCardId: "1", nameJa: "選手", nameEn: "Player", registeredPosition: "CF", role: "FW", assignedPosition: "CF", compatibilityStatus: "exact", isCaptain: false, cardResolved: true, stats: makeStats(), savedBuildId: null, savedBuildStatus: "none", ...o };
}
function squad(benchValues: number[] = [], weakSlot = 9, weakValue = 50): SquadDiagnosisInput {
  const f = getFormation("4-3-3");
  const starters = f.slots.map((s, i) => player({ key: s.slotId, role: s.role, assignedPosition: s.position, registeredPosition: s.position, stats: makeStats(i === weakSlot ? weakValue : 65) }));
  const bench = benchValues.map((v, i) => player({ key: `sub${i}`, role: null, assignedPosition: null, compatibilityStatus: null, registeredPosition: i === 0 ? starters[weakSlot].assignedPosition : "CMF", stats: makeStats(v) }));
  return { squadId: "sq_sim0001", squadName: "Sim", updatedAt: "2026-10-07T00:00:00.000Z", formationId: "4-3-3", starters, bench, managerId: null, managerResolved: true, managerApplied: false };
}

describe("改善シミュレーション", () => {
  it("控えとの入れ替え: 弱い先発を強い控えに替えると総合が上がり、前後の差が出る", () => {
    const input = squad([85]);
    const weak = input.starters[9];
    const sim = simulateSquadChanges(input, [{ kind: "swap", starterKey: weak.key, benchKey: "sub0" }]);
    expect(sim.version).toBe(IMPROVEMENT_SIMULATION_VERSION);
    expect(sim.rejected).toEqual([]);
    expect(sim.overall.delta).not.toBeNull();
    expect(sim.overall.delta!).toBeGreaterThan(0);
    expect(sim.categories.some((c) => (c.delta ?? 0) > 0)).toBe(true);
  });

  it("元の入力を書き換えない・同じ入力と変更は同じ結果（決定的）", () => {
    const input = squad([85, 70]);
    const before = JSON.stringify(input);
    const a = simulateSquadChanges(input, [{ kind: "swap", starterKey: input.starters[9].key, benchKey: "sub0" }]);
    const b = simulateSquadChanges(input, [{ kind: "swap", starterKey: input.starters[9].key, benchKey: "sub0" }]);
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("入れ替えた選手は控えへ・キャプテンは控えでは外れる・適性は新しい配置で決まる", () => {
    const input = squad([85]);
    input.starters[9] = { ...input.starters[9], isCaptain: true };
    const { input: after } = applySquadChanges(input, [{ kind: "swap", starterKey: input.starters[9].key, benchKey: "sub0" }]);
    expect(after.starters[9].worldCardId).toBe(input.bench[0].worldCardId);
    expect(after.starters[9].compatibilityStatus).toBe("exact");
    expect(after.bench[0].isCaptain).toBe(false);
    expect(after.bench[0].assignedPosition).toBeNull();
  });

  it("配置の変更: 適性外のポジションへ動かすと適性が変わる・GK とフィールドの移動は拒否", () => {
    const input = squad();
    const cf = input.starters[9];
    const moved = applySquadChanges(input, [{ kind: "move", starterKey: cf.key, position: "CB" }]);
    expect(moved.input.starters[9].assignedPosition).toBe("CB");
    expect(moved.input.starters[9].compatibilityStatus).not.toBe("exact");
    const gk = input.starters[0];
    expect(applySquadChanges(input, [{ kind: "move", starterKey: gk.key, position: "CB" }]).rejected.length).toBe(1);
  });

  it("存在しないキー・カードの無い控えは適用しない（理由を返す）", () => {
    const input = squad([80]);
    input.bench[0] = { ...input.bench[0], cardResolved: false, stats: null };
    const r = applySquadChanges(input, [{ kind: "swap", starterKey: "nope", benchKey: "sub0" }, { kind: "swap", starterKey: input.starters[9].key, benchKey: "sub0" }]);
    expect(r.rejected).toHaveLength(2);
    expect(JSON.stringify(r.input.starters)).toBe(JSON.stringify(input.starters));
  });

  it("入れ替え候補の順位: 改善の大きい順・改善しない候補は出さない・GK は GK とだけ", () => {
    const input = squad([85, 55, 72]);
    const ranked = rankBenchSwaps(input, 5);
    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].overallDelta).toBeGreaterThanOrEqual(ranked[i].overallDelta);
    for (const c of ranked) {
      expect(c.overallDelta).toBeGreaterThan(0);
      expect(c.starterKey).not.toBe(input.starters[0].key); // GK はフィールドの控えと入れ替えない
    }
    expect(ranked[0].benchKey).toBe("sub0");
  });

  it("同点は決まった順（先発のキー → 控えのキー）で、何度計算しても同じ", () => {
    const input = squad([85, 85]);
    const a = rankBenchSwaps(input, 10).map((c) => `${c.starterKey}:${c.benchKey}:${c.overallDelta}`);
    const b = rankBenchSwaps(input, 10).map((c) => `${c.starterKey}:${c.benchKey}:${c.overallDelta}`);
    expect(a).toEqual(b);
  });

  it("総合が判定できないスカッドでは候補を出さない", () => {
    const input = squad([90]);
    const empty = { ...input, starters: input.starters.map((s) => ({ ...s, cardResolved: false, stats: null })) };
    expect(diagnoseSquad(empty).overall.score).toBeNull();
    expect(rankBenchSwaps(empty)).toEqual([]);
  });
});
