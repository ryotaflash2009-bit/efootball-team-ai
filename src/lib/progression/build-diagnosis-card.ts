import type { SavedBuildAnalysis, AnalysisConfidence } from "./build-analysis";
import type { BuildIntentAnalysis, BuildIntentInput, IntentFinding, IntentFindingCode, IntentAlignment, IntentTopIssueKind } from "./build-intent-analysis";
import type {
  BuildComparisonSummary,
  ComparisonStatus,
  PurposeSimilarity,
  DifferentiationStatus,
  ComparisonRecommendationCode,
  ComparisonLimitationCode,
  ComparisonDifferenceItem,
} from "./build-comparison-summary";

/**
 * 「診断結果カード」の表示用モデル(純関数)。
 *
 * - 新しい分析エンジンではない: Build Analysis / BuildIntentAnalysis / BuildAbilityImpactAnalysis /
 *   BuildComparisonSummary(build-comparison-summary.ts)という既存の確定済みデータを、
 *   カード用に「選定して合成」するだけ。新しい数値計算・新しい優先順位計算は一切行わない。
 * - 言語非依存(列挙値・groupId・abilityId・既存のIntentFinding/IntentTopIssue由来のコード・数値)のみを保持する。
 *   完成した日本語/英語の文章はここへ持たない(UI側で辞書とラベル関数から組み立てる)。
 * - 同一入力からは常に同一のモデルを返す(Math.random・現在日時分岐なし)。
 * - intentAnalysis/analysis/intent はすべて「直前に確定された」状態からのみ計算される(呼び出し側が
 *   draft状態を混ぜて渡さない限り、このモデルは自動的に確定済みデータだけを反映する)。
 */

export type CardVariant = "intent" | "no-intent";

export type CardAbilityDataStatus = "loading" | "unavailable" | "available";

export type CardHeadlineCode =
  | "insufficient-ability-data"
  | "clear-issue"
  | "confirmation-needed"
  | "well-aligned"
  | "well-aligned-with-improvement"
  | "needs-review";

export type ConcernSourceKind = "top-issue" | "top-improvement" | "confirmation" | "overinvestment" | "comparison" | "insufficient-data" | "none";

export interface CardConcernItem {
  sourceKind: ConcernSourceKind;
  groupId: string | null;
  /** sourceKind === "top-issue" の場合のみ設定。 */
  topIssueKind?: IntentTopIssueKind;
  /** sourceKind が "top-improvement" | "confirmation" | "overinvestment" の場合のみ設定。 */
  finding?: IntentFinding;
  /** sourceKind === "comparison" の場合のみ設定。 */
  comparisonNote?: { targetBuildName: string; recommendationCode: ComparisonRecommendationCode; recommendationGroupId: string | null };
}

export interface CardImprovementItem {
  finding: IntentFinding;
  /** 改善候補1位が維持すべき長所と同時表示される場合の対象領域(既存のIntentImprovementCardと同じ規則)。 */
  preserveGroupId: string | null;
}

export interface CardPreserveItem {
  groupId: string;
  /** true = 実データ(representativeAbilities)で確認できた長所。false = 意図はあるが未確認。 */
  confirmed: boolean;
  representativeAbilities: { abilityId: string; delta: number }[];
}

export interface CardAchievementAbility {
  abilityId: string;
  delta: number;
}

export interface CardComparisonItem {
  targetBuildId: string;
  targetBuildName: string;
  isUserComparisonTarget: boolean;
  comparisonStatus: ComparisonStatus;
  purposeSimilarity: PurposeSimilarity;
  differentiationStatus: DifferentiationStatus;
  /** カードでは最大1件のみ(詳細は既存の比較詳細UIへ委ねる)。 */
  majorDifference: ComparisonDifferenceItem | null;
  recommendationCode: ComparisonRecommendationCode;
  recommendationGroupId: string | null;
  limitations: ComparisonLimitationCode[];
}

export interface CardDataAvailability {
  abilityDataStatus: CardAbilityDataStatus;
  hasComparisonData: boolean;
  hasPointsData: boolean;
}

export interface BuildDiagnosisCardModel {
  cardVariant: CardVariant;
  analysisMode: "normal" | "harsh";

  playerDisplayName: string;
  /** 公開情報からカードを識別できない場合は null(内部IDは絶対に代入しない)。 */
  cardDisplayName: string | null;
  buildDisplayName: string;
  intendedPositions: string[];

  /** 確定済み目的プリセットのID(表示はUI側でgetPresetById+辞書titleKeyを解決する。内部IDそのものはDOMへ出さない)。 */
  selectedPrimaryPresetId: string | null;
  selectedSubPresetIds: string[];
  /** 「分析上の中心目的」用の補助情報(選択した育成目的より小さな補足として表示する)。 */
  primaryGoalId: BuildIntentInput["primaryGoal"] | null;

  /** 既存 BuildIntentAnalysis.alignment をそのまま保持する(カード専用の独自判定を作らない)。 */
  alignmentStatus: IntentAlignment;
  /** 既存 SavedBuildAnalysis.confidence.level をそのまま保持する。 */
  confidenceStatus: AnalysisConfidence;

