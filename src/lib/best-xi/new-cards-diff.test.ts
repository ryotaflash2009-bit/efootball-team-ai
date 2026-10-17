import { describe, it, expect } from "vitest";
import { calculateBuild, emptyAllocation } from "@/lib/progression/engine";
import { MESSI_BIGTIME } from "@/lib/progression/fixtures";
import type { ProgressionCard } from "@/lib/progression/types";
import type { BestXiCandidate } from "./types";
import { bestXiWithNewCards, pickNewCardIdsForFormation } from "./new-cards-diff";

const NOW = "2026-10-17T00:00:00.000Z";
const SLOT_POSITIONS = ["GK", "LB", "CB", "CB", "RB", "DMF", "CMF", "CMF", "LWF", "CF", "RWF"];

function card(id: string, pos: string, overrides: Record<string, number> = {}): ProgressionCard {
  return { worldCardId: id, nameEn: `P${id}`, nameJa: `選手${id}`, registeredPosition: pos, cardType: "BASE", ovrBase: 80, ovrMax: 90, maximumLevel: 20, boost1: 0, boost2: 0, baseStats: { ...MESSI_BIGTIME.baseStats, ...overrides } };
}
function cand(c: ProgressionCard): BestXiCandidate {
  const stats = calculateBuild({ card: c, allocation: emptyAllocation(), selectedPlayerBoosters: [], selectedConditionalBoosters: [], manager: null }).stats;
  return { candidateKey: `${c.worldCardId}:base`, worldCardId: c.worldCardId, buildId: null, buildName: null, source: "base", nameJa: c.nameJa, nameEn: c.nameEn, registeredPosition: c.registeredPosition, ruleKind: "current", abilityStatus: "available", stats, ownershipStatus: "owned", intendedPositions: null };
}
const pool = () => SLOT_POSITIONS.map((p, i) => cand(card(String(i + 1), p)));

describe("AI ベスト11 に新しいカードを入れたら（2026-10-17）", () => {
  it("枠のポジションごとに OVR の高い新しいカードを perPosition 枚まで（持っているもの・枠に無いポジションは除く）", () => {
    const nc = (id: string, pos: string, ovrMax: number) => ({ worldCardId: id, nameJa: null, nameEn: id, registeredPosition: pos, ovrBase: 80, ovrMax });
    const ids = pickNewCardIdsForFormation({
      newCards: [nc("a", "CF", 100), nc("b", "CF", 104), nc("c", "CF", 102), nc("d", "CF", 101), nc("e", "SS", 110), nc("f", "GK", 99), nc("g", "GK", 105)],
      slotPositions: SLOT_POSITIONS,
      ownedIds: new Set(["g"]),
      perPosition: 3,
    });
    expect(ids).toEqual(["b", "c", "d", "f"]);
  });

  it("先発に入る新しいカードと、先発から外れる選手を返す（比べる前もいまの候補から選び直す）", () => {
    const base = pool();
    const strongCf = cand(card("99", "CF", { offensiveAwareness: 99, finishing: 99, kickingPower: 99, ballControl: 99, dribbling: 99, speed: 99, acceleration: 99, physicalContact: 99 }));
    const weakGk = cand(card("98", "GK", { gkAwareness: 40, gkCatching: 40, gkParrying: 40, gkReflexes: 40, gkReach: 40 }));
    const r = bestXiWithNewCards({ formationId: "4-3-3", baseCandidates: base, newCandidates: [strongCf, weakGk], unavailableCards: [], generatedAt: NOW });
    expect(r.entering.map((e) => [e.position, e.after.candidate.worldCardId])).toEqual([["CF", "99"]]);
    expect(r.leaving.map((c) => c.worldCardId)).toEqual(["10"]);
  });

  it("新しいカードが無ければ変化なし", () => {
    const r = bestXiWithNewCards({ formationId: "4-3-3", baseCandidates: pool(), newCandidates: [], unavailableCards: [], generatedAt: NOW });
    expect([r.entering, r.leaving]).toEqual([[], []]);
  });
});
