import type { ComparisonSummaryEntry } from "./build-analysis";
import type { AbilityComparisonDifference } from "./build-ability-impact";
import type { BuildIntentAnalysis, BuildIntentComparisonResult, BuildIntentInput } from "./build-intent-analysis";

/**
 * 同一カード比較の「表示用要約」を、既存の比較計算結果から決定的に合成する(純関数)。
 *
 * - 計算を再実装しない: build-analysis.ts の comparisonSummary(常時利用可能な一般比較)、
 *   build-ability-impact.ts の comparisonDifferences(26能力値差)、
 *   build-intent-analysis.ts の comparisonRecommendations(目的適合比較・目的が有効な場合のみ)
 *   という既存の確定済みデータを、表示の優先順位に沿って合成するだけ。
 * - 言語非依存の列挙値・groupId・abilityId・数値だけを保持する(完成文はここへ持たない)。
 * - 同一入力からは常に同一の要約を返す(Math.random・現在日時分岐なし)。
 */

export type ComparisonStatus = "comparable" | "partially-comparable" | "not-comparable" | "insufficient-data";
export type OverallSimilarity = "very-similar" | "similar" | "partially-different" | "clearly-different" | "unknown";
export type PurposeSimilarity = "same-purpose" | "close-purpose" | "different-purpose" | "purpose-not-set" | "unknown";
/** 目的関連の能力領域における差の大きさ(「用途の近さ」= purposeSimilarity とは別軸)。 */
export type PurposeDifferenceMagnitude = "very-small" | "small" | "some-difference" | "clear-difference" | "insufficient-data";
export type DifferentiationStatus = "well-differentiated" | "partially-differentiated" | "limited-differentiation" | "not-assessable";

export type ComparisonRecommendationCode =
  | "maintain-role-split"
  | "differentiate-groups"
  | "set-comparison-purpose"
  | "insufficient-data"
  | "not-comparable"
  | "general-comparison-only";

export type ComparisonLimitationCode = "condition-legacy-vs-current" | "condition-one-unallocated" | "ability-data-unavailable" | "comparison-target-not-found";

export interface ComparisonDifferenceItem {
  abilityId: string;
  groupId: string | null;
  /** 現在のビルドが高ければ true、比較対象が高ければ false。 */
  currentHigher: boolean;
  /** 差の絶対値。 */
  diff: number;
}

export interface BuildComparisonSummary {
  targetBuildId: string;
  targetBuildName: string;
  isUserComparisonTarget: boolean;
  comparisonStatus: ComparisonStatus;
  purposeSimilarity: PurposeSimilarity;
  overallSimilarity: OverallSimilarity;
  purposeDifferenceMagnitude: PurposeDifferenceMagnitude;
  differentiationStatus: DifferentiationStatus;
  /** 主な差の中で最も大きいgroupId(存在すれば)。 */
  largestDifferenceGroupId: string | null;
  /** 目的に関係する主な差(最大3件・差0は含めない)。目的未設定時は全26能力値からの主な差。 */
  largestDifferences: ComparisonDifferenceItem[];
  recommendationCode: ComparisonRecommendationCode;
  recommendationGroupId: string | null;
  limitations: ComparisonLimitationCode[];
  detailAvailability: { hasPointsData: boolean; hasOvrData: boolean; hasAbilityData: boolean };
  // --- 詳細表示専用の生データ(要約では使わない・値の再計算はしない) ---
  usedPointsDiff: number | null;
  remainingPointsDiff: number | null;
  calculatedOvrDiff: number | null;
  /** 26能力値差(絶対値降順・既存計算をそのまま再利用。最大5件)。 */
  allAbilityDifferences: ComparisonDifferenceItem[];
}

const MAX_SUMMARY_DIFFERENCES = 3;

function toDifferenceItems(details: { abilityId: string; groupId?: string | null; diff: number }[], max: number): ComparisonDifferenceItem[] {
  return details
    .filter((d) => d.diff !== 0)
    .map((d) => ({ abilityId: d.abilityId, groupId: d.groupId ?? null, currentHigher: d.diff > 0, diff: Math.abs(d.diff) }))
    .slice(0, max);
}

/**
 * 目的関連の主要差(比較観点 > 最優先領域 > 補助的優先領域 > PrimaryGoal由来領域の優先順)を選ぶための
 * 優先groupId集合。既存の comparisonFocusGroups / effectivePriorityGroups / secondaryAlignments を
 * そのまま使う(新しい優先順位計算をしない)。
 */