  headline: { code: CardHeadlineCode; groupId: string | null };

  /** 目的と一致している成果(最大3件・差0除外・重複除外・既存の優先順位で選定)。 */
  achievementItems: CardAchievementAbility[];

  /** 最大の注意点(最大1件)。 */
  primaryConcern: CardConcernItem;

  /** 改善候補1位(intentAnalysis.improvementPriorities[0]と同一)。 */
  topImprovement: CardImprovementItem | null;

  /** 維持すべき長所(最大1件)。 */
  preserveHighlight: CardPreserveItem | null;

  /** 比較要約(最大1件・比較対象がなければ null)。 */
  comparisonSummary: CardComparisonItem | null;

  /** 分析上の制限(最大2件・既存のIntentFindingCode由来)。 */
  disclaimerCodes: IntentFindingCode[];

  dataAvailability: CardDataAvailability;

  usedPoints: number;
  totalPoints: number | null;
  remainingPoints: number | null;

  /** 直近の確定分析より後に、未確定の変更(draft)が存在するか(呼び出し側のpresetStatusから渡す)。 */
  hasPendingChanges: boolean;
}

const MAX_ACHIEVEMENT_ABILITIES = 3;

function pushUniqueAbilities(target: CardAchievementAbility[], abilities: { abilityId: string; delta: number }[], seen: Set<string>, max: number): void {
  for (const a of abilities) {
    if (target.length >= max) return;
    if (a.delta === 0) continue;
    if (seen.has(a.abilityId)) continue;
    seen.add(a.abilityId);
    target.push({ abilityId: a.abilityId, delta: a.delta });
  }
}

/** 目的と一致している成果を、既存優先順位(最優先の十分一致→最優先のおおむね一致→補助的優先の確認済み→維持すべき長所)で選ぶ。 */
function selectAchievementItems(ia: BuildIntentAnalysis): CardAchievementAbility[] {
  const result: CardAchievementAbility[] = [];
  const seen = new Set<string>();
  const strong = ia.priorityAlignments.filter((a) => a.state === "strongly-aligned");
  const mostly = ia.priorityAlignments.filter((a) => a.state === "mostly-aligned");
  const secondaryConfirmed = ia.secondaryAlignments.filter((a) => a.state === "strongly-aligned" || a.state === "mostly-aligned");
  for (const a of strong) pushUniqueAbilities(result, a.representativeAbilities, seen, MAX_ACHIEVEMENT_ABILITIES);
  for (const a of mostly) pushUniqueAbilities(result, a.representativeAbilities, seen, MAX_ACHIEVEMENT_ABILITIES);
  for (const a of secondaryConfirmed) pushUniqueAbilities(result, a.representativeAbilities, seen, MAX_ACHIEVEMENT_ABILITIES);
  if (ia.preserveHighlight) pushUniqueAbilities(result, ia.preserveHighlight.representativeAbilities, seen, MAX_ACHIEVEMENT_ABILITIES);
  return result;
}

/** 最大の注意点を、既存データから単一正本の優先順位で選ぶ(カード側で新しい問題を発見しない)。 */
function selectPrimaryConcern(
  ia: BuildIntentAnalysis,
  hasAbilityData: boolean,
  comparison: BuildComparisonSummary | null,
): CardConcernItem {
  if (ia.topIssue) {
    return { sourceKind: "top-issue", groupId: ia.topIssue.groupId, topIssueKind: ia.topIssue.kind };
  }
  if (ia.improvementPriorities.length > 0) {
    const f = ia.improvementPriorities[0];
    return { sourceKind: "top-improvement", groupId: f.groupId, finding: f };
  }
  if (ia.priorityConfirmationItems.length > 0) {
    const f = ia.priorityConfirmationItems[0];
    return { sourceKind: "confirmation", groupId: f.groupId, finding: f };
  }
  const overinvestment = [...ia.avoidOverinvestmentFindings, ...ia.possibleOverinvestmentForIntent][0];
  if (overinvestment) {
    return { sourceKind: "overinvestment", groupId: overinvestment.groupId, finding: overinvestment };
  }
  if (comparison && (comparison.differentiationStatus === "limited-differentiation" || comparison.differentiationStatus === "partially-differentiated")) {
    return {
      sourceKind: "comparison",
      groupId: comparison.recommendationGroupId,
      comparisonNote: { targetBuildName: comparison.targetBuildName, recommendationCode: comparison.recommendationCode, recommendationGroupId: comparison.recommendationGroupId },
    };
  }
  if (!hasAbilityData) {
    return { sourceKind: "insufficient-data", groupId: null };
  }
  return { sourceKind: "none", groupId: null };
}

function selectHeadline(ia: BuildIntentAnalysis, hasAbilityData: boolean): { code: CardHeadlineCode; groupId: string | null } {
  if (!hasAbilityData) return { code: "insufficient-ability-data", groupId: null };
  if (ia.topIssue) return { code: "clear-issue", groupId: ia.topIssue.groupId };
  if (ia.priorityConfirmationItems.length > 0) return { code: "confirmation-needed", groupId: ia.priorityConfirmationItems[0].groupId };
  if (ia.alignment === "high" && ia.improvementPriorities.length === 0) return { code: "well-aligned", groupId: null };
  if (ia.improvementPriorities.length > 0) return { code: "well-aligned-with-improvement", groupId: ia.improvementPriorities[0].groupId };
  return { code: "needs-review", groupId: null };
}

