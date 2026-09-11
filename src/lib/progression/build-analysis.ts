import type { SavedBuild } from "./types";
import { buildPointSummary, describeBuildPoM, buildHasExperimental, buildTimeValue, resolveBuildRuleStatus } from "./my-builds";
import { PROGRESSION_GROUPS } from "./stat-groups";
import type { BuildRuleKind } from "./build-inventory";
import { lowerPriorityGroupIds, type BuildIntentInput } from "./build-intent-analysis";
import {
  analyzeBuildAbilityImpact,
  type AbilityCardInput,
  type AbilityFindingCode,
  type AbilitySiblingInput,
  type BuildAbilityImpactAnalysis,
} from "./build-ability-impact";

/**
 * 保存ビルド個別分析（Build Analysis 画面「このビルドを分析」）。
 *
 * - 純関数のみ。生成AI・外部API・HTTP・Math.random・現在日時分岐・localStorage/SQLite/DOM直接アクセスなし。
 * - 入力オブジェクトを変更しない。同一入力からは常に同一の結果を返す。
 * - 分析結果は言語非依存の構造化データ（groupId・数値・FindingCode）として保持する。
 *   日本語/英語の文章化は呼び出し側（UI・辞書）が FindingCode ごとのテンプレートで行う。
 * - 既存の育成計算（calculateBuild・26能力値・B1/B2/Power of Many・監督補正・ポジション別OVR）は
 *   一切再計算しない。既存の SavedBuild / buildPointSummary / describeBuildPoM 等の
 *   既存の確認済みデータ・既存の純関数の出力だけを入力として使う。
 */

// ---------------------------------------------------------------------------
// 入力
// ---------------------------------------------------------------------------

/** 分析対象カードの最小限の安全な情報（内部IDのみで表示できない値は含めない）。 */
export interface BuildAnalysisCardInput {
  worldCardId: string;
  nameJa: string | null;
  nameEn: string | null;
  cardType: string | null;
  registeredPosition: string | null;
  maximumLevel: number | null;
  ovrBase: number | null;
  ovrMax: number | null;
  boost1: number | null;
  boost2: number | null;
}

/** 同一カードの他の保存ビルド（比較用・最小限）。 */
export interface SiblingBuildInput {
  buildId: string;
  buildName: string;
  progressionAllocation: Record<string, number>;
  calculatedOvr: number | null;
  /** 保存時点の最終能力値（SavedBuild.calculatedStats）。能力値比較に使う。省略時は「データなし」扱い。 */
  calculatedStats?: Record<string, number>;
  rulesVersion: string;
  createdAt: string;
  updatedAt: string;
  used: boolean;
}

export interface BuildAnalysisInput {
  build: SavedBuild;
  card: BuildAnalysisCardInput | null;
  ruleKind: BuildRuleKind;
  hasReferenceAnomaly: boolean;
  isUsed: boolean;
  /** 同一 worldCardId の他の保存ビルド（このビルド自身は含めない）。 */
  siblings: SiblingBuildInput[];
  /**
   * 能力値分析用のカード（育成前26能力値を含む・オンデマンド取得）。
   * - `undefined`: 能力値分析を今回のこの呼び出しでは行わない（未取得・未対応時の後方互換）。
   * - `null`: 取得を試みたが確認できなかった（取得不能・分析信頼度を下げる）。
   * - `AbilityCardInput`: 取得済み。
   */
  abilityCard?: AbilityCardInput | null;
}

// ---------------------------------------------------------------------------
// 出力（言語非依存の構造化データ）
// ---------------------------------------------------------------------------

export type CompletionState = "unallocated" | "in-progress" | "near-complete" | "complete" | "unknown";

export type TrainingFocusKind = "none" | "single" | "dominant" | "balanced";

export interface AllocationSummaryEntry {
  groupId: string;
  nameEn: string;
  level: number;
  isGoalkeeping: boolean;
}

export interface TrainingFocus {
  kind: TrainingFocusKind;
  isGoalkeeping: boolean;
  primaryGroupId: string | null;
  primaryGroupNameEn: string | null;
  primaryLevel: number | null;
  primaryShare: number | null;
  secondaryGroupId: string | null;
  secondaryGroupNameEn: string | null;
  secondaryLevel: number | null;
}

