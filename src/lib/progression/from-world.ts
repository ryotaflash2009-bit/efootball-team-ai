import type { WorldPlayerDetail } from "@/lib/world/types";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import type { ProgressionCard } from "./types";

/**
 * World 選手詳細 → 育成計算の入力カード。
 * 欠損能力値は 40（World の未設定値の慣習）で補完し、必ず26キーそろえる。
 */
export function toProgressionCard(detail: WorldPlayerDetail): ProgressionCard {
  const byKey = new Map(detail.stats.map((s) => [s.key, s.value]));
  const baseStats: Record<string, number> = {};
  for (const key of WORLD_STAT_KEYS) {
    const v = byKey.get(key);
    baseStats[key] = typeof v === "number" && Number.isFinite(v) ? v : 40;
  }
  return {
    worldCardId: detail.worldCardId,
    nameEn: detail.nameEn,
    nameJa: detail.nameJa,
    registeredPosition: detail.registeredPosition,
    cardType: detail.cardType,
    ovrBase: detail.ovrBase,
    ovrMax: detail.ovrMax,
    maximumLevel: detail.maximumLevel,
    baseStats,
    boost1: detail.boost1,
    boost2: detail.boost2,
  };
}