function purposeRelevantGroupIds(intent: BuildIntentInput, ia: BuildIntentAnalysis): Set<string> {
  if (intent.comparisonFocusGroups.length > 0) return new Set(intent.comparisonFocusGroups);
  const ids = new Set<string>(ia.effectivePriorityGroups);
  for (const a of ia.secondaryAlignments) ids.add(a.groupId);
  return ids;
}

/** 1件の比較対象について、既存データから表示用要約を合成する。 */
export function buildComparisonSummary(
  summary: ComparisonSummaryEntry,
  intentResult: BuildIntentComparisonResult | undefined,
  abilityDiff: AbilityComparisonDifference | undefined,
  intent: BuildIntentInput,
  ia: BuildIntentAnalysis,
): BuildComparisonSummary {
  const limitations: ComparisonLimitationCode[] = [];
  const conditionDifference = abilityDiff?.conditionDifference ?? null;
  if (conditionDifference === "legacy-vs-current") limitations.push("condition-legacy-vs-current");
  if (conditionDifference === "one-unallocated") limitations.push("condition-one-unallocated");

  const hasAbilityData = !!abilityDiff && abilityDiff.classification !== "insufficient-data" && conditionDifference == null;
  if (!hasAbilityData && conditionDifference == null) limitations.push("ability-data-unavailable");

  const hasPointsData = summary.usedPointsDiff != null;
  const hasOvrData = summary.calculatedOvrDiff != null;

  let comparisonStatus: ComparisonStatus;
  if (conditionDifference != null) comparisonStatus = "not-comparable";
  else if (!hasAbilityData) comparisonStatus = "insufficient-data";
  else if (intent.comparisonTargetBuildId != null && intentResult == null) comparisonStatus = "partially-comparable";
  else comparisonStatus = "comparable";

  const hasPurpose = ia.hasIntent && ia.effectivePriorityGroups.length > 0;
  const canAssessPurpose = hasPurpose && comparisonStatus === "comparable" && intentResult != null;

  let purposeSimilarity: PurposeSimilarity;
  if (!hasPurpose) purposeSimilarity = "purpose-not-set";
  else if (!canAssessPurpose) purposeSimilarity = "unknown";
  else if (!summary.hasDifferentPrimaryFocus && intentResult.recommendation === "similar") purposeSimilarity = "same-purpose";
  else if (!summary.hasDifferentPrimaryFocus || intentResult.recommendation === "similar") purposeSimilarity = "close-purpose";
  else if (summary.hasDifferentPrimaryFocus) purposeSimilarity = "different-purpose";
  else purposeSimilarity = "close-purpose";

  let overallSimilarity: OverallSimilarity;
  if (!hasAbilityData || !abilityDiff) overallSimilarity = "unknown";
  else if (abilityDiff.classification === "practically-same") {
    overallSimilarity = abilityDiff.topDifferences.length === 0 ? "very-similar" : "similar";
  } else overallSimilarity = abilityDiff.topDifferences.length >= 3 ? "clearly-different" : "partially-different";

  // 目的関連能力領域における差の大きさ(用途の近さ=purposeSimilarityとは別軸)。
  // 差別化判定はこの大きさから一意に導出する(二重にロジックを持たない)。
  let purposeDifferenceMagnitude: PurposeDifferenceMagnitude;
  if (!canAssessPurpose) purposeDifferenceMagnitude = "insufficient-data";
  else if (intentResult.recommendation === "similar") {
    purposeDifferenceMagnitude = intentResult.closeGroups.length >= ia.effectivePriorityGroups.length ? "very-small" : "small";
  } else {
    purposeDifferenceMagnitude = intentResult.closeGroups.length > 0 ? "some-difference" : "clear-difference";
  }

  let differentiationStatus: DifferentiationStatus;
  switch (purposeDifferenceMagnitude) {
    case "insufficient-data":
      differentiationStatus = "not-assessable";
      break;
    case "very-small":
      differentiationStatus = "limited-differentiation";
      break;
    case "small":
    case "some-difference":
      differentiationStatus = "partially-differentiated";
      break;
    case "clear-difference":
      differentiationStatus = "well-differentiated";
      break;
  }

  // --- 主な差(目的が有効なら既存 keyDifferences をそのまま再利用。目的未設定なら全26能力値の主な差) ---
  const relevantGroups = purposeRelevantGroupIds(intent, ia);
  let largestDifferences: ComparisonDifferenceItem[];
  if (canAssessPurpose && intentResult.keyDifferences.length > 0) {
    largestDifferences = toDifferenceItems(
      intentResult.keyDifferences.map((d) => ({ abilityId: d.abilityId, diff: d.diff })),
      MAX_SUMMARY_DIFFERENCES,
    );
  } else if (hasAbilityData && abilityDiff) {
    // 目的が有効な場合は、目的関連グループの差を優先して抽出する(既存 topDifferences から絞り込むだけ)。
    const prioritized = hasPurpose ? abilityDiff.topDifferences.filter((d) => d.groupId != null && relevantGroups.has(d.groupId)) : [];
    const source = prioritized.length > 0 ? prioritized : abilityDiff.topDifferences;
    largestDifferences = toDifferenceItems(source, MAX_SUMMARY_DIFFERENCES);
  } else {
    largestDifferences = [];
  }
  const largestDifferenceGroupId = largestDifferences[0]?.groupId ?? null;

  // --- 推奨(目的別改善順位と矛盾しない: 同じ recommendation/closeGroups から導出する) ---
  let recommendationCode: ComparisonRecommendationCode;
  let recommendationGroupId: string | null = null;
  if (comparisonStatus === "not-comparable") recommendationCode = "not-comparable";
  else if (comparisonStatus === "insufficient-data") recommendationCode = "insufficient-data";
  else if (!hasPurpose) recommendationCode = "general-comparison-only";
  else if (!canAssessPurpose) recommendationCode = "set-comparison-purpose";
  else if (differentiationStatus === "well-differentiated") recommendationCode = "maintain-role-split";
  else {
    recommendationCode = "differentiate-groups";
    recommendationGroupId = ia.effectivePriorityGroups[0] ?? largestDifferenceGroupId;
  }

  return {
    targetBuildId: summary.otherBuildId,
    targetBuildName: summary.otherBuildName,
    // intentResult.isUserComparisonTarget は目的(優先領域)が有効な場合にしか計算されないため、
    // 目的未設定でも並び順(比較対象を先頭にする)が機能するよう、常に利用可能な intent.comparisonTargetBuildId
    // から直接判定する(intentResultが計算されていても同じ値になる)。
    isUserComparisonTarget: intent.comparisonTargetBuildId != null && intent.comparisonTargetBuildId === summary.otherBuildId,
    comparisonStatus,
    purposeSimilarity,
    overallSimilarity,
    purposeDifferenceMagnitude,
    differentiationStatus,
    largestDifferenceGroupId,
    largestDifferences,
    recommendationCode,
    recommendationGroupId,
    limitations,
    detailAvailability: { hasPointsData, hasOvrData, hasAbilityData },
    usedPointsDiff: summary.usedPointsDiff,
    remainingPointsDiff: summary.remainingPointsDiff,
    calculatedOvrDiff: summary.calculatedOvrDiff,
    allAbilityDifferences: hasAbilityData && abilityDiff ? toDifferenceItems(abilityDiff.topDifferences, abilityDiff.topDifferences.length) : [],
  };
}

/**
 * 比較対象一覧(build-analysis.ts の comparisonSummary を正本の並び順とする。目的未設定でも
 * 常に利用可能)から、表示用要約の配列を決定的に合成する。
 * 並び順: 1) ユーザーが明示した比較対象 → 2) comparisonSummary の既存の決定的な並び(更新日時降順・
 * buildId昇順タイブレーク、build-analysis.ts で既に確定済み)。
 */
export function buildComparisonSummaries(
  comparisonSummaries: ComparisonSummaryEntry[],
  intentResults: BuildIntentComparisonResult[],
  abilityDiffs: AbilityComparisonDifference[],
  intent: BuildIntentInput,
  ia: BuildIntentAnalysis,
): BuildComparisonSummary[] {
  const intentByBuildId = new Map(intentResults.map((r) => [r.otherBuildId, r]));
  const abilityByBuildId = new Map(abilityDiffs.map((d) => [d.otherBuildId, d]));
  const results = comparisonSummaries.map((s) => buildComparisonSummary(s, intentByBuildId.get(s.otherBuildId), abilityByBuildId.get(s.otherBuildId), intent, ia));
  return results.slice().sort((a, b) => Number(b.isUserComparisonTarget) - Number(a.isUserComparisonTarget));
}
