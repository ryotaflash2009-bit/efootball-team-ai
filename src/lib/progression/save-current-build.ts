import { saveBuild, type SaveResult } from "./build-storage";
import type { ProgressionResult, SelectedConditionalBooster } from "./types";

/**
 * 画面の現在のビルドを既存の保存契約（build-storage.saveBuild）で保存する唯一の入口。
 * 保存欄（BuildBar）と育成パネルのクイック保存が同じ関数を使い、保存内容がずれないようにする。
 */
export function saveCurrentBuild(input: {
  worldCardId: string;
  buildName: string;
  allocation: Record<string, number>;
  result: ProgressionResult;
  selectedBooster: number | null;
  conditionalBoosterSelections?: SelectedConditionalBooster[];
}): SaveResult {
  const finalStats: Record<string, number> = {};
  for (const s of input.result.stats) finalStats[s.key] = s.finalValue;
  return saveBuild({
    worldCardId: input.worldCardId,
    buildName: input.buildName,
    progressionAllocation: input.allocation,
    selectedPlayerBooster: input.selectedBooster,
    conditionalBoosterSelections: input.conditionalBoosterSelections,
    calculatedStats: finalStats,
    calculatedOvr: input.result.rating.estimatedOvr,
    calculationMode: input.result.calculationMode,
    rulesVersion: input.result.rulesVersion,
  });
}

/** 配分が同じか（0 のカテゴリは無いものとして扱う）。保存済みとの差分（未保存の変更）判定に使う。 */
export function sameAllocation(a: Record<string, number>, b: Record<string, number>): boolean {
  const norm = (x: Record<string, number>) =>
    Object.entries(x)
      .filter(([, v]) => Number.isFinite(v) && v > 0)
      .sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0));
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
