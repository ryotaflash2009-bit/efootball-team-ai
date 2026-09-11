import { PROGRESSION_RULES_VERSION } from "./constants";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import type { RatingResult, StatBreakdown } from "./types";

/**
 * 推定 OVR（検証中）。
 *
 * 公式の OVR 計算式は未確認（docs/phase-progression-rules.md「D」）。
 * ここではポジション別の加重平均で概算する。**「最大OVR保証」とは表示しない。**
 * 重みは暫定値であり、ゲーム内 OVR とは一致しない。
 */

type W = Partial<Record<string, number>>;

// 暫定の重み（合計は正規化する）。GK は GK 系を重く、フィールドは役割別。
const POSITION_WEIGHTS: Record<string, W> = {
  GK: { gkAwareness: 3, gkCatching: 3, gkParrying: 3, gkReflexes: 3, gkReach: 3, lowPass: 1, loftedPass: 1, kickingPower: 1, physicalContact: 1, jumping: 1 },
  CB: { defensiveAwareness: 3, tackling: 3, defensiveEngagement: 2, aggression: 2, heading: 2, physicalContact: 2, jumping: 2, speed: 1, acceleration: 1, balance: 1, lowPass: 1 },
  LB: { defensiveAwareness: 2, tackling: 2, defensiveEngagement: 2, speed: 2, acceleration: 2, stamina: 2, lowPass: 1, loftedPass: 1, ballControl: 1, curl: 1, aggression: 1 },
  RB: { defensiveAwareness: 2, tackling: 2, defensiveEngagement: 2, speed: 2, acceleration: 2, stamina: 2, lowPass: 1, loftedPass: 1, ballControl: 1, curl: 1, aggression: 1 },
  DMF: { defensiveAwareness: 3, tackling: 2, defensiveEngagement: 2, lowPass: 2, ballControl: 2, offensiveAwareness: 1, stamina: 2, physicalContact: 1, aggression: 1 },
  CMF: { lowPass: 3, ballControl: 2, offensiveAwareness: 2, tightPossession: 2, stamina: 2, defensiveAwareness: 1, tackling: 1, dribbling: 1, loftedPass: 1 },
  LMF: { lowPass: 2, loftedPass: 2, ballControl: 2, dribbling: 2, speed: 2, acceleration: 2, curl: 1, stamina: 1, offensiveAwareness: 1 },
  RMF: { lowPass: 2, loftedPass: 2, ballControl: 2, dribbling: 2, speed: 2, acceleration: 2, curl: 1, stamina: 1, offensiveAwareness: 1 },
  AMF: { offensiveAwareness: 3, ballControl: 2, dribbling: 2, lowPass: 2, tightPossession: 2, finishing: 1, curl: 1, loftedPass: 1 },
  LWF: { speed: 3, acceleration: 3, dribbling: 3, ballControl: 2, finishing: 2, curl: 1, offensiveAwareness: 1, lowPass: 1 },
  RWF: { speed: 3, acceleration: 3, dribbling: 3, ballControl: 2, finishing: 2, curl: 1, offensiveAwareness: 1, lowPass: 1 },
  SS: { offensiveAwareness: 3, finishing: 3, ballControl: 2, dribbling: 2, tightPossession: 1, curl: 1, speed: 1, acceleration: 1 },
  CF: { finishing: 3, offensiveAwareness: 3, heading: 2, ballControl: 2, physicalContact: 1, kickingPower: 1, dribbling: 1, jumping: 1 },
};

const GENERIC_WEIGHTS: W = {
  offensiveAwareness: 1, ballControl: 1, dribbling: 1, lowPass: 1, loftedPass: 1, finishing: 1,
  defensiveAwareness: 1, tackling: 1, speed: 1, acceleration: 1, physicalContact: 1, stamina: 1,
};

export function estimateOvr(
  stats: StatBreakdown[],
  position: string | null | undefined,
): number | null {
  if (!stats.length) return null;
  const byKey = new Map(stats.map((s) => [s.key, s.finalValue]));
  const weights = (position && POSITION_WEIGHTS[position]) || GENERIC_WEIGHTS;

  let weighted = 0;
  let total = 0;
  for (const [key, w] of Object.entries(weights)) {
    const v = byKey.get(key);
    if (typeof v === "number" && typeof w === "number" && w > 0) {
      weighted += v * w;
      total += w;
    }
  }
  if (total === 0) return null;
  return Math.round(weighted / total);
}

export function calculateRating(input: {
  stats: StatBreakdown[];
  position: string | null | undefined;
  storedOvrBase: number | null;
  storedOvrMax: number | null;
}): RatingResult {
  const estimatedOvr = estimateOvr(input.stats, input.position);
  return {
    estimatedOvr,
    confidence: "provisional",
    method: "position-weighted-average (weights are provisional)",
    note: "推定OVR（検証中）。公式の OVR 計算式は未確認のため、ポジション別加重平均による概算です。ゲーム内 OVR とは一致しません。",
    storedOvrBase: input.storedOvrBase,
    storedOvrMax: input.storedOvrMax,
  };
}

export const RATING_RULE_VERSION = PROGRESSION_RULES_VERSION;

/**
 * 指定ポジションの推定OVR計算(POSITION_WEIGHTS/GENERIC_WEIGHTS)が実際に参照する能力値を、
 * 重みの高い順(同じ重みはWORLD_STAT_KEYSの固定順)に並べた配列を返す。
 *
 * 新しい能力重みを作らず、既存のestimateOvrが使う重み表をそのまま再利用するためのヘルパー。
 * AIベスト11でポジション別評価が同点・僅差の候補を、既存の重み定義に基づいて
 * 決定的に比較する(PositionAbilityTieBreakTuple)ために用いる。
 */
export function getPositionAbilityRanking(position: string | null | undefined): string[] {
  const weights = (position && POSITION_WEIGHTS[position]) || GENERIC_WEIGHTS;
  const statOrder = new Map(WORLD_STAT_KEYS.map((k, i) => [k, i]));
  return Object.entries(weights)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .sort(([keyA, wA], [keyB, wB]) => {
      if (wA !== wB) return wB - wA; // 重みが高い方を先に
      return (statOrder.get(keyA) ?? 0) - (statOrder.get(keyB) ?? 0); // 同じ重みはWORLD_STAT_KEYS固定順
    })
    .map(([key]) => key);
}