export interface GroupRef {
  groupId: string;
  nameEn: string;
}

/**
 * 分析の各所見を表す言語非依存コード。表示文言は呼び出し側（UI・辞書）が
 * mode（通常/辛口）ごとのテンプレートへ params を埋め込んで生成する。
 */
export type FindingCode =
  | "no-allocation"
  | "focused-primary-category"
  | "balanced-allocation"
  | "near-fully-allocated"
  | "many-remaining-points"
  | "underinvested-area-present"
  | "legacy-or-unknown-rules"
  | "reference-anomaly"
  | "experimental-trial-included"
  | "power-of-many-included"
  | "unique-vs-siblings"
  | "overlaps-with-sibling"
  | "overlaps-with-sibling-ability-confirmed"
  | "insufficient-data"
  | "over-allocated-points"
  | "ability-gain-reflects-focus"
  | "ability-gain-highlight"
  | "ability-comparison-practically-same"
  | "ability-comparison-different-focus"
  | AbilityFindingCode;

export interface Finding {
  code: FindingCode;
  params: Record<string, string | number>;
}

export interface ImprovementSuggestion {
  priority: number;
  code: FindingCode;
  targetGroupId: string | null;
  targetGroupNameEn: string | null;
  /** 対応後も維持すべき既存の長所（あれば）。 */
  preserveGroupId: string | null;
  params: Record<string, string | number>;
}

/**
 * 一般改善候補(improvementSuggestions)から、目的プリセットで低優先または今回は評価対象外に
 * 指定した領域を対象とするものを除外する(この一般分析自体は目的を一切知らないため、目的が
 * 確定している場合に限り、表示側でこのフィルタを適用して「低配分であることだけを理由に、
 * 目的側で意図的に低くした領域を改善候補にする」矛盾を避ける)。
 * 一般分析の計算結果そのもの(improvementSuggestions の中身)は変更しない、表示直前の絞り込みのみ。
 */
export function filterImprovementSuggestionsForIntent(suggestions: ImprovementSuggestion[], intent: BuildIntentInput): ImprovementSuggestion[] {
  const excludedIds = new Set([...lowerPriorityGroupIds(intent), ...intent.intentionallyIgnoredGroups]);
  if (excludedIds.size === 0) return suggestions;
  return suggestions.filter((s) => !s.targetGroupId || !excludedIds.has(s.targetGroupId));
}

export interface ComparisonSummaryEntry {
  otherBuildId: string;
  otherBuildName: string;
  usedPointsDiff: number | null;
  remainingPointsDiff: number | null;
  calculatedOvrDiff: number | null;
  hasDifferentPrimaryFocus: boolean;
  primaryGroupId: string | null;
  otherPrimaryGroupId: string | null;
  otherUsed: boolean;
  otherUpdatedAt: string;
}

export type AnalysisConfidence = "high" | "medium" | "limited" | "unavailable";

export interface ConfidenceAssessment {
  level: AnalysisConfidence;
  reasons: FindingCode[];
}

export interface SavedBuildAnalysis {
  worldCardId: string;
  buildId: string;
  completionState: CompletionState;
  usedPoints: number;
  totalPoints: number | null;
  remainingPoints: number | null;
  overAllocated: boolean;
  allocationSummary: AllocationSummaryEntry[];
  trainingFocus: TrainingFocus;
  strongestGrowthAreas: GroupRef[];
  underinvestedAreas: GroupRef[];
  strengths: Finding[];
  concerns: Finding[];
  normalReviewPoints: Finding[];
  harshReviewPoints: Finding[];
  improvementSuggestions: ImprovementSuggestion[];
  comparisonSummary: ComparisonSummaryEntry[];
  confidence: ConfidenceAssessment;
  limitations: FindingCode[];
  /** 能力値インパクト分析（build-ability-impact.ts）。abilityCard 未指定時は available=false の空の結果。 */
  abilityImpact: BuildAbilityImpactAnalysis;
}

