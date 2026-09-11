import { autoAllocate } from "./auto-allocate";
import type { AutoAllocateProfile, ProgressionCard } from "./types";

/** 育成方針（比較・スカッド共通）。none = 育成なし。 */
export type BuildMode = "none" | AutoAllocateProfile;

/**
 * 育成配分の解決（比較機能とスカッド機能で共通）。
 * 優先順位: 明示的な保存済み配分 > 育成方針の自動配分 > 空（育成なし）。
 * ここでは配分を返すだけで、能力値計算は呼び出し側が既存 `calculateBuild` で行う。
 */
export function resolveAllocation(
  card: ProgressionCard,
  buildMode: BuildMode,
  savedAllocation?: Record<string, number> | null,
): Record<string, number> {
  if (savedAllocation && Object.keys(savedAllocation).length > 0) return savedAllocation;
  if (buildMode !== "none") return autoAllocate(card, buildMode).allocation;
  return {};
}
