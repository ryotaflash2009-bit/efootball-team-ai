import { COST_BLOCK_SIZE, STAT_CAP, STAT_FLOOR } from "./constants";

/**
 * 育成ポイントの消費規則。
 *
 * v2（provisional）: グループへの配分（カテゴリレベル）が増えるほど、次の1段階のコストが増える。
 * pesmastery の実例（0-4段階は1pt、5段階目以降は2pt）を「COST_BLOCK_SIZE(5) 段階ごとに +1」へ一般化。
 *   costForNextLevel(currentLevel) = 1 + floor(currentLevel / 5)
 * 9段階/13段階以降は外挿。
 */

/** currentLevel から currentLevel+1 へ上げるのに必要なポイント */
export function costForNextLevel(currentLevel: number): number {
  const lv = Math.max(0, Math.trunc(currentLevel));
  return 1 + Math.floor(lv / COST_BLOCK_SIZE);
}

/** 0 から level までの累積コスト */
export function cumulativeCost(level: number): number {
  const target = Math.max(0, Math.trunc(level));
  let sum = 0;
  for (let i = 0; i < target; i++) sum += costForNextLevel(i);
  return sum;
}

/** 予算 budget で到達できる最大レベル */
export function maxLevelForBudget(budget: number): number {
  let spent = 0;
  let level = 0;
  while (spent + costForNextLevel(level) <= budget) {
    spent += costForNextLevel(level);
    level++;
    if (level > 200) break;
  }
  return level;
}

/** v1 互換: 能力値 +by の線形コスト（旧ルールセット用） */
export function linearCostForIncrease(currentValue: number, increaseBy: number): number {
  if (!Number.isFinite(increaseBy) || increaseBy <= 0) return 0;
  return Math.trunc(increaseBy);
}

/** その能力値に投入して意味のある最大上昇（= 99 までの残り） */
export function maxUsefulPointsForStat(currentValue: number): number {
  return Math.max(0, STAT_CAP - Math.max(STAT_FLOOR, Math.trunc(currentValue)));
}
