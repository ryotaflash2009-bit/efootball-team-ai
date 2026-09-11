import type { FormationSlot } from "@/lib/squad/types";
import { compareRankTuples, computeRankTuple } from "./rank";
import type { BestXiCandidate, TeamSelectionRankTuple } from "./types";

/**
 * 1つの配置案(スロットID→採用候補、未配置のスロットは含まない)から、
 * チーム全体を比較するための決定的な辞書式タプルを構築する。
 *
 * 合成スコア(重み付き合計)は使わない。`TeamSelectionRankTuple` の各要素を
 * 定義順に比較する(`compareTeamTuples`)。ここでは値を計算するだけで、比較ロジックは持たない。
 */
export function buildTeamRankTuple(params: {
  assignment: ReadonlyMap<string, BestXiCandidate>;
  slots: readonly FormationSlot[];
}): TeamSelectionRankTuple {
  const { assignment, slots } = params;
  const slotByOrder = [...slots].sort((a, b) => a.displayOrder - b.displayOrder);

  let exactSelectionCount = 0;
  let relatedSelectionCount = 0;
  let completeAbilityDataCount = 0;
  let intentPositionMatchCount = 0;
  const positionRatings: number[] = [];
  const tieBreakParts: string[] = [];

  for (const slot of slotByOrder) {
    const candidate = assignment.get(slot.slotId);
    if (!candidate) continue;
    const { tuple, suitability } = computeRankTuple(candidate, slot.position);
    if (suitability.tier === "exact") exactSelectionCount++;
    if (suitability.tier === "related") relatedSelectionCount++;
    if (candidate.abilityStatus === "available") completeAbilityDataCount++;
    if (tuple.intentMatchRank === 0) intentPositionMatchCount++;
    positionRatings.push(tuple.positionRating ?? -Infinity);
    tieBreakParts.push(`${slot.slotId}:${candidate.worldCardId}:${candidate.buildId ?? ""}`);
  }

  // leximin比較のため、弱いスロット(値が低い方)から先に並ぶよう昇順ソートする。
  const positionRatingsAscending = [...positionRatings].sort((a, b) => a - b);

  return {
    filledRequiredSlotCount: assignment.size,
    exactSelectionCount,
    relatedSelectionCount,
    positionRatingsAscending,
    completeAbilityDataCount,
    intentPositionMatchCount,
    stableTieBreakKey: tieBreakParts.join("|"),
  };
}

/**
 * 2つのチーム全体タプルを比較する(a が b より良ければ負、悪ければ正、同点なら0)。
 *
 * 優先順位(タスク要件の1〜7に対応):
 * 1. filledRequiredSlotCount(埋まった必須スロット数、多いほど良い)
 * 2. exactSelectionCount(本職配置数、多いほど良い)
 * 3. relatedSelectionCount(同系統配置数、少ないほど良い)
 * 4. positionRatingsAscending の要素ごと比較(leximin。最も弱いスロットから比較し、
 *    1人だけ極端に高い評価が他の弱いスロットを隠さないようにする)
 * 5. completeAbilityDataCount(能力データ確認済みの人数、多いほど良い)
 * 6. intentPositionMatchCount(保存済み使用予定ポジションと一致した人数、補助的・低優先)
 * 7. stableTieBreakKey(最終的な決定的タイブレーク)
 */
export function compareTeamTuples(a: TeamSelectionRankTuple, b: TeamSelectionRankTuple): number {
  if (a.filledRequiredSlotCount !== b.filledRequiredSlotCount) {
    return b.filledRequiredSlotCount - a.filledRequiredSlotCount;
  }
  if (a.exactSelectionCount !== b.exactSelectionCount) {
    return b.exactSelectionCount - a.exactSelectionCount;
  }
  if (a.relatedSelectionCount !== b.relatedSelectionCount) {
    return a.relatedSelectionCount - b.relatedSelectionCount;
  }
  const leximinCmp = compareLeximinAscending(a.positionRatingsAscending, b.positionRatingsAscending);
  if (leximinCmp !== 0) return leximinCmp;
  if (a.completeAbilityDataCount !== b.completeAbilityDataCount) {
    return b.completeAbilityDataCount - a.completeAbilityDataCount;
  }
  if (a.intentPositionMatchCount !== b.intentPositionMatchCount) {
    return b.intentPositionMatchCount - a.intentPositionMatchCount;
  }
  if (a.stableTieBreakKey !== b.stableTieBreakKey) {
    return a.stableTieBreakKey < b.stableTieBreakKey ? -1 : 1;
  }
  return 0;
}

function compareLeximinAscending(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    // 配列が短い方は「値が存在しない=最弱」として扱う(-Infinity)。
    const av = a[i] ?? -Infinity;
    const bv = b[i] ?? -Infinity;
    if (av !== bv) return bv - av; // 弱いスロット(先頭)が高い方が良い
  }
  return 0;
}