function selectPreserveHighlight(ia: BuildIntentAnalysis): CardPreserveItem | null {
  if (ia.preserveHighlight) {
    return { groupId: ia.preserveHighlight.groupId, confirmed: true, representativeAbilities: ia.preserveHighlight.representativeAbilities };
  }
  if (ia.unconfirmedPreserveGroupIds.length > 0) {
    return { groupId: ia.unconfirmedPreserveGroupIds[0], confirmed: false, representativeAbilities: [] };
  }
  return null;
}

function toCardComparisonItem(s: BuildComparisonSummary): CardComparisonItem {
  return {
    targetBuildId: s.targetBuildId,
    targetBuildName: s.targetBuildName,
    isUserComparisonTarget: s.isUserComparisonTarget,
    comparisonStatus: s.comparisonStatus,
    purposeSimilarity: s.purposeSimilarity,
    differentiationStatus: s.differentiationStatus,
    majorDifference: s.largestDifferences[0] ?? null,
    recommendationCode: s.recommendationCode,
    recommendationGroupId: s.recommendationGroupId,
    limitations: s.limitations,
  };
}

export interface BuildDiagnosisCardInput {
  analysis: SavedBuildAnalysis;
  intentAnalysis: BuildIntentAnalysis;
  intent: BuildIntentInput;
  /** 呼び出し側(BuildAnalysisPanel)が既に合成済みの比較要約(build-comparison-summary.ts)。ここでは再計算しない。 */
  comparisonSummaries: BuildComparisonSummary[];
  mode: "normal" | "harsh";
  playerDisplayName: string;
  cardDisplayName: string | null;
  buildDisplayName: string;
  /** 確定済みプリセット(draftではない)。 */
  confirmedPrimaryPresetId: string | null;
  confirmedSubPresetIds: string[];
  /** 能力値データを取得中か(available=false を「未取得」と「確認不能」で区別する)。 */
  abilityLoading: boolean;
  /** 直近の確定分析より後に未確定の変更があるか(presetStatusが"modified"/"conflicted"等)。 */
  hasPendingChanges: boolean;
}

export function buildDiagnosisCardModel(input: BuildDiagnosisCardInput): BuildDiagnosisCardModel {
  const { analysis, intentAnalysis: ia, intent, comparisonSummaries, mode, playerDisplayName, cardDisplayName, buildDisplayName, confirmedPrimaryPresetId, confirmedSubPresetIds, abilityLoading, hasPendingChanges } =
    input;

  const cardVariant: CardVariant = ia.hasIntent ? "intent" : "no-intent";
  const abilityDataStatus: CardAbilityDataStatus = abilityLoading ? "loading" : analysis.abilityImpact.available ? "available" : "unavailable";
  const hasAbilityData = abilityDataStatus === "available";

  const comparison = comparisonSummaries[0] ?? null;

  const achievementItems = cardVariant === "intent" ? selectAchievementItems(ia) : [];
  const primaryConcern = cardVariant === "intent" ? selectPrimaryConcern(ia, hasAbilityData, comparison) : { sourceKind: "none" as const, groupId: null };
  const headline = cardVariant === "intent" ? selectHeadline(ia, hasAbilityData) : { code: "needs-review" as const, groupId: null };
  const topImprovement: CardImprovementItem | null =
    cardVariant === "intent" && ia.improvementPriorities.length > 0 ? { finding: ia.improvementPriorities[0], preserveGroupId: ia.preserveHighlight?.groupId ?? null } : null;
  const preserveHighlight = cardVariant === "intent" ? selectPreserveHighlight(ia) : null;
  const disclaimerCodes = (cardVariant === "intent" ? ia.limitations : []).slice(0, 2);

  return {
    cardVariant,
    analysisMode: mode,
    playerDisplayName,
    cardDisplayName,
    buildDisplayName,
    intendedPositions: intent.intendedPositions,
    selectedPrimaryPresetId: cardVariant === "intent" ? confirmedPrimaryPresetId : null,
    selectedSubPresetIds: cardVariant === "intent" ? confirmedSubPresetIds : [],
    primaryGoalId: cardVariant === "intent" ? intent.primaryGoal : null,
    alignmentStatus: ia.alignment,
    confidenceStatus: analysis.confidence.level,
    headline,
    achievementItems,
    primaryConcern,
    topImprovement,
    preserveHighlight,
    comparisonSummary: comparison ? toCardComparisonItem(comparison) : null,
    disclaimerCodes,
    dataAvailability: {
      abilityDataStatus,
      hasComparisonData: comparison != null,
      hasPointsData: analysis.totalPoints != null,
    },
    usedPoints: analysis.usedPoints,
    totalPoints: analysis.totalPoints,
    remainingPoints: analysis.remainingPoints,
    hasPendingChanges,
  };
}
