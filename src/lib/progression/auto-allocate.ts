import { PROGRESSION_RULES_VERSION } from "./constants";
import { getRuleset } from "./progression-rules";
import { getProgressionEligibility } from "./card-eligibility";
import {
  normalizeGroupAllocation,
  summarizeGroupPoints,
  maxUsefulLevelForGroup,
} from "./group-allocation";
import type { AutoAllocateProfile, ProgressionCard } from "./types";

/**
 * 自動育成 = **配分方針ヒューリスティック**（v2・グループ単位）。
 * ゲーム内の自動配分アルゴリズムとは異なり、OVR の最大化は保証しない。
 *
 * アルゴリズム（決定的）:
 *  - プロファイルの重み > 0 のグループのみ対象。
 *  - 残ポイントが尽きるか対象がすべて上限になるまで、
 *    「重み / 次段階コスト」が最大のグループへ +1 レベル（同点は groupId 昇順）。
 */

const PROFILE_WEIGHTS: Record<AutoAllocateProfile, Record<string, number>> = {
  attack: { shooting: 3, passing: 3, dribbling: 3, dexterity: 2, lowerBodyStrength: 1, aerialStrength: 1 },
  defense: { defending: 3, aerialStrength: 3, lowerBodyStrength: 2, dexterity: 2 },
  balance: {
    shooting: 2, passing: 2, dribbling: 2, dexterity: 2,
    lowerBodyStrength: 2, aerialStrength: 2, defending: 2,
  },
  gk: { goalkeeping1: 3, goalkeeping2: 3, goalkeeping3: 3, dexterity: 1, lowerBodyStrength: 1 },
};

export interface AutoAllocateResult {
  profile: AutoAllocateProfile;
  allocation: Record<string, number>;
  usedPoints: number;
  remainingPoints: number;
  totalPoints: number;
  note: string;
}

export function autoAllocate(
  card: ProgressionCard,
  profile: AutoAllocateProfile,
  rulesetId?: string | null,
): AutoAllocateResult {
  const ruleset = getRuleset(rulesetId ?? PROGRESSION_RULES_VERSION);
  const eligibility = getProgressionEligibility(card);
  const totalPoints = eligibility.canProgress ? ruleset.totalPoints(card.maximumLevel) : 0;
  const weights = PROFILE_WEIGHTS[profile];

  const allocation: Record<string, number> = {};
  if (totalPoints > 0) {
    const caps = new Map<string, number>();
    for (const gid of Object.keys(weights)) caps.set(gid, maxUsefulLevelForGroup(card, gid));

    let guard = 0;
    while (guard++ < 100000) {
      const summary = summarizeGroupPoints(allocation, card, ruleset.version);
      let bestGid: string | null = null;
      let bestScore = -Infinity;
      for (const [gid, w] of Object.entries(weights)) {
        const level = allocation[gid] ?? 0;
        if (level >= (caps.get(gid) ?? 0)) continue;
        const cost = ruleset.costForNextLevel(level);
        if (summary.remainingPoints < cost) continue;
        const score = w / cost;
        if (score > bestScore || (score === bestScore && bestGid != null && gid < bestGid)) {
          bestScore = score;
          bestGid = gid;
        }
      }
      if (bestGid == null) break;
      allocation[bestGid] = (allocation[bestGid] ?? 0) + 1;
    }
  }

  const normalized = normalizeGroupAllocation(allocation, card).allocation;
  const summary = summarizeGroupPoints(normalized, card, ruleset.version);

  return {
    profile,
    allocation: normalized,
    usedPoints: summary.usedPoints,
    remainingPoints: summary.remainingPoints,
    totalPoints,
    note: !eligibility.canProgress
      ? (eligibility.reason ?? "このカードは育成できません。")
      : `配分方針「${profile}」で ${summary.usedPoints}/${totalPoints} ポイントを配分しました（段階コスト・手動調整可）。`,
  };
}
