import { comparisonHref } from "@/lib/comparison/schemas";
import { COMPARISON_MAX } from "@/lib/comparison/types";
import type { CompareBuildMode } from "@/lib/comparison/types";
import type { SquadBuildMode } from "./types";

/**
 * スカッド内の選手 → 既存の比較画面へ。比較専用エンジンは作らない。
 * - 育成方針（buildMode）と スカッド監督を URL に反映（b= / m=）。
 * - 育成配分は URL に入れない（保存ビルドは比較画面側で再選択）。
 */

export interface CompareSelection {
  worldCardId: string;
  buildMode: SquadBuildMode;
}

const WORLD_ID_RE = /^[0-9]{1,20}$/;

export function squadCompareHref(
  selections: CompareSelection[],
  managerId: number | null,
): string {
  const seen = new Set<string>();
  const chosen = selections
    .filter((s) => WORLD_ID_RE.test(s.worldCardId))
    .filter((s) => {
      if (seen.has(s.worldCardId)) return false;
      seen.add(s.worldCardId);
      return true;
    })
    .slice(0, COMPARISON_MAX);

  return comparisonHref({
    ids: chosen.map((s) => s.worldCardId),
    buildModes: chosen.map((s) => s.buildMode as CompareBuildMode),
    managerIds: chosen.map(() => (managerId != null ? managerId : null)),
  });
}
