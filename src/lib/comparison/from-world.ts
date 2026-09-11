import type { WorldPlayerDetail } from "@/lib/world/types";
import type { ManagerContext, ConditionalBoosterSelection } from "@/lib/progression/types";
import { toProgressionCard } from "@/lib/progression/from-world";
import { resolveAttachedBooster } from "@/lib/progression/booster-resolution";
import { normalizeGroupAllocation } from "@/lib/progression/group-allocation";
import type { CompareBuildMode, ComparisonPlayerInput } from "./types";

/**
 * World 選手詳細 → 比較入力。育成カード変換は既存の toProgressionCard を再利用。
 */
export function worldDetailToComparisonInput(
  detail: WorldPlayerDetail,
  opts: {
    buildMode?: CompareBuildMode;
    savedAllocation?: Record<string, number> | null;
    savedBuildName?: string | null;
    manager?: ManagerContext | null;
    /** Total Package の条件段階（このカードに条件付き付属があるときのみ有効） */
    conditionalTier?: ConditionalBoosterSelection;
  } = {},
): ComparisonPlayerInput {
  const card = toProgressionCard(detail);

  // URL / 保存ビルド由来の手動配分はこのカードに対して再検証・再クランプする（不正 1 件で全体を壊さない）。
  let savedAllocation: Record<string, number> | null = null;
  if (opts.savedAllocation && Object.keys(opts.savedAllocation).length > 0) {
    const norm = normalizeGroupAllocation(opts.savedAllocation, card).allocation;
    savedAllocation = Object.keys(norm).length > 0 ? norm : null;
  }

  const selectedConditionalBoosters: ComparisonPlayerInput["selectedConditionalBoosters"] = [];
  if (opts.conditionalTier && opts.conditionalTier !== "none") {
    for (const [slot, id] of [
      [1, card.boost1],
      [2, card.boost2],
    ] as const) {
      const r = resolveAttachedBooster("world", slot, id);
      if (r && r.activation === "power_of_many") {
        selectedConditionalBoosters.push({ boosterKey: r.boosterKey, selection: opts.conditionalTier });
      }
    }
  }
  return {
    card,
    display: {
      worldCardId: detail.worldCardId,
      nameEn: detail.nameEn,
      nameJa: detail.nameJa,
      cardType: detail.cardType,
      registeredPosition: detail.registeredPosition,
      playingStyle: detail.playingStyle,
      playingStyleDefensive: detail.playingStyleDefensive,
      nationality: detail.nationality,
      region: detail.region,
      league: detail.league,
      team: detail.team,
      age: detail.age,
      height: detail.height,
      weight: detail.weight,
      preferredFoot: detail.preferredFoot,
      ovrBase: detail.ovrBase,
      ovrMax: detail.ovrMax,
      maximumLevel: detail.maximumLevel,
      hasEfhubLink: detail.hasEfhubLink,
      efhubCardId: detail.efhubCardId,
      imageUrlCandidate: detail.imageUrlCandidate,
      mobileImageUrlCandidate: detail.mobileImageUrlCandidate,
      playerSkills: detail.playerSkills,
      aiStyles: detail.aiStyles,
    },
    buildMode: opts.buildMode ?? "none",
    savedAllocation,
    savedBuildName: opts.savedBuildName ?? null,
    manager: opts.manager ?? null,
    selectedConditionalBoosters: selectedConditionalBoosters.length ? selectedConditionalBoosters : undefined,
  };
}
