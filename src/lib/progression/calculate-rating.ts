import { PROGRESSION_RULES_VERSION } from "./constants";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import type { RatingResult, StatBreakdown } from "./types";

/**
 * 推定 OVR。
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
  const raw = estimateOvrRaw(stats, position, "final");
  return raw === null ? null : Math.round(raw);
}

/** 丸める前の加重平均。`which` で最終値か基礎値かを選ぶ。 */
export function estimateOvrRaw(
  stats: StatBreakdown[],
  position: string | null | undefined,
  which: "final" | "base" = "final",
): number | null {
  if (!stats.length) return null;
  const byKey = new Map(stats.map((s) => [s.key, which === "final" ? s.finalValue : s.baseValue]));
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
  return weighted / total;
}

/**
 * 公式の基礎 OVR に合わせた推定（2026-10-09）。登録ポジションで、World の基礎 OVR（公式の値）があるときは
 *   推定OVR = 公式の基礎 OVR + （育成・ブースター後の加重平均 − 基礎値の加重平均）
 * とする。育成もブースターも無ければ公式の値そのもの。暫定の重みは「変化の量」にだけ使う
 * （重みの絶対値の誤差で、育成していないカードまで公式と大きく違う値を出していたため。13,009 枚で完全一致 4 枚・平均の差 7.53）。
 */
export function anchoredEstimatedOvr(stats: StatBreakdown[], position: string | null | undefined, officialBaseOvr: number | null | undefined): number | null {
  if (typeof officialBaseOvr !== "number" || !Number.isFinite(officialBaseOvr)) return estimateOvr(stats, position);
  const after = estimateOvrRaw(stats, position, "final");
  const before = estimateOvrRaw(stats, position, "base");
  if (after === null || before === null) return Math.round(officialBaseOvr);
  return Math.round(officialBaseOvr + (after - before));
}

export function calculateRating(input: {
  stats: StatBreakdown[];
  position: string | null | undefined;
  storedOvrBase: number | null;
  storedOvrMax: number | null;
}): RatingResult {
  // 登録ポジションの推定は公式の基礎 OVR に合わせる（2026-10-09）。
  const estimatedOvr = anchoredEstimatedOvr(input.stats, input.position, input.storedOvrBase);
  return {
    estimatedOvr,
    confidence: "provisional",
    method: input.storedOvrBase != null ? "official-base-ovr + provisional-weighted-delta" : "position-weighted-average (weights are provisional)",
    note: "推定OVR。公式の基礎 OVR に、育成・ブースターによる変化を暫定の重みで足した概算です（公式の計算式ではありません）。",
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