// ---------------------------------------------------------------------------
// しきい値（このアプリ独自の表示用ヒューリスティック。ゲーム内の公式規則の主張ではない）
// ---------------------------------------------------------------------------

const DOMINANT_SHARE_THRESHOLD = 0.4;
const CLOSE_SECOND_RATIO = 0.7;
const NEAR_COMPLETE_RATIO = 0.1;
const MANY_REMAINING_RATIO = 0.3;
const MAX_STRENGTHS = 3;
const MAX_CONCERNS = 3;
const MAX_SUGGESTIONS = 3;
const MAX_UNDERINVESTED = 3;
const MAX_COMPARISONS = 3;

// ---------------------------------------------------------------------------
// 内部ヘルパー（純関数・非破壊）
// ---------------------------------------------------------------------------

function positiveAllocationEntries(
  allocation: Record<string, number>,
): { groupId: string; nameEn: string; isGoalkeeping: boolean; level: number }[] {
  return PROGRESSION_GROUPS.map((g, idx) => {
    const raw = allocation[g.groupId];
    const level = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0;
    return { groupId: g.groupId, nameEn: g.nameEn, isGoalkeeping: g.isGoalkeeping, level, idx };
  })
    .filter((e) => e.level > 0)
    .sort((a, b) => (b.level !== a.level ? b.level - a.level : a.idx - b.idx));
}

function classifyTrainingFocus(allocation: Record<string, number>): TrainingFocus {
  const entries = positiveAllocationEntries(allocation);
  if (entries.length === 0) {
    return {
      kind: "none",
      isGoalkeeping: false,
      primaryGroupId: null,
      primaryGroupNameEn: null,
      primaryLevel: null,
      primaryShare: null,
      secondaryGroupId: null,
      secondaryGroupNameEn: null,
      secondaryLevel: null,
    };
  }
  const totalLevels = entries.reduce((s, e) => s + e.level, 0);
  const top = entries[0];
  const second = entries[1] ?? null;
  const topShare = totalLevels > 0 ? top.level / totalLevels : 0;
  const secondCloseness = second && top.level > 0 ? second.level / top.level : 0;

  let kind: TrainingFocusKind;
  if (entries.length === 1) kind = "single";
  else if (topShare < DOMINANT_SHARE_THRESHOLD || secondCloseness >= CLOSE_SECOND_RATIO) kind = "balanced";
  else kind = "dominant";

  return {
    kind,
    isGoalkeeping: top.isGoalkeeping,
    primaryGroupId: top.groupId,
    primaryGroupNameEn: top.nameEn,
    primaryLevel: top.level,
    primaryShare: topShare,
    secondaryGroupId: second?.groupId ?? null,
    secondaryGroupNameEn: second?.nameEn ?? null,
    secondaryLevel: second?.level ?? null,
  };
}

function computeAllocationSummary(allocation: Record<string, number>): AllocationSummaryEntry[] {
  return PROGRESSION_GROUPS.map((g) => {
    const raw = allocation[g.groupId];
    const level = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0;
    return { groupId: g.groupId, nameEn: g.nameEn, level, isGoalkeeping: g.isGoalkeeping };
  });
}

function computeUnderinvestedAreas(allocationSummary: AllocationSummaryEntry[], focus: TrainingFocus): GroupRef[] {
  if (focus.kind === "none") return [];
  const candidateSet = allocationSummary.filter((e) => e.isGoalkeeping === focus.isGoalkeeping);
  return candidateSet
    .filter((e) => e.level === 0 && e.groupId !== focus.primaryGroupId)
    .slice(0, MAX_UNDERINVESTED)
    .map((e) => ({ groupId: e.groupId, nameEn: e.nameEn }));
}

function computeCompletionState(usedPoints: number, totalPoints: number | null, remainingPoints: number | null): CompletionState {
  if (totalPoints == null || remainingPoints == null) return "unknown";
  if (usedPoints <= 0) return "unallocated";
  if (remainingPoints <= 0) return "complete";
  const ratio = totalPoints > 0 ? remainingPoints / totalPoints : 0;
  return ratio <= NEAR_COMPLETE_RATIO ? "near-complete" : "in-progress";
}

