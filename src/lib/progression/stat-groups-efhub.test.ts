import { describe, expect, it } from "vitest";
import { calculateProgressionDeltas } from "./calculate-progression";
import { cumulativeCost } from "./point-cost";
import { COST_BLOCK_SIZE_V3 } from "./constants";
import { PROGRESSION_GROUPS, STAT_GROUP_SOURCE, groupIdForStat, groupIdsForStat, validateGroupCoverage } from "./stat-groups";
import type { ProgressionCard } from "./types";

/**
 * eFHUB の育成シミュレーターの定義（2026-10-09 に照合・docs/product/progression-efhub-crosscheck-2026-10-09.md）。
 * eFHUB のキー → TeamAIXI のキー: jump → jumping・ballWinning → tackling・gkClearing → gkParrying・gk1..3 → goalkeeping1..3。
 * ゲームの公式の発表ではない（eFHUB基準）。
 */
const EFHUB_MAPPING: Record<string, string[]> = {
  shooting: ["finishing", "setPieceTaking", "curl"],
  passing: ["lowPass", "loftedPass"],
  dribbling: ["ballControl", "dribbling", "tightPossession"],
  dexterity: ["offensiveAwareness", "acceleration", "balance"],
  lowerBodyStrength: ["speed", "kickingPower", "stamina"],
  aerialStrength: ["heading", "jumping", "physicalContact"],
  defending: ["defensiveAwareness", "tackling", "aggression", "defensiveEngagement"],
  goalkeeping1: ["gkAwareness", "jumping"],
  goalkeeping2: ["gkParrying", "gkReach"],
  goalkeeping3: ["gkCatching", "gkReflexes"],
};

const card = { baseStats: {}, maximumLevel: 30 } as unknown as ProgressionCard;

describe("育成カテゴリの対象能力（eFHUB基準）", () => {
  it("10 カテゴリの対象能力が eFHUB の定義と一致する", () => {
    expect(Object.fromEntries(PROGRESSION_GROUPS.map((g) => [g.groupId, [...g.affectedStats].sort()]))).toEqual(
      Object.fromEntries(Object.entries(EFHUB_MAPPING).map(([k, v]) => [k, [...v].sort()])),
    );
  });

  it("26 能力を覆い、2 つのカテゴリの対象は Jumping だけ", () => {
    expect(validateGroupCoverage()).toEqual({ ok: true, missing: [], duplicated: [] });
    expect(groupIdsForStat("jumping")).toEqual(["aerialStrength", "goalkeeping1"]);
    expect(groupIdForStat("jumping")).toBe("aerialStrength");
    expect(groupIdForStat("speed")).toBe("lowerBodyStrength");
    expect(groupIdForStat("offensiveAwareness")).toBe("dexterity");
  });

  it("Jumping は Aerial Strength と GK 1 のレベルが合算される（eFHUB の applyProgression と同じ）", () => {
    expect(calculateProgressionDeltas(card, { aerialStrength: 3, goalkeeping1: 2 })).toMatchObject({ jumping: 5, heading: 3, gkAwareness: 2 });
  });

  it("1 レベルで対象能力が +1（eFHUB と同じ）", () => {
    const d = calculateProgressionDeltas(card, { dexterity: 1 });
    expect(d).toEqual({ offensiveAwareness: 1, acceleration: 1, balance: 1 });
  });

  it("コスト: レベル L に上げるのに ceil(L/4) pt（eFHUB と同じ・1〜4=1, 5〜8=2, 9〜12=3, 13〜16=4）", () => {
    const efhub = (lv: number) => Array.from({ length: lv }, (_, i) => Math.ceil((i + 1) / 4)).reduce((a, b) => a + b, 0);
    for (let lv = 0; lv <= 25; lv++) expect(cumulativeCost(lv, COST_BLOCK_SIZE_V3)).toBe(efhub(lv));
  });

  it("照合の記録（出典・日付・データの版）を持ち、公式とは書かない", () => {
    expect(STAT_GROUP_SOURCE.sourceId).toBe("efhub");
    expect(STAT_GROUP_SOURCE.checkedAt).toBe("2026-10-09");
    expect(JSON.stringify(STAT_GROUP_SOURCE)).not.toMatch(/official|公式/i);
  });
});
