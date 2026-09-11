import { PROGRESSION_GROUPS } from "./stat-groups";
import type { ProgressionCard } from "./types";

/**
 * 育成レイヤー（v2）: グループ配分（カテゴリレベル）→ 各能力値の「要求上昇量」。
 *
 * provisional: カテゴリレベル L → そのグループの対象能力値がそれぞれ **+L**（要求値）。
 * ここでは 99 上限でクランプしない（上限処理は calculate-final-stats に集約）。
 * これにより「育成 +20 だが最終99（上限）」のように上限が効いている様子を UI で示せる。
 */
export function calculateProgressionDeltas(
  card: ProgressionCard,
  groupAllocation: Record<string, number>,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const g of PROGRESSION_GROUPS) {
    const level = groupAllocation[g.groupId] ?? 0;
    if (level <= 0) continue;
    for (const statKey of g.affectedStats) {
      deltas[statKey] = (deltas[statKey] ?? 0) + level;
    }
  }
  void card;
  return deltas;
}

/** v1 互換: per-stat 配分 → per-stat デルタ（要求値・線形） */
export function calculateProgressionDeltasV1(
  card: ProgressionCard,
  statAllocation: Record<string, number>,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const [statKey, points] of Object.entries(statAllocation)) {
    if (!(points > 0)) continue;
    deltas[statKey] = Math.trunc(points);
  }
  void card;
  return deltas;
}