/** AbilityFinding（groupId が独立フィールド）を既存の Finding（groupId は params.categoryId）へ変換する。 */
function abilityFindingToFinding(f: { code: FindingCode; groupId: string | null; params: Record<string, string | number> }): Finding {
  return { code: f.code, params: f.groupId ? { ...f.params, categoryId: f.groupId } : f.params };
}

/** abilityCard が未指定（後方互換・能力値分析を行わない呼び出し）のときの空の結果。 */
function emptyAbilityImpact(): BuildAbilityImpactAnalysis {
  return {
    available: false,
    baseAbilities: null,
    trainedAbilities: null,
    finalAbilities: null,
    abilityDeltas: null,
    largestGains: [],
    smallestGains: [],
    highestFinalAbilities: [],
    lowestFinalAbilities: [],
    groupImpact: [],
    overinvestmentFindings: [],
    underinvestmentFindings: [],
    comparisonDifferences: [],
    confidenceReasons: [],
  };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

export function analyzeSavedBuild(input: BuildAnalysisInput): SavedBuildAnalysis {
  const { build, card, ruleKind, hasReferenceAnomaly, siblings } = input;
  const allocation = build.progressionAllocation ?? {};
  const points = buildPointSummary(build, card?.maximumLevel ?? null);
  const allocationSummary = computeAllocationSummary(allocation);
  const focus = classifyTrainingFocus(allocation);
  const underinvested = computeUnderinvestedAreas(allocationSummary, focus);
  const completionState = computeCompletionState(points.usedPoints, points.totalPoints, points.remainingPoints);
  const overAllocated = points.overAllocated === true;
  const pom = describeBuildPoM(build);
  const experimental = buildHasExperimental(build);

  // --- 能力値インパクト分析（abilityCard が明示的に渡された場合のみ実行・後方互換のため未指定なら空） ---
  const abilityImpact: BuildAbilityImpactAnalysis =
    input.abilityCard !== undefined
      ? analyzeBuildAbilityImpact({
          progressionAllocation: allocation,
          calculatedStats: build.calculatedStats ?? {},
          rulesVersionIsCurrent: ruleKind === "current",
          card: input.abilityCard,
          siblings: siblings.map(
            (s): AbilitySiblingInput => ({
              buildId: s.buildId,
              buildName: s.buildName,
              progressionAllocation: s.progressionAllocation,
              calculatedStats: s.calculatedStats ?? {},
              rulesVersionIsCurrent: resolveBuildRuleStatus(s.rulesVersion).isV2,
            }),
          ),
        })
      : emptyAbilityImpact();

  const strongestGrowthAreas: GroupRef[] = [];
  if (focus.primaryGroupId && focus.primaryGroupNameEn) {
    strongestGrowthAreas.push({ groupId: focus.primaryGroupId, nameEn: focus.primaryGroupNameEn });
  }
  if (focus.kind === "balanced" && focus.secondaryGroupId && focus.secondaryGroupNameEn) {
    strongestGrowthAreas.push({ groupId: focus.secondaryGroupId, nameEn: focus.secondaryGroupNameEn });
  }

  // --- 比較（同一カードの他の保存ビルド） ---
  const comparisonSummary: ComparisonSummaryEntry[] = siblings
    .slice()
    .sort((a, b) => {
      const ta = buildTimeValue(a.updatedAt);
      const tb = buildTimeValue(b.updatedAt);
      if (ta == null && tb == null) return a.buildId.localeCompare(b.buildId);
      if (ta == null) return 1;
      if (tb == null) return -1;
      return tb !== ta ? tb - ta : a.buildId.localeCompare(b.buildId);
    })
    .slice(0, MAX_COMPARISONS)
    .map((sib) => {
      const sibPoints = buildPointSummary(
        {
          ...build,
          progressionAllocation: sib.progressionAllocation,
          rulesVersion: sib.rulesVersion,
        },
        card?.maximumLevel ?? null,
      );
      const sibFocus = classifyTrainingFocus(sib.progressionAllocation ?? {});
      const usedPointsDiff = sibPoints.usedPoints - points.usedPoints;
      const remainingPointsDiff =
        sibPoints.remainingPoints == null || points.remainingPoints == null
          ? null
          : sibPoints.remainingPoints - points.remainingPoints;
      const calculatedOvrDiff =
        sib.calculatedOvr != null && build.calculatedOvr != null ? sib.calculatedOvr - build.calculatedOvr : null;
      const hasDifferentPrimaryFocus =
        focus.primaryGroupId != null && sibFocus.primaryGroupId != null
          ? focus.primaryGroupId !== sibFocus.primaryGroupId
          : focus.primaryGroupId !== sibFocus.primaryGroupId;
      return {
        otherBuildId: sib.buildId,
        otherBuildName: sib.buildName,
        usedPointsDiff,
        remainingPointsDiff,
        calculatedOvrDiff,
        hasDifferentPrimaryFocus,
        primaryGroupId: focus.primaryGroupId,
        otherPrimaryGroupId: sibFocus.primaryGroupId,
        otherUsed: sib.used,
        otherUpdatedAt: sib.updatedAt,
      };
    });

  // --- 長所 ---
  const strengths: Finding[] = [];
  if (focus.kind === "dominant" || focus.kind === "single") {
    strengths.push({
      code: "focused-primary-category",
      params: {
        categoryId: focus.primaryGroupId ?? "",
        level: focus.primaryLevel ?? 0,
      },
    });
  } else if (focus.kind === "balanced" && allocationSummary.filter((e) => e.level > 0).length >= 3) {
    strengths.push({ code: "balanced-allocation", params: { count: allocationSummary.filter((e) => e.level > 0).length } });
  }
  if (completionState === "complete" || completionState === "near-complete") {
    strengths.push({
      code: "near-fully-allocated",
      params: { remaining: points.remainingPoints ?? 0 },
    });
  }
  if (focus.kind !== "none" && comparisonSummary.length > 0 && comparisonSummary.every((c) => c.hasDifferentPrimaryFocus)) {
    strengths.push({
      code: "unique-vs-siblings",
      params: { categoryId: focus.primaryGroupId ?? "", count: comparisonSummary.length },
    });
  }
  if (abilityImpact.available && (focus.kind === "dominant" || focus.kind === "single") && focus.primaryGroupId) {
    const primaryImpact = abilityImpact.groupImpact.find((g) => g.groupId === focus.primaryGroupId);
    if (primaryImpact?.reflectedInHighestFinal) {
      strengths.push({
        code: "ability-gain-reflects-focus",
        params: { categoryId: focus.primaryGroupId, delta: primaryImpact.totalTrainedDelta },
      });
    }
  }

  // --- 注意点（重大な参照異常を先頭に） ---
  const concerns: Finding[] = [];
  if (hasReferenceAnomaly) {
    concerns.push({ code: "reference-anomaly", params: {} });
  }
  if (overAllocated) {
    concerns.push({ code: "over-allocated-points", params: { used: points.usedPoints, total: points.totalPoints ?? 0 } });
  }
  if (abilityImpact.available) {
    for (const f of abilityImpact.overinvestmentFindings) concerns.push(abilityFindingToFinding(f));
  }
  if (focus.kind === "none") {
    concerns.push({ code: "no-allocation", params: {} });
  }
  if (ruleKind !== "current") {
    concerns.push({ code: "legacy-or-unknown-rules", params: {} });
  }
  if (points.totalPoints != null && points.remainingPoints != null && points.remainingPoints > 0) {
    const ratio = points.totalPoints > 0 ? points.remainingPoints / points.totalPoints : 0;
    if (ratio >= MANY_REMAINING_RATIO) {
      concerns.push({ code: "many-remaining-points", params: { remaining: points.remainingPoints, total: points.totalPoints } });
    }
  }
  if (underinvested.length > 0) {
    concerns.push({
      code: "underinvested-area-present",
      params: { categoryId: underinvested[0].groupId, count: underinvested.length },
    });
    if (abilityImpact.available) {
      const ctx = abilityImpact.underinvestmentFindings.find((f) => f.groupId === underinvested[0].groupId);
      if (ctx) concerns.push(abilityFindingToFinding(ctx));
    }
  }
  if (comparisonSummary.some((c) => !c.hasDifferentPrimaryFocus) && focus.kind !== "none") {
    const overlapping = comparisonSummary.find((c) => !c.hasDifferentPrimaryFocus);
    concerns.push({
      code: "overlaps-with-sibling",
      params: { siblingName: overlapping?.otherBuildName ?? "" },
    });
  }

  const strengthsCapped = strengths.slice(0, MAX_STRENGTHS);
  const concernsCapped = concerns.slice(0, MAX_CONCERNS);

  // --- 通常評価 / 辛口評価（同じ所見コードを異なる並び・重み付けで再利用） ---
  const normalReviewPoints: Finding[] = [];
  if (focus.kind === "none") {
    normalReviewPoints.push({ code: "no-allocation", params: {} });
  } else if (focus.kind === "dominant" || focus.kind === "single") {
    normalReviewPoints.push({ code: "focused-primary-category", params: { categoryId: focus.primaryGroupId ?? "", level: focus.primaryLevel ?? 0 } });
  } else {
    normalReviewPoints.push({ code: "balanced-allocation", params: { count: allocationSummary.filter((e) => e.level > 0).length } });
  }
  if (abilityImpact.available && abilityImpact.largestGains.length > 0) {
    const top = abilityImpact.largestGains[0];
    normalReviewPoints.push({ code: "ability-gain-highlight", params: { abilityId: top.abilityId, delta: top.value } });
  }
  if (hasReferenceAnomaly) normalReviewPoints.push({ code: "reference-anomaly", params: {} });
  if (completionState === "complete" || completionState === "near-complete") {
    normalReviewPoints.push({ code: "near-fully-allocated", params: { remaining: points.remainingPoints ?? 0 } });
  } else if (points.totalPoints != null && points.remainingPoints != null && points.remainingPoints > 0) {
    const ratio = points.totalPoints > 0 ? points.remainingPoints / points.totalPoints : 0;
    if (ratio >= MANY_REMAINING_RATIO) {
      normalReviewPoints.push({ code: "many-remaining-points", params: { remaining: points.remainingPoints, total: points.totalPoints } });
    }
  }
  if (ruleKind !== "current") normalReviewPoints.push({ code: "legacy-or-unknown-rules", params: {} });

  const harshReviewPoints: Finding[] = [];
  if (hasReferenceAnomaly) harshReviewPoints.push({ code: "reference-anomaly", params: {} });
  if (focus.kind === "none") {
    harshReviewPoints.push({ code: "no-allocation", params: {} });
  } else if (focus.kind === "balanced") {
    harshReviewPoints.push({ code: "balanced-allocation", params: { count: allocationSummary.filter((e) => e.level > 0).length } });
  } else if (focus.kind === "dominant" || focus.kind === "single") {
    harshReviewPoints.push({ code: "focused-primary-category", params: { categoryId: focus.primaryGroupId ?? "", level: focus.primaryLevel ?? 0 } });
  }
  // 能力値へ現れた成果
  if (abilityImpact.available && abilityImpact.largestGains.length > 0) {
    const top = abilityImpact.largestGains[0];
    harshReviewPoints.push({ code: "ability-gain-highlight", params: { abilityId: top.abilityId, delta: top.value } });
  }
  // 配分設計上の最大の問題（能力値の裏付けがあれば優先、無ければ従来どおり残りポイント）
  if (abilityImpact.available && abilityImpact.overinvestmentFindings.length > 0) {
    harshReviewPoints.push(abilityFindingToFinding(abilityImpact.overinvestmentFindings[0]));
  } else if (points.totalPoints != null && points.remainingPoints != null && points.remainingPoints > 0) {
    const ratio = points.totalPoints > 0 ? points.remainingPoints / points.totalPoints : 0;
    if (ratio >= MANY_REMAINING_RATIO || completionState === "in-progress") {
      harshReviewPoints.push({ code: "many-remaining-points", params: { remaining: points.remainingPoints, total: points.totalPoints } });
    }
  }
  // 配分が少ない領域の文脈
  if (underinvested.length > 0 && abilityImpact.available) {
    const ctx = abilityImpact.underinvestmentFindings.find((f) => f.groupId === underinvested[0].groupId);
    if (ctx) harshReviewPoints.push(abilityFindingToFinding(ctx));
  }
  // 同一カードの別ビルドとの差
  // 「育成方針が近い」と「26能力値の構成も近い」という2つの事実が両方とも成立する場合は、
  // 別々の文として重複させず、1つの所見(overlaps-with-sibling-ability-confirmed)へ統合する。
  if (comparisonSummary.some((c) => !c.hasDifferentPrimaryFocus) && focus.kind !== "none") {
    const overlapping = comparisonSummary.find((c) => !c.hasDifferentPrimaryFocus);
    const abilityDiff = abilityImpact.available ? abilityImpact.comparisonDifferences.find((c) => c.otherBuildId === overlapping?.otherBuildId) : undefined;
    if (abilityDiff && abilityDiff.classification === "practically-same") {
      harshReviewPoints.push({ code: "overlaps-with-sibling-ability-confirmed", params: { siblingName: overlapping?.otherBuildName ?? "" } });
    } else {
      harshReviewPoints.push({ code: "overlaps-with-sibling", params: { siblingName: overlapping?.otherBuildName ?? "" } });
      if (abilityDiff && abilityDiff.classification !== "insufficient-data") {
        harshReviewPoints.push({
          code: "ability-comparison-different-focus",
          params: { siblingName: overlapping?.otherBuildName ?? "" },
        });
      }
    }
  }
  if (ruleKind !== "current") harshReviewPoints.push({ code: "legacy-or-unknown-rules", params: {} });

  // --- 改善候補（最大3件・優先順位付き） ---
  const suggestionSeeds: { code: FindingCode; targetGroupId: string | null; targetGroupNameEn: string | null; params: Record<string, string | number> }[] = [];
  if (hasReferenceAnomaly) {
    suggestionSeeds.push({ code: "reference-anomaly", targetGroupId: null, targetGroupNameEn: null, params: {} });
  }
  if (abilityImpact.available && abilityImpact.overinvestmentFindings.length > 0) {
    const f = abilityImpact.overinvestmentFindings[0];
    const g = PROGRESSION_GROUPS.find((x) => x.groupId === f.groupId);
    suggestionSeeds.push({
      code: f.code,
      targetGroupId: f.groupId,
      targetGroupNameEn: g?.nameEn ?? null,
      params: f.groupId != null ? { ...f.params, categoryId: f.groupId } : f.params,
    });
  }
  if (focus.kind === "none") {
    suggestionSeeds.push({ code: "no-allocation", targetGroupId: null, targetGroupNameEn: null, params: {} });
  }
  if (points.totalPoints != null && points.remainingPoints != null && points.remainingPoints > 0) {
    const ratio = points.totalPoints > 0 ? points.remainingPoints / points.totalPoints : 0;
    if (ratio >= MANY_REMAINING_RATIO) {
      suggestionSeeds.push({
        code: "many-remaining-points",
        targetGroupId: underinvested[0]?.groupId ?? focus.primaryGroupId,
        targetGroupNameEn: underinvested[0]?.nameEn ?? focus.primaryGroupNameEn,
        params: { remaining: points.remainingPoints },
      });
    }
  }
  if (underinvested.length > 0) {
    suggestionSeeds.push({
      code: "underinvested-area-present",
      targetGroupId: underinvested[0].groupId,
      targetGroupNameEn: underinvested[0].nameEn,
      params: { categoryId: underinvested[0].groupId },
    });
  }
  if (ruleKind !== "current") {
    suggestionSeeds.push({ code: "legacy-or-unknown-rules", targetGroupId: null, targetGroupNameEn: null, params: {} });
  }
  if (comparisonSummary.some((c) => !c.hasDifferentPrimaryFocus) && focus.kind !== "none") {
    const overlapping = comparisonSummary.find((c) => !c.hasDifferentPrimaryFocus);
    suggestionSeeds.push({
      code: "overlaps-with-sibling",
      targetGroupId: null,
      targetGroupNameEn: null,
      params: { siblingName: overlapping?.otherBuildName ?? "" },
    });
  }
  const preserveGroupId = focus.kind !== "none" ? focus.primaryGroupId : null;
  const improvementSuggestions: ImprovementSuggestion[] = suggestionSeeds.slice(0, MAX_SUGGESTIONS).map((s, i) => ({
    priority: i + 1,
    code: s.code,
    targetGroupId: s.targetGroupId,
    targetGroupNameEn: s.targetGroupNameEn,
    preserveGroupId,
    params: s.params,
  }));

  // --- 信頼度 ---
  const reasons: FindingCode[] = [];
  let level: AnalysisConfidence = "high";
  const order: Record<AnalysisConfidence, number> = { high: 0, medium: 1, limited: 2, unavailable: 3 };
  const downgrade = (next: AnalysisConfidence, code: FindingCode) => {
    reasons.push(code);
    if (order[next] > order[level]) level = next;
  };
  if (!card) downgrade("unavailable", "insufficient-data");
  if (hasReferenceAnomaly) downgrade("limited", "reference-anomaly");
  if (points.totalPoints == null) downgrade("limited", "insufficient-data");
  if (ruleKind !== "current") downgrade("medium", "legacy-or-unknown-rules");
  if (abilityImpact.confidenceReasons.includes("ability-data-unavailable")) downgrade("limited", "ability-data-unavailable");
  if (abilityImpact.confidenceReasons.includes("comparison-data-unavailable")) downgrade("medium", "insufficient-data");

  const limitations: FindingCode[] = [...new Set(reasons)];
  if (experimental && !limitations.includes("experimental-trial-included")) limitations.push("experimental-trial-included");
  if (pom.has && !limitations.includes("power-of-many-included")) limitations.push("power-of-many-included");

  return {
    worldCardId: build.worldCardId,
    buildId: build.buildId,
    completionState,
    usedPoints: points.usedPoints,
    totalPoints: points.totalPoints,
    remainingPoints: points.remainingPoints,
    overAllocated,
    allocationSummary,
    trainingFocus: focus,
    strongestGrowthAreas,
    underinvestedAreas: underinvested,
    strengths: strengthsCapped,
    concerns: concernsCapped,
    normalReviewPoints,
    harshReviewPoints,
    improvementSuggestions,
    comparisonSummary,
    confidence: { level, reasons: [...new Set(reasons)] },
    limitations,
    abilityImpact,
  };
}

/** 保存ビルド一覧から siblings（同一 worldCardId・自分以外）を構築する（純関数）。 */
export function buildSiblingInputs(
  allBuilds: SavedBuild[],
  currentBuildId: string,
  worldCardId: string,
  usedBuildIds: ReadonlySet<string>,
): SiblingBuildInput[] {
  return allBuilds
    .filter((b) => b.worldCardId === worldCardId && b.buildId !== currentBuildId)
    .map((b) => ({
      buildId: b.buildId,
      buildName: b.buildName,
      progressionAllocation: b.progressionAllocation,
      calculatedOvr: b.calculatedOvr,
      calculatedStats: b.calculatedStats ?? {},
      rulesVersion: b.rulesVersion,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      used: usedBuildIds.has(b.buildId),
    }));
}

export function toBuildAnalysisCardInput(card: {
  worldCardId: string;
  nameJa: string | null;
  nameEn: string | null;
  cardType: string | null;
  registeredPosition: string | null;
  maximumLevel: number | null;
  ovrBase: number | null;
  ovrMax: number | null;
  boost1: number | null;
  boost2: number | null;
} | null): BuildAnalysisCardInput | null {
  if (!card) return null;
  return {
    worldCardId: card.worldCardId,
    nameJa: card.nameJa,
    nameEn: card.nameEn,
    cardType: card.cardType,
    registeredPosition: card.registeredPosition,
    maximumLevel: card.maximumLevel,
    ovrBase: card.ovrBase,
    ovrMax: card.ovrMax,
    boost1: card.boost1,
    boost2: card.boost2,
  };
}
