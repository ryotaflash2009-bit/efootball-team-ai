"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import type { Locale } from "@/lib/i18n/locale";
import { formatNumber } from "@/lib/i18n/format";
import { groupLabelJa, statLabelJa } from "@/lib/world/stat-labels";
import { getStatDef } from "@/lib/world/stats";
import { getGroupDef, PROGRESSION_GROUPS } from "@/lib/progression/stat-groups";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type {
  SavedBuildAnalysis,
  Finding,
  FindingCode,
  ImprovementSuggestion,
  ComparisonSummaryEntry,
  AnalysisConfidence,
  CompletionState,
} from "@/lib/progression/build-analysis";
import { filterImprovementSuggestionsForIntent } from "@/lib/progression/build-analysis";
import type { AbilityComparisonDifference, AbilityRankEntry } from "@/lib/progression/build-ability-impact";
import { buildComparisonSummaries, type BuildComparisonSummary, type ComparisonDifferenceItem } from "@/lib/progression/build-comparison-summary";
import { buildDiagnosisCardModel, type BuildDiagnosisCardModel, type CardConcernItem, type CardHeadlineCode } from "@/lib/progression/build-diagnosis-card";
import {
  safePlayerNameForImage,
  buildDiagnosisImageFileName,
  type BuildDiagnosisImageContent,
  type ImageAchievementItem,
  type ImageComparisonContent,
  type ImageOrientation,
} from "@/lib/progression/build-diagnosis-card-share";
import { drawBuildDiagnosisCardImage, saveBuildDiagnosisCardImageAsPng, BUILD_DIAGNOSIS_IMAGE_SIZES } from "@/lib/progression/build-diagnosis-card-image";
import {
  PRIMARY_GOAL_IDS,
  normalizeBuildIntent,
  groupPriorityState,
  computeIntentReflectionStatus,
} from "@/lib/progression/build-intent-analysis";
import type {
  BuildIntentInput,
  PrimaryGoalId,
  GroupPriorityState,
  BuildIntentAnalysis,
  IntentFinding,
  IntentFindingCode,
  IntentAlignment,
  IntentFieldKey,
  IntentFieldStatus,
  PriorityAlignmentEntry,
  IntentTopIssueKind,
} from "@/lib/progression/build-intent-analysis";
import type { BuildIntentExtraction, BuildIntentExtractionError, BuildIntentExtractionStatus, BuildIntentClarification } from "@/lib/ai/build-intent-extractor";
import { FREE_TEXT_MAX_LENGTH } from "@/lib/progression/build-intent-analysis";
import {
  BUILD_INTENT_PRESETS,
  PRESET_CATEGORIES,
  RECOMMENDED_PRESET_IDS,
  MAX_SUB_PRESETS,
  getPresetById,
  getPresetsByCategory,
  searchPresets,
  presetDerivedGroupPriorities,
  classifyGroupPrioritySource,
  type BuildIntentPreset,
  type PresetCategoryId,
  type PresetConflict,
} from "@/lib/progression/build-intent-presets";

/** 標準UIでは目的プリセット方式をメインとするため、自由文解析UI(旧メイン導線)は既定で非表示にする。
 *  RuleBasedBuildIntentExtractor・候補確認・関連state/APIは削除せず、この定数をtrueにすれば復元できる
 *  (将来の自然言語入力・Pro向け高度解析機能の土台として保持する)。 */
const SHOW_LEGACY_FREE_TEXT_INTENT_UI = false;

export type PresetIntentStatus = "unselected" | "draft" | "confirmed" | "modified" | "conflicted";

export interface PresetIntentUIProps {
  presetSearchQuery: string;
  onPresetSearchQueryChange: (q: string) => void;
  presetCategoryFilter: PresetCategoryId | "all";
  onPresetCategoryFilterChange: (c: PresetCategoryId | "all") => void;
  draftMainPresetId: string | null;
  draftSubPresetIds: string[];
  onSelectMainPreset: (id: string) => void;
  onToggleSubPreset: (id: string) => void;
  draftIntent: BuildIntentInput;
  onDraftIntentChange: (next: BuildIntentInput) => void;
  onResetPresetDefaults: () => void;
  onDiscardManualEdits: () => void;
  conflicts: PresetConflict[];
  onResolveConflictUsePreset: (groupId: string) => void;
  onResolveConflictUseManual: (groupId: string) => void;
  confirmedMainPresetId: string | null;
  confirmedSubPresetIds: string[];
  presetStatus: PresetIntentStatus;
  presetUserModified: boolean;
  onConfirmPresetIntent: () => void;
  onRevertToConfirmedPreset: () => void;
  onReturnToGeneralAnalysis: () => void;
  /** カード切り替え時、同一カードの別ビルドへ目的を引き継いだ直後だけ true(1回きりの案内表示用)。 */
  justCarriedOverFromSiblingBuild: boolean;
}

/** 確定済み育成目的の永続保存(保存ビルドへの明示保存・更新・削除・復元)。診断結果・PNG・表示文章は含まない。 */
export interface SavedIntentUIProps {
  hasSavedIntent: boolean;
  /** 保存済み設定と現在の確定済み設定が(配列順序を無視して)同じ意味かどうか。 */
  matchesCurrent: boolean;
  /** draft ≠ confirmed の未確定変更がある間は true(保存操作を無効化する)。 */
  hasPendingChanges: boolean;
  /** 保存できる確定済み目的が存在するか(目的未設定なら保存できない)。 */
  hasConfirmedIntent: boolean;
  saveStatus: "idle" | "saving" | "success" | "failed";
  deleteStatus: "idle" | "confirming" | "deleting" | "failed";
  /** 復元時に無効化された内容があれば通知する(presetUnresolved/comparisonTargetInvalidated)。 */
  restoredNotice: { presetUnresolved: boolean; comparisonTargetInvalidated: boolean } | null;
  onSave: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onRevertToSaved: () => void;
}

/**
 * 「このビルドを分析」の結果表示パネル。
 * - BuildInventoryView のカード一覧の下へ、選択中の1件だけを横幅いっぱいで表示する
 *   （カード内部の展開パネルではない・複数パネルを同時に描画しない）。
 * - 分析結果（言語非依存）を、この画面でのみ ja/en の表示文へ変換する。
 * - 通常/辛口の選択はコンポーネント内の useState のみ（保存データへ書き込まない）。
 * - 分析操作・パネル開閉は保存データを一切変更しない。
 * - レイアウトは Tailwind のレスポンシブクラスのみで PC/スマートフォンを切り替える
 *   （PC用・スマートフォン用の DOM を二重に描画しない）。
 */

type Dict = Dictionary["buildAnalysis"];

const NORMAL_KEY: Partial<Record<FindingCode, keyof Dict>> = {
  "no-allocation": "findingNoAllocationNormal",
  "focused-primary-category": "findingFocusedPrimaryCategoryNormal",
  "balanced-allocation": "findingBalancedAllocationNormal",
  "near-fully-allocated": "findingNearFullyAllocated",
  "many-remaining-points": "findingManyRemainingPointsNormal",
  "underinvested-area-present": "findingUnderinvestedAreaPresentNormal",
  "legacy-or-unknown-rules": "findingLegacyOrUnknownRulesNormal",
  "reference-anomaly": "findingReferenceAnomalyNormal",
  "experimental-trial-included": "findingExperimentalTrialIncluded",
  "power-of-many-included": "findingPowerOfManyIncluded",
  "unique-vs-siblings": "findingUniqueVsSiblings",
  "overlaps-with-sibling": "findingOverlapsWithSiblingNormal",
  "insufficient-data": "findingInsufficientData",
  "over-allocated-points": "findingOverAllocatedPoints",
  "ability-gain-reflects-focus": "findingAbilityGainReflectsFocus",
  "ability-gain-highlight": "findingAbilityGainHighlight",
  "overinvestment-candidate": "findingOverinvestmentCandidateNormal",
  "underinvested-but-high-final": "findingUnderinvestedButHighFinal",
  "underinvested-and-low-final": "findingUnderinvestedAndLowFinal",
  "underinvested-context-unknown": "findingUnderinvestedContextUnknown",
  "ability-data-unavailable": "findingAbilityDataUnavailable",
  "ability-comparison-practically-same": "findingAbilityComparisonPracticallySame",
  "ability-comparison-different-focus": "findingAbilityComparisonDifferentFocus",
};

const HARSH_KEY: Partial<Record<FindingCode, keyof Dict>> = {
  "no-allocation": "findingNoAllocationHarsh",
  "focused-primary-category": "findingFocusedPrimaryCategoryHarsh",
  "balanced-allocation": "findingBalancedAllocationHarsh",
  "near-fully-allocated": "findingNearFullyAllocated",
  "many-remaining-points": "findingManyRemainingPointsHarsh",
  "underinvested-area-present": "findingUnderinvestedAreaPresentHarsh",
  "legacy-or-unknown-rules": "findingLegacyOrUnknownRulesHarsh",
  "reference-anomaly": "findingReferenceAnomalyHarsh",
  "experimental-trial-included": "findingExperimentalTrialIncluded",
  "power-of-many-included": "findingPowerOfManyIncluded",
  "unique-vs-siblings": "findingUniqueVsSiblings",
  "overlaps-with-sibling": "findingOverlapsWithSiblingHarsh",
  "overlaps-with-sibling-ability-confirmed": "findingOverlapsWithSiblingAbilityConfirmedHarsh",
  "insufficient-data": "findingInsufficientData",
  "over-allocated-points": "findingOverAllocatedPoints",
  "ability-gain-reflects-focus": "findingAbilityGainReflectsFocus",
  "ability-gain-highlight": "findingAbilityGainHighlight",
  "overinvestment-candidate": "findingOverinvestmentCandidateHarsh",
  "underinvested-but-high-final": "findingUnderinvestedButHighFinal",
  "underinvested-and-low-final": "findingUnderinvestedAndLowFinal",
  "underinvested-context-unknown": "findingUnderinvestedContextUnknown",
  "ability-data-unavailable": "findingAbilityDataUnavailable",
  "ability-comparison-practically-same": "findingAbilityComparisonPracticallySame",
  "ability-comparison-different-focus": "findingAbilityComparisonDifferentFocus",
};

const SUGGESTION_TITLE_KEY: Partial<Record<FindingCode, keyof Dict>> = {
  "reference-anomaly": "suggestionTitleReferenceAnomaly",
  "no-allocation": "suggestionTitleStartAllocation",
  "many-remaining-points": "suggestionTitleUseRemainingPoints",
  "underinvested-area-present": "suggestionTitleConsiderUnderinvestedArea",
  "legacy-or-unknown-rules": "suggestionTitleRecheckUnderCurrentRules",
  "overlaps-with-sibling": "suggestionTitleDifferentiateFromSibling",
  "overinvestment-candidate": "suggestionTitleOverinvestmentCandidate",
};

const SUGGESTION_REASON_KEY: Partial<Record<FindingCode, keyof Dict>> = {
  "reference-anomaly": "suggestionReasonReferenceAnomaly",
  "no-allocation": "suggestionReasonNoAllocation",
  "many-remaining-points": "suggestionReasonManyRemainingPoints",
  "underinvested-area-present": "suggestionReasonUnderinvestedArea",
  "legacy-or-unknown-rules": "suggestionReasonLegacyRules",
  "overlaps-with-sibling": "suggestionReasonOverlapsWithSibling",
  "overinvestment-candidate": "suggestionReasonOverinvestmentCandidate",
};

const SUGGESTION_RECHECK_KEY: Partial<Record<FindingCode, keyof Dict>> = {
  "reference-anomaly": "suggestionRecheckReferenceAnomaly",
  "no-allocation": "suggestionRecheckNoAllocation",
  "many-remaining-points": "suggestionRecheckManyRemainingPoints",
  "underinvested-area-present": "suggestionRecheckUnderinvestedArea",
  "legacy-or-unknown-rules": "suggestionRecheckLegacyRules",
  "overlaps-with-sibling": "suggestionRecheckOverlapsWithSibling",
  "overinvestment-candidate": "suggestionRecheckOverinvestmentCandidate",
};

const COMPLETION_KEY: Record<CompletionState, keyof Dict> = {
  unallocated: "completionUnallocated",
  "in-progress": "completionInProgress",
  "near-complete": "completionNearComplete",
  complete: "completionComplete",
  unknown: "completionUnknown",
};

const CONFIDENCE_KEY: Record<AnalysisConfidence, keyof Dict> = {
  high: "confidenceHigh",
  medium: "confidenceMedium",
  limited: "confidenceLimited",
  unavailable: "confidenceUnavailable",
};

const INTENT_GOAL_KEY: Record<PrimaryGoalId, keyof Dict> = {
  unspecified: "intentGoalUnspecified",
  scoring: "intentGoalScoring",
  dribbling: "intentGoalDribbling",
  passing: "intentGoalPassing",
  speed: "intentGoalSpeed",
  possession: "intentGoalPossession",
  physical: "intentGoalPhysical",
  aerial: "intentGoalAerial",
  defense: "intentGoalDefense",
  press: "intentGoalPress",
  counter: "intentGoalCounter",
  balance: "intentGoalBalance",
  other: "intentGoalOther",
};

const INTENT_ALIGNMENT_KEY: Record<IntentAlignment, keyof Dict> = {
  high: "intentAlignmentHigh",
  "mostly-aligned": "intentAlignmentMostlyAligned",
  "partially-aligned": "intentAlignmentPartiallyAligned",
  "poorly-aligned": "intentAlignmentPoorlyAligned",
  "insufficient-information": "intentAlignmentInsufficientInformation",
};

const INTENT_FINDING_KEY: Partial<Record<IntentFindingCode, keyof Dict>> = {
  "intent-priority-not-reflected": "intentFindingPriorityNotReflected",
  "intent-priority-underprioritized": "intentFindingPriorityUnderprioritized",
  "intent-priority-insufficient-data": "intentFindingPriorityInsufficientData",
  "intent-primary-goal-reflected": "intentFindingPrimaryGoalReflected",
  "intent-primary-goal-mismatch": "intentFindingPrimaryGoalMismatch",
  "intent-lower-priority-low-allocation-good": "intentFindingLowerPriorityLowAllocationGood",
  "intent-near-complete": "intentFindingNearComplete",
  "intent-spread-not-a-problem": "intentFindingSpreadNotAProblem",
  "intent-goal-auxiliary-only": "intentFindingGoalAuxiliaryOnly",
  "intent-insufficient-ability-data": "intentFindingInsufficientAbilityData",
  "intent-priority-count-many": "intentFindingPriorityCountMany",
  "intent-priority-count-all": "intentFindingPriorityCountAll",
  "intent-lower-priority-count-most": "intentFindingLowerPriorityCountMost",
  "intent-secondary-not-reflected": "intentFindingSecondaryNotReflected",
  "intent-secondary-priority-inversion": "intentFindingSecondaryPriorityInversion",
  "intent-secondary-priority-inversion-review": "intentFindingSecondaryPriorityInversionReview",
};

const INTENT_OVERINVESTMENT_KEY: Record<"normal" | "harsh", keyof Dict> = {
  normal: "intentFindingOverinvestmentOutsidePriorityNormal",
  harsh: "intentFindingOverinvestmentOutsidePriorityHarsh",
};

const ALIGNED_GROUP_KEY: Record<"strongly-aligned" | "mostly-aligned", { plain: keyof Dict; withAbilities: keyof Dict }> = {
  "strongly-aligned": { plain: "intentAlignedGroupStronglyTemplate", withAbilities: "intentAlignedGroupStronglyWithAbilitiesTemplate" },
  "mostly-aligned": { plain: "intentAlignedGroupMostlyTemplate", withAbilities: "intentAlignedGroupMostlyWithAbilitiesTemplate" },
};

const TOP_ISSUE_CONCLUSION_KEY: Record<IntentTopIssueKind, keyof Dict> = {
  "not-reflected": "intentConclusionIssueNotReflectedTemplate",
  underprioritized: "intentConclusionIssueUnderprioritizedTemplate",
  "priority-inversion": "intentConclusionIssuePriorityInversionTemplate",
  "secondary-not-reflected": "intentConclusionIssueSecondaryNotReflectedTemplate",
  "avoid-overinvestment": "intentConclusionIssueAvoidOverinvestmentTemplate",
  overinvestment: "intentConclusionIssueOverinvestmentTemplate",
};

const TOP_ISSUE_FINAL_KEY: Record<IntentTopIssueKind, keyof Dict> = {
  "not-reflected": "intentTopIssueNotReflectedTemplate",
  underprioritized: "intentTopIssueUnderprioritizedTemplate",
  "priority-inversion": "intentTopIssuePriorityInversionTemplate",
  "secondary-not-reflected": "intentTopIssueSecondaryNotReflectedTemplate",
  "avoid-overinvestment": "intentTopIssueAvoidOverinvestmentTemplate",
  overinvestment: "intentTopIssueOverinvestmentTemplate",
};

const CONCLUSION_ALIGNMENT_KEY: Record<IntentAlignment, keyof Dict> = {
  high: "intentConclusionAlignmentHigh",
  "mostly-aligned": "intentConclusionAlignmentMostlyAligned",
  "partially-aligned": "intentConclusionAlignmentPartiallyAligned",
  "poorly-aligned": "intentConclusionAlignmentPoorlyAligned",
  "insufficient-information": "intentConclusionAlignmentInsufficientInformation",
};

const REFLECTION_FIELD_KEY: Record<IntentFieldKey, keyof Dict> = {
  primaryGoal: "intentReflectionFieldPrimaryGoal",
  position: "intentReflectionFieldPosition",
  priorityGroups: "intentReflectionFieldPriorityGroups",
  secondaryPriorityGroups: "intentReflectionFieldSecondaryPriorityGroups",
  lowerPriorityGroups: "intentReflectionFieldLowerPriorityGroups",
  avoidOverinvestmentGroups: "intentReflectionFieldAvoidOverinvestmentGroups",
  intentionallyIgnoredGroups: "intentReflectionFieldIntentionallyIgnoredGroups",
  comparisonTarget: "intentReflectionFieldComparisonTarget",
  freeText: "intentReflectionFieldFreeText",
  strengthsToPreserve: "intentReflectionFieldStrengthsToPreserve",
};

const EXTRACTION_STATUS_TEXT_KEY: Record<BuildIntentExtractionStatus, keyof Dict> = {
  "not-analyzed": "buildIntentStatusNotAnalyzedText",
  analyzing: "buildIntentStatusAnalyzingText",
  "awaiting-confirmation": "buildIntentStatusAwaitingConfirmationText",
  confirmed: "buildIntentStatusConfirmedText",
  stale: "buildIntentStatusStaleText",
  failed: "buildIntentStatusFailedText",
  "not-configured": "buildIntentStatusNotConfiguredText",
  manual: "buildIntentStatusManualText",
};

const REFLECTION_STATUS_KEY: Record<IntentFieldStatus, keyof Dict> = {
  used: "intentReflectionStatusUsed",
  "reference-only": "intentReflectionStatusReferenceOnly",
  "display-only": "intentReflectionStatusDisplayOnly",
  "not-specified": "intentReflectionStatusNotSpecified",
  "limited-by-data": "intentReflectionStatusLimitedByData",
};

const GROUP_STATE_KEY: Record<GroupPriorityState, keyof Dict> = {
  priority: "intentStatePriority",
  secondary: "intentStateSecondary",
  normal: "intentStateNormal",
  low: "intentStateLow",
};

const EXTRACTION_CONFIDENCE_KEY: Record<"high" | "medium" | "low", keyof Dict> = {
  high: "buildIntentConfidenceHigh",
  medium: "buildIntentConfidenceMedium",
  low: "buildIntentConfidenceLow",
};

/** 「分析へ使用中の情報源」の分類(目的プリセット方式。実際の intent/確定済みプリセットIDから一意に決定する)。 */
type PresetReflectionSourceKind = "presetPlusUser" | "presetOnly" | "manualOnly" | "none";

const PRESET_REFLECTION_SOURCE_KEY: Record<PresetReflectionSourceKind, keyof Dict> = {
  presetPlusUser: "presetReflectionSourcePresetPlusUser",
  presetOnly: "presetReflectionSourcePresetOnly",
  manualOnly: "presetReflectionSourceManualOnly",
  none: "presetReflectionSourceNone",
};

/**
 * 「分析へ使用中の情報源」を一意に決定する(表示内容と実際の分析入力を必ず一致させるため、
 * 確定済みプリセットID・確定済み intent の実際の値から機械的に導出し、独自の推測をしない)。
 */
function resolvePresetReflectionSource(presetIntent: PresetIntentUIProps, confirmedIntent: BuildIntentInput): PresetReflectionSourceKind {
  const hasConfirmedPreset = presetIntent.confirmedMainPresetId != null || presetIntent.confirmedSubPresetIds.length > 0;
  if (!hasConfirmedPreset) {
    const hasManualValue = confirmedIntent.primaryGoal !== "unspecified" || Object.keys(confirmedIntent.groupPriorities).length > 0;
    return hasManualValue ? "manualOnly" : "none";
  }
  return presetIntent.presetUserModified ? "presetPlusUser" : "presetOnly";
}

/** 確定済み育成目的(メイン・サブ)を、辛口レビュー冒頭の「使用中バナー」の1文として組み立てる。固定テンプレートではなく、実際の確定状態から決定的に構成する。 */
function presetConfirmedBannerText(presetIntent: PresetIntentUIProps, ba: (k: keyof Dict) => string, locale: Locale): string {
  const mainPreset = getPresetById(presetIntent.confirmedMainPresetId);
  if (!mainPreset && presetIntent.confirmedSubPresetIds.length === 0) {
    return ba("buildIntentManualNotice");
  }
  const subTitles = presetIntent.confirmedSubPresetIds
    .map((id) => getPresetById(id))
    .filter((p): p is BuildIntentPreset => p != null)
    .map((p) => ba(p.titleKey as keyof Dict));
  const parts = [ba("presetConfirmedNoticeHeading")];
  if (mainPreset) parts.push(`${ba("presetConfirmedMainLabel")}: ${ba(mainPreset.titleKey as keyof Dict)}`);
  if (subTitles.length > 0) parts.push(`${ba("presetConfirmedSubLabel")}: ${subTitles.join(locale === "ja" ? "・" : ", ")}`);
  return parts.join(" ");
}

/** 育成カテゴリの表示名（ja: 既存の groupLabelJa 由来の仮称日本語 / en: 確認済み英語名）。 */
function groupDisplayName(groupId: string | null, locale: Locale): string {
  if (!groupId) return "";
  if (locale === "ja") return groupLabelJa(groupId);
  return getGroupDef(groupId)?.nameEn ?? groupId;
}

/** 能力値の表示名（ja: 既存の statLabelJa / en: 確認済み英語名）。 */
function abilityLabel(abilityId: string, locale: Locale): string {
  if (locale === "ja") return statLabelJa(abilityId);
  return getStatDef(abilityId)?.nameEn ?? abilityId;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-text-dim">{children}</p>;
}

/** 上昇量の代表能力を「能力名+差分」のリスト文字列へ整形する(ja/enで区切り文字が異なる)。 */
function formatAbilityList(
  abilities: { abilityId: string; delta: number }[],
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  locale: Locale,
): string {
  const sep = ba("intentAbilityListSeparator");
  return abilities
    .map((a) => fillBa(ba("intentAbilityDeltaItemTemplate"), { ability: abilityLabel(a.abilityId, locale), delta: (a.delta > 0 ? "+" : "") + fmt(a.delta) }))
    .join(sep);
}

function joinCategories(groupIds: string[], locale: Locale): string {
  return groupIds.map((id) => groupDisplayName(id, locale)).join(locale === "ja" ? "・" : ", ");
}

/**
 * 優先領域1件分の一致/不一致テキストを組み立てる(排他的な状態にそのまま対応するため、
 * 同一領域が一致・不足の両方へ出ることはない)。
 */
function priorityAlignmentEntryText(
  entry: PriorityAlignmentEntry,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  locale: Locale,
): string {
  const category = groupDisplayName(entry.groupId, locale);
  if (entry.state === "strongly-aligned" || entry.state === "mostly-aligned") {
    const keys = ALIGNED_GROUP_KEY[entry.state];
    if (entry.representativeAbilities.length > 0) {
      return fillBa(ba(keys.withAbilities), { categories: category, abilityList: formatAbilityList(entry.representativeAbilities, ba, fillBa, fmt, locale) });
    }
    return fillBa(ba(keys.plain), { categories: category });
  }
  if (entry.state === "present-but-underprioritized") return fillBa(ba("intentFindingPriorityUnderprioritized"), { category });
  if (entry.state === "not-reflected") return fillBa(ba("intentFindingPriorityNotReflected"), { category });
  return fillBa(ba("intentFindingPriorityInsufficientData"), { category });
}

/**
 * 補助的に重視(Secondary Priority)領域1件分のテキストを組み立てる。
 * 最優先とは判定基準・文面が異なる(配分ゼロは軽度の注意、不足は断定しない)。
 */
function secondaryAlignmentEntryText(
  entry: PriorityAlignmentEntry,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  locale: Locale,
): string {
  const category = groupDisplayName(entry.groupId, locale);
  if (entry.state === "strongly-aligned" && entry.representativeAbilities.length > 0) {
    return fillBa(ba("intentSecondaryAlignedWithAbilitiesTemplate"), { categories: category, abilityList: formatAbilityList(entry.representativeAbilities, ba, fillBa, fmt, locale) });
  }
  if (entry.state === "strongly-aligned" || entry.state === "mostly-aligned") return fillBa(ba("intentSecondaryAlignedTemplate"), { categories: category });
  if (entry.state === "not-reflected") return fillBa(ba("intentFindingSecondaryNotReflected"), { category });
  return fillBa(ba("intentSecondaryInsufficientDataTemplate"), { categories: category });
}

/**
 * 低優先(lowPriorityGroupIds)と今回は評価対象外(excludedGroupIds)を、領域ごとに繰り返さず
 * 1つの文章へ統合する(該当する分類だけを含め、両方あれば1文中で分けて言及する)。
 */
function composeAcceptableLowText(
  summary: { lowPriorityGroupIds: string[]; excludedGroupIds: string[] },
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  locale: Locale,
): string {
  const hasLow = summary.lowPriorityGroupIds.length > 0;
  const hasExcluded = summary.excludedGroupIds.length > 0;
  if (hasLow && hasExcluded) {
    return fillBa(ba("intentAcceptableLowAndExcludedTemplate"), {
      lowCategories: joinCategories(summary.lowPriorityGroupIds, locale),
      excludedCategories: joinCategories(summary.excludedGroupIds, locale),
    });
  }
  if (hasExcluded) return fillBa(ba("intentAcceptableExcludedOnlyTemplate"), { categories: joinCategories(summary.excludedGroupIds, locale) });
  return fillBa(ba("intentAcceptableLowOnlyTemplate"), { categories: joinCategories(summary.lowPriorityGroupIds, locale) });
}

/** 「結論」文を組み立てる(最大の問題1件+適合状態+改善優先度1位、を実データから決定的に生成)。 */
function composeIntentConclusion(
  ia: BuildIntentAnalysis,
  intent: BuildIntentInput,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  locale: Locale,
): string {
  const goalLabel = ba(INTENT_GOAL_KEY[intent.primaryGoal]);
  const position = intent.intendedPositions[0];
  const context = position ? fillBa(ba("intentContextWithPositionTemplate"), { position, goal: goalLabel }) : fillBa(ba("intentContextTemplate"), { goal: goalLabel });

  const sentence1 = ia.topIssue
    ? fillBa(ba("intentConclusionWithIssueTemplate"), {
        context,
        issue: fillBa(ba(TOP_ISSUE_CONCLUSION_KEY[ia.topIssue.kind]), { category: groupDisplayName(ia.topIssue.groupId, locale) }),
      })
    : fillBa(ba("intentConclusionNoIssueTemplate"), { context });

  const alignmentClause = ba(CONCLUSION_ALIGNMENT_KEY[ia.alignment]);
  const sentence2 =
    ia.improvementPriorities.length > 0
      ? fillBa(ba("intentConclusionAlignmentAndImprovementTemplate"), { alignment: alignmentClause, category: groupDisplayName(ia.improvementPriorities[0].groupId, locale) })
      : alignmentClause;

  return [sentence1, sentence2].join(" ");
}

interface IntentSection {
  heading: string;
  text: string;
}

/**
 * 辛口の「入力した目的に対する評価」を、結論から始まる見出し付きセクションへ組み立てる。
 * 対応する内容がないセクションは配列に含めない(見出しごと表示しない)。
 * 順序: 1.結論 → 2.目的と一致している成果 → 3.目的とのズレ → 4.問題として扱わない領域 →
 *       5.別ビルドとの違い → 6.最終判断(最優先の改善=改善候補1位・維持すべき長所)。
 */
/**
 * 辛口モードの「入力した目的に対する評価」は、結論と最終判断の2段だけにする。
 * 一致/明確な不一致/確認事項/上げすぎ/低優先・評価対象外/補助的優先/比較の詳細は、
 * このすぐ上に常時表示される構造化グリッド(目的適合状態)が既に示しているため、
 * ここで同じ内容を文章として繰り返さない(通常/辛口の切り替えを目的評価セクション全体へ適用する)。
 */
function composeIntentHarshSections(
  ia: BuildIntentAnalysis,
  intent: BuildIntentInput,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  locale: Locale,
  intentFindingText: (f: IntentFinding, m: "normal" | "harsh") => string,
): IntentSection[] {
  const sections: IntentSection[] = [];

  sections.push({ heading: ba("intentConclusionHeading"), text: composeIntentConclusion(ia, intent, ba, fillBa, locale) });

  const topIssueText = ia.topIssue ? fillBa(ba(TOP_ISSUE_FINAL_KEY[ia.topIssue.kind]), { category: groupDisplayName(ia.topIssue.groupId, locale) }) : ba("intentTopIssueNoneTemplate");
  const preserveText = ia.preserveHighlight
    ? fillBa(ba(ia.preserveHighlight.priorityLevel === "secondary" ? "intentPreserveSecondaryTemplate" : "intentPreserveTemplate"), { category: groupDisplayName(ia.preserveHighlight.groupId, locale) })
    : ba("intentPreserveNoneTemplate");
  const unconfirmedPreserveTexts = ia.unconfirmedPreserveGroupIds.map((g) => fillBa(ba("intentPreserveUnconfirmedTemplate"), { category: groupDisplayName(g, locale) }));
  const finalParts = [topIssueText, preserveText, ...unconfirmedPreserveTexts];
  for (const code of ia.limitations) {
    if (code === "intent-priority-count-many" || code === "intent-priority-count-all" || code === "intent-lower-priority-count-most") continue;
    const key = INTENT_FINDING_KEY[code];
    if (key) finalParts.push(ba(key));
  }
  sections.push({ heading: ba("intentFinalHeading"), text: finalParts.filter((s) => s.length > 0).join(" ") });

  return sections;
}

/**
 * 通常の「入力した目的に対する評価」は、辛口の単純な短縮版にならないよう、
 * 見出しなしの1段落(結論相当+最優先の一致+補助的優先の反映+最大の注意点+維持すべき長所+
 * 意図的に捨てる領域の扱い、3〜6文程度)にまとめる。
 */
function composeIntentNormalText(
  ia: BuildIntentAnalysis,
  intent: BuildIntentInput,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  locale: Locale,
  intentFindingText: (f: IntentFinding, m: "normal" | "harsh") => string,
): string {
  const sentences: string[] = [composeIntentConclusion(ia, intent, ba, fillBa, locale)];
  if (ia.alignedGroups.length > 0) {
    const g = ia.alignedGroups[0];
    const keys = ALIGNED_GROUP_KEY[g.state];
    sentences.push(fillBa(ba(keys.plain), { categories: joinCategories(g.groupIds, locale) }));
  }
  if (ia.secondaryAlignments.length > 0) {
    sentences.push(secondaryAlignmentEntryText(ia.secondaryAlignments[0], ba, fillBa, fmt, locale));
  }
  const misalignmentForNormal = ia.misalignmentHighlights.filter((f) => f.code === "intent-priority-not-reflected" || f.code === "intent-priority-underprioritized");
  if (misalignmentForNormal.length > 0) sentences.push(intentFindingText(misalignmentForNormal[0], "normal"));
  else if (ia.avoidOverinvestmentFindings.length > 0) sentences.push(intentFindingText(ia.avoidOverinvestmentFindings[0], "normal"));
  if (ia.preserveHighlight) {
    sentences.push(
      fillBa(ba(ia.preserveHighlight.priorityLevel === "secondary" ? "intentPreserveSecondaryTemplate" : "intentPreserveTemplate"), {
        category: groupDisplayName(ia.preserveHighlight.groupId, locale),
      }),
    );
  }
  if (ia.acceptableLowSummary) {
    sentences.push(composeAcceptableLowText(ia.acceptableLowSummary, ba, fillBa, locale));
  }
  return sentences.filter((s) => s.length > 0).join(" ");
}

// ---------------------------------------------------------------------------
// 同一カード比較: 要約+詳細表示(build-comparison-summary.ts の言語非依存モデルから、
// 通常/辛口それぞれの文章を合成する。判定・数値そのものは一切ここで計算しない)。
// ---------------------------------------------------------------------------

const PURPOSE_SIMILARITY_KEY: Record<BuildComparisonSummary["purposeSimilarity"], keyof Dict> = {
  "same-purpose": "comparisonPurposeSimilaritySamePurposeText",
  "close-purpose": "comparisonPurposeSimilarityClosePurposeText",
  "different-purpose": "comparisonPurposeSimilarityDifferentPurposeText",
  "purpose-not-set": "comparisonPurposeSimilarityNotSetText",
  unknown: "comparisonPurposeSimilarityUnknownText",
};

const PURPOSE_DIFF_MAGNITUDE_KEY: Record<BuildComparisonSummary["purposeDifferenceMagnitude"], keyof Dict> = {
  "very-small": "comparisonPurposeDiffVerySmallText",
  small: "comparisonPurposeDiffSmallText",
  "some-difference": "comparisonPurposeDiffSomeText",
  "clear-difference": "comparisonPurposeDiffClearText",
  "insufficient-data": "comparisonPurposeDiffInsufficientDataText",
};

const DIFFERENTIATION_STATUS_KEY: Record<BuildComparisonSummary["differentiationStatus"], keyof Dict> = {
  "well-differentiated": "comparisonDifferentiationWellText",
  "partially-differentiated": "comparisonDifferentiationPartialText",
  "limited-differentiation": "comparisonDifferentiationLimitedText",
  "not-assessable": "comparisonDifferentiationNotAssessableText",
};

const OVERALL_SIMILARITY_KEY: Record<BuildComparisonSummary["overallSimilarity"], keyof Dict> = {
  "very-similar": "comparisonOverallVerySimilarText",
  similar: "comparisonOverallSimilarText",
  "partially-different": "comparisonOverallPartiallyDifferentText",
  "clearly-different": "comparisonOverallClearlyDifferentText",
  unknown: "comparisonOverallUnknownText",
};

/** 比較不能・データ不足時の、断定を避けた正確な理由文(内部エラー・IDは表示しない)。 */
function comparisonStatusReasonText(s: Pick<BuildComparisonSummary, "limitations">, ba: (k: keyof Dict) => string): string {
  if (s.limitations.includes("condition-legacy-vs-current")) return ba("abilityComparisonConditionLegacyText");
  if (s.limitations.includes("condition-one-unallocated")) return ba("abilityComparisonConditionUnallocatedText");
  return ba("comparisonInsufficientAbilityDataText");
}

function comparisonLimitationText(code: BuildComparisonSummary["limitations"][number], ba: (k: keyof Dict) => string): string {
  switch (code) {
    case "condition-legacy-vs-current":
      return ba("abilityComparisonConditionLegacyText");
    case "condition-one-unallocated":
      return ba("abilityComparisonConditionUnallocatedText");
    case "ability-data-unavailable":
      return ba("comparisonInsufficientAbilityDataText");
    case "comparison-target-not-found":
      return ba("comparisonTargetNotFoundText");
  }
}

/** 目的が判定できない場合に、なぜ一般比較のみになるのかを示す注記(該当なしならnull)。 */
function comparisonUnassessableNoticeKey(s: BuildComparisonSummary): keyof Dict | null {
  if (s.purposeSimilarity === "purpose-not-set") return "comparisonGeneralOnlyNoticeText";
  if (s.purposeSimilarity === "unknown") return "comparisonPartiallyComparableGeneralOnlyText";
  return null;
}

function comparisonMajorDiffText(
  items: ComparisonDifferenceItem[],
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  locale: Locale,
): string {
  if (items.length === 0) return ba("comparisonNoMajorDiffText");
  const sep = ba("intentAbilityListSeparator");
  return items
    .map((d) =>
      fillBa(ba(d.currentHigher ? "comparisonMajorDiffCurrentHigherTemplate" : "comparisonMajorDiffOtherHigherTemplate"), {
        ability: abilityLabel(d.abilityId, locale),
        diff: fmt(d.diff),
      }),
    )
    .join(sep);
}

function comparisonRecommendationText(
  s: Pick<BuildComparisonSummary, "recommendationCode" | "recommendationGroupId">,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  locale: Locale,
): string {
  switch (s.recommendationCode) {
    case "maintain-role-split":
      return ba("comparisonRecommendationMaintainText");
    case "differentiate-groups":
      return fillBa(ba("comparisonRecommendationDifferentiateTemplate"), { category: groupDisplayName(s.recommendationGroupId, locale) });
    case "set-comparison-purpose":
      return ba("comparisonRecommendationSetPurposeText");
    case "insufficient-data":
      return ba("comparisonRecommendationInsufficientDataText");
    case "not-comparable":
      return ba("comparisonRecommendationNotComparableText");
    case "general-comparison-only":
      return ba("comparisonRecommendationGeneralOnlyText");
  }
}

interface ComparisonHarshLine {
  label: string;
  value: string;
}

/**
 * 通常/辛口共通の行データ(同一の BuildComparisonSummary から、同じ判定・同じ数値で組み立てる。
 * モードが変えるのは「どの行を見せるか」の量だけで、判定結果そのものは変えない)。
 * 通常: 用途の近さ(or 全体の近さ)+差別化+推奨の3行。
 * 辛口: 上記に加え、目的領域の差(数値的な根拠)+主な差の一覧を加えた、より詳しい行数。
 */
function composeComparisonLines(
  s: BuildComparisonSummary,
  mode: "normal" | "harsh",
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  locale: Locale,
): ComparisonHarshLine[] {
  const showsGeneralOnly = s.purposeSimilarity === "purpose-not-set" || s.purposeSimilarity === "unknown";
  const lines: ComparisonHarshLine[] = [];
  if (showsGeneralOnly) {
    lines.push({ label: ba("comparisonOverallSimilarityLabel"), value: ba(OVERALL_SIMILARITY_KEY[s.overallSimilarity]) });
  } else {
    lines.push({ label: ba("comparisonPurposeClosenessLabel"), value: ba(PURPOSE_SIMILARITY_KEY[s.purposeSimilarity]) });
  }
  if (mode === "harsh") {
    if (!showsGeneralOnly) lines.push({ label: ba("comparisonPurposeDiffLabel"), value: ba(PURPOSE_DIFF_MAGNITUDE_KEY[s.purposeDifferenceMagnitude]) });
    lines.push({ label: ba("comparisonMajorDiffLabel"), value: comparisonMajorDiffText(s.largestDifferences, ba, fillBa, fmt, locale) });
  }
  lines.push({ label: ba("comparisonDifferentiationLabel"), value: ba(DIFFERENTIATION_STATUS_KEY[s.differentiationStatus]) });
  lines.push({ label: ba("comparisonRecommendationLabel"), value: comparisonRecommendationText(s, ba, fillBa, locale) });
  return lines;
}

function ComparisonSummaryCard({
  s,
  entry,
  mode,
  ba,
  fillBa,
  fmt,
  locale,
}: {
  s: BuildComparisonSummary;
  entry: ComparisonSummaryEntry;
  mode: "normal" | "harsh";
  ba: (k: keyof Dict) => string;
  fillBa: (s: string, vars: Record<string, string>) => string;
  fmt: (n: number) => string;
  locale: Locale;
}) {
  const isNotComparable = s.comparisonStatus === "not-comparable" || s.comparisonStatus === "insufficient-data";
  const currentHigherAbilities = s.allAbilityDifferences.filter((d) => d.currentHigher);
  const otherHigherAbilities = s.allAbilityDifferences.filter((d) => !d.currentHigher);
  return (
    <li className="rounded-md border border-border/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-semibold text-text" title={s.targetBuildName}>
          {s.targetBuildName}
        </p>
        {s.isUserComparisonTarget ? (
          <Badge tone="accent" size="xs">
            {ba("comparisonTargetBadgeLabel")}
          </Badge>
        ) : null}
      </div>
      {isNotComparable ? (
        <p role="status" className="mt-1 text-text-muted">
          {comparisonStatusReasonText(s, ba)}
        </p>
      ) : (
        <div className="mt-1 flex flex-col gap-0.5">
          {(() => {
            const noticeKey = comparisonUnassessableNoticeKey(s);
            return noticeKey ? <p className="text-text-muted">{ba(noticeKey)}</p> : null;
          })()}
          {composeComparisonLines(s, mode, ba, fillBa, fmt, locale).map((line, i) => (
            <p key={i} className="text-text-dim">
              <span className="font-semibold text-text-dim">{line.label}: </span>
              {line.value}
            </p>
          ))}
        </div>
      )}
      {!isNotComparable ? (
        <details className="mt-1.5 border-t border-border/40 pt-1">
          <summary className="cursor-pointer text-2xs text-text-muted hover:text-text">{ba("comparisonDetailsToggleLabel")}</summary>
          <div className="mt-1 flex flex-col gap-1 text-2xs text-text-muted">
            <p>
              {directionText(s.usedPointsDiff, s.targetBuildName, ba, fillBa, fmt, {
                more: "comparisonUsedPointsMoreTemplate",
                less: "comparisonUsedPointsLessTemplate",
                same: "comparisonUsedPointsSameText",
                unknown: "comparisonUsedPointsSameText",
              })}
            </p>
            <p>
              {s.remainingPointsDiff == null
                ? ba("comparisonRemainingPointsDiffUnknownText")
                : directionText(s.remainingPointsDiff, s.targetBuildName, ba, fillBa, fmt, {
                    more: "comparisonRemainingPointsMoreTemplate",
                    less: "comparisonRemainingPointsLessTemplate",
                    same: "comparisonRemainingPointsSameText",
                    unknown: "comparisonRemainingPointsDiffUnknownText",
                  })}
            </p>
            <p>
              {s.calculatedOvrDiff == null
                ? ba("comparisonOvrDiffUnknownText")
                : directionText(s.calculatedOvrDiff, s.targetBuildName, ba, fillBa, fmt, {
                    more: "comparisonOvrMoreTemplate",
                    less: "comparisonOvrLessTemplate",
                    same: "comparisonOvrSameText",
                    unknown: "comparisonOvrDiffUnknownText",
                  })}
            </p>
            <div className="mt-1 border-t border-border/40 pt-1">
              <p className="font-semibold text-text-dim">{ba("comparisonDetailAllocationDiffLabel")}</p>
              <p>
                {entry.hasDifferentPrimaryFocus
                  ? entry.primaryGroupId && entry.otherPrimaryGroupId
                    ? fillBa(ba("comparisonFocusDifferentTemplate"), {
                        current: groupDisplayName(entry.primaryGroupId, locale),
                        other: groupDisplayName(entry.otherPrimaryGroupId, locale),
                      })
                    : ba("comparisonDetailNoDiffText")
                  : ba("comparisonFocusSameText")}
              </p>
            </div>
            {s.detailAvailability.hasAbilityData ? (
              <div className="mt-1 border-t border-border/40 pt-1">
                <p className="font-semibold text-text-dim">{ba("comparisonDetailAbilityDiffLabel")}</p>
                <div className="mt-0.5">
                  <p className="text-text-dim">{ba("comparisonDetailCurrentHigherLabel")}</p>
                  {currentHigherAbilities.length > 0 ? (
                    <ul className="flex flex-col gap-0.5">
                      {currentHigherAbilities.map((d) => (
                        <li key={d.abilityId}>
                          {abilityLabel(d.abilityId, locale)}: +{fmt(d.diff)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{ba("comparisonDetailNoDiffText")}</p>
                  )}
                </div>
                <div className="mt-0.5">
                  <p className="text-text-dim">{ba("comparisonDetailOtherHigherLabel")}</p>
                  {otherHigherAbilities.length > 0 ? (
                    <ul className="flex flex-col gap-0.5">
                      {otherHigherAbilities.map((d) => (
                        <li key={d.abilityId}>
                          {abilityLabel(d.abilityId, locale)}: +{fmt(d.diff)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{ba("comparisonDetailNoDiffText")}</p>
                  )}
                </div>
              </div>
            ) : null}
            {s.limitations.length > 0 ? (
              <div className="mt-1 border-t border-border/40 pt-1">
                <p className="font-semibold text-text-dim">{ba("comparisonDetailLimitationsLabel")}</p>
                <ul className="flex flex-col gap-0.5">
                  {s.limitations.map((code) => (
                    <li key={code}>{comparisonLimitationText(code, ba)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// 診断結果カード: BuildDiagnosisCardModel(既存の確定済み結果を合成しただけの表示モデル)から
// 通常/辛口それぞれの短い文章を組み立てる。判定・数値はモデルの値をそのまま使い、ここでは生成しない。
// ---------------------------------------------------------------------------

const DIAGNOSIS_ALIGNMENT_KEY: Partial<Record<IntentAlignment, keyof Dict>> = {
  high: "diagnosisCardAlignmentHighText",
  "mostly-aligned": "diagnosisCardAlignmentMostlyText",
  "partially-aligned": "diagnosisCardAlignmentPartiallyText",
  "poorly-aligned": "diagnosisCardAlignmentPoorlyText",
};

/** insufficient-information は「能力データ不足」と「確認が必要(優先領域の設定が判定に使えない)」を区別する。 */
function diagnosisAlignmentText(status: IntentAlignment, hasAbilityData: boolean, ba: (k: keyof Dict) => string): string {
  if (status === "insufficient-information") return hasAbilityData ? ba("diagnosisCardAlignmentNeedsConfirmationText") : ba("diagnosisCardAlignmentAbilityDataText");
  const key = DIAGNOSIS_ALIGNMENT_KEY[status];
  return key ? ba(key) : "";
}

const DIAGNOSIS_HEADLINE_KEY: Record<CardHeadlineCode, { normal: keyof Dict; harsh: keyof Dict }> = {
  "insufficient-ability-data": { normal: "diagnosisCardHeadlineInsufficientAbilityDataTemplate", harsh: "diagnosisCardHeadlineInsufficientAbilityDataTemplate" },
  "well-aligned": { normal: "diagnosisCardHeadlineWellAlignedNormalTemplate", harsh: "diagnosisCardHeadlineWellAlignedHarshTemplate" },
  "well-aligned-with-improvement": { normal: "diagnosisCardHeadlineWellAlignedImprovementNormalTemplate", harsh: "diagnosisCardHeadlineWellAlignedImprovementHarshTemplate" },
  "clear-issue": { normal: "diagnosisCardHeadlineClearIssueNormalTemplate", harsh: "diagnosisCardHeadlineClearIssueHarshTemplate" },
  "confirmation-needed": { normal: "diagnosisCardHeadlineConfirmationNormalTemplate", harsh: "diagnosisCardHeadlineConfirmationHarshTemplate" },
  "needs-review": { normal: "diagnosisCardHeadlineNeedsReviewNormalTemplate", harsh: "diagnosisCardHeadlineNeedsReviewHarshTemplate" },
};
/** {category}を必要とする見出しコードのうち、対象groupIdがない(稀なケース)場合はneeds-reviewへ安全に倒す。 */
const HEADLINE_NEEDS_CATEGORY: Partial<Record<CardHeadlineCode, true>> = { "clear-issue": true, "confirmation-needed": true, "well-aligned-with-improvement": true };

function diagnosisHeadlineText(
  model: BuildDiagnosisCardModel,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  locale: Locale,
): string {
  const goal = model.primaryGoalId ? ba(INTENT_GOAL_KEY[model.primaryGoalId]) : "";
  const mode = model.analysisMode;
  const { code, groupId } = model.headline;
  const category = groupId ? groupDisplayName(groupId, locale) : "";
  if (HEADLINE_NEEDS_CATEGORY[code] && !category) {
    const fallback = DIAGNOSIS_HEADLINE_KEY["needs-review"];
    return fillBa(ba(mode === "harsh" ? fallback.harsh : fallback.normal), { goal });
  }
  const keys = DIAGNOSIS_HEADLINE_KEY[code];
  return fillBa(ba(mode === "harsh" ? keys.harsh : keys.normal), { goal, category });
}

/** 最大の注意点(既存のIntentFinding/IntentTopIssue/比較推奨をそのまま文章化するだけ)。 */
function diagnosisConcernText(
  concern: CardConcernItem,
  mode: "normal" | "harsh",
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  locale: Locale,
  intentFindingText: (f: IntentFinding, m: "normal" | "harsh") => string,
): string {
  switch (concern.sourceKind) {
    case "top-issue":
      return fillBa(ba(TOP_ISSUE_FINAL_KEY[concern.topIssueKind as IntentTopIssueKind]), { category: groupDisplayName(concern.groupId, locale) });
    case "top-improvement":
    case "confirmation":
    case "overinvestment":
      return concern.finding ? intentFindingText(concern.finding, mode) : "";
    case "comparison":
      return concern.comparisonNote ? comparisonRecommendationText(concern.comparisonNote, ba, fillBa, locale) : "";
    case "insufficient-data":
      return ba("diagnosisCardConcernInsufficientDataText");
    case "none":
      return ba("diagnosisCardConcernNoneText");
  }
}

/**
 * BuildDiagnosisCardModel(既存の確定済み判定)から、PNG画像化に使う完成済み文字列だけの
 * BuildDiagnosisImageContentを組み立てる(画面用DiagnosisCardと完全に同じ辞書・ラベル関数を再利用し、
 * 画像専用の新しい判定は一切行わない)。worldCardIdフォールバック名は安全側でnullへ変換する。
 */
function buildDiagnosisImageContent(
  model: BuildDiagnosisCardModel,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  locale: Locale,
  intentFindingText: (f: IntentFinding, m: "normal" | "harsh") => string,
): BuildDiagnosisImageContent {
  const primaryPreset = model.selectedPrimaryPresetId ? getPresetById(model.selectedPrimaryPresetId) : undefined;
  const primaryGoalLabel = primaryPreset ? ba(primaryPreset.titleKey as keyof Dict) : model.primaryGoalId ? ba(INTENT_GOAL_KEY[model.primaryGoalId]) : "";
  const subGoalLabels = model.selectedSubPresetIds
    .map((id) => getPresetById(id))
    .filter((p): p is BuildIntentPreset => p != null)
    .map((p) => ba(p.titleKey as keyof Dict));

  const achievementItems: ImageAchievementItem[] = model.achievementItems.map((a) => ({
    label: abilityLabel(a.abilityId, locale),
    valueText: fillBa(ba("abilityGainValueTemplate"), { value: fmt(a.delta) }),
  }));

  let preserveLabel: string | null = null;
  let preserveText: string | null = null;
  if (model.preserveHighlight) {
    preserveLabel = ba("preserveHighlightHeading");
    preserveText = model.preserveHighlight.confirmed
      ? model.preserveHighlight.representativeAbilities.length > 0
        ? model.preserveHighlight.representativeAbilities
            .map((a) => `${abilityLabel(a.abilityId, locale)} ${fillBa(ba("abilityGainValueTemplate"), { value: fmt(a.delta) })}`)
            .join(locale === "ja" ? "・" : ", ")
        : groupDisplayName(model.preserveHighlight.groupId, locale)
      : ba("diagnosisCardPreserveUnconfirmedText");
  }

  let comparison: ImageComparisonContent | null = null;
  if (model.comparisonSummary) {
    const c = model.comparisonSummary;
    const isNotComparable = c.comparisonStatus === "not-comparable" || c.comparisonStatus === "insufficient-data";
    comparison = {
      targetName: c.targetBuildName,
      purposeClosenessLabel: ba("comparisonPurposeClosenessLabel"),
      purposeClosenessValue: ba(PURPOSE_SIMILARITY_KEY[c.purposeSimilarity]),
      differentiationLabel: ba("comparisonDifferentiationLabel"),
      differentiationValue: ba(DIFFERENTIATION_STATUS_KEY[c.differentiationStatus]),
      majorDiffText: c.majorDifference
        ? fillBa(ba(c.majorDifference.currentHigher ? "comparisonMajorDiffCurrentHigherTemplate" : "comparisonMajorDiffOtherHigherTemplate"), {
            ability: abilityLabel(c.majorDifference.abilityId, locale),
            diff: fmt(c.majorDifference.diff),
          })
        : null,
      notComparableText: isNotComparable ? comparisonStatusReasonText(c, ba) : null,
    };
  }

  const disclaimerTexts = model.disclaimerCodes
    .map((code) => INTENT_FINDING_KEY[code])
    .filter((k): k is keyof Dict => !!k)
    .map((k) => ba(k))
    .slice(0, 2);

  return {
    serviceName: "eFootball Team AI",
    modeLabel: model.analysisMode === "harsh" ? ba("imageHarshDiagnosisLabel") : ba("imageNormalDiagnosisLabel"),
    playerName: safePlayerNameForImage(model.playerDisplayName),
    buildName: model.buildDisplayName,
    positionsText: model.intendedPositions.length > 0 ? `${ba("intentPositionLabel")}: ${model.intendedPositions.join(" / ")}` : null,
    primaryGoalLabel,
    subGoalLabels,
    alignmentLabel: diagnosisAlignmentText(model.alignmentStatus, model.dataAvailability.abilityDataStatus === "available", ba),
    headlineText: diagnosisHeadlineText(model, ba, fillBa, locale),
    achievementItems,
    noAchievementsText: achievementItems.length === 0 ? ba("diagnosisCardNoAchievementsText") : null,
    concernLabel: ba("concernHeading"),
    concernText: diagnosisConcernText(model.primaryConcern, model.analysisMode, ba, fillBa, locale, intentFindingText),
    improvementLabel: ba("improvementHeading"),
    improvementText: model.topImprovement ? intentFindingText(model.topImprovement.finding, model.analysisMode) : ba("diagnosisCardConcernNoneText"),
    preserveLabel,
    preserveText,
    comparison,
    disclaimerTexts,
    footerText: ba("imageFooterText"),
  };
}

/**
 * 確定済み育成目的の永続保存操作(保存/更新/削除/保存済み設定へ戻す)。
 * - 保存対象は現在分析中の保存ビルドだけ(BuildInventoryView側のハンドラーが対象ビルドを特定する)。
 * - ここでは表示とボタンのdisabled理由の説明だけを行う。実際の正規化・保存・復元は
 *   build-intent-persistence.ts / build-storage.ts の純関数・ストレージ関数が行う(ここでは再計算しない)。
 */
function SavedIntentControls({ savedIntent: s, ba }: { savedIntent: SavedIntentUIProps; ba: (k: keyof Dict) => string }) {
  if (!s.hasConfirmedIntent && !s.hasSavedIntent) return null;

  const saveDisabled = s.hasPendingChanges || !s.hasConfirmedIntent || s.saveStatus === "saving";
  return (
    <div className="mt-3 border-t border-border/40 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xs font-semibold text-text-dim">
          {ba("savedIntentHeading")}: <span className="text-text">{s.hasSavedIntent ? ba("savedIntentStatusSaved") : ba("savedIntentStatusUnsaved")}</span>
        </p>
        <div role="group" aria-label={ba("savedIntentSaveGroupAriaLabel")} className="flex flex-wrap gap-2">
          {!s.hasSavedIntent ? (
            <button
              type="button"
              disabled={saveDisabled}
              aria-busy={s.saveStatus === "saving"}
              onClick={s.onSave}
              className="min-h-[36px] rounded-md border border-accent bg-accent-soft px-2.5 text-2xs font-semibold text-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {s.saveStatus === "saving" ? ba("savedIntentSavingText") : ba("savedIntentSaveButtonLabel")}
            </button>
          ) : (
            <>
              {!s.matchesCurrent ? (
                <button
                  type="button"
                  disabled={saveDisabled}
                  aria-busy={s.saveStatus === "saving"}
                  onClick={s.onSave}
                  className="min-h-[36px] rounded-md border border-accent bg-accent-soft px-2.5 text-2xs font-semibold text-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s.saveStatus === "saving" ? ba("savedIntentSavingText") : ba("savedIntentUpdateButtonLabel")}
                </button>
              ) : null}
              {!s.matchesCurrent ? (
                <button type="button" onClick={s.onRevertToSaved} className="min-h-[36px] rounded-md border border-border px-2.5 text-2xs text-text-dim hover:border-accent">
                  {ba("savedIntentRevertToSavedLabel")}
                </button>
              ) : null}
              {s.deleteStatus === "confirming" ? (
                <>
                  <span role="alert" className="text-2xs text-text-dim">
                    {ba("savedIntentDeleteConfirmText")}
                  </span>
                  <button
                    type="button"
                    disabled={s.deleteStatus !== "confirming"}
                    onClick={s.onConfirmDelete}
                    className="min-h-[36px] rounded-md border border-danger px-2.5 text-2xs font-semibold text-danger hover:opacity-90"
                  >
                    {ba("savedIntentDeleteOnlyLabel")}
                  </button>
                  <button type="button" onClick={s.onCancelDelete} className="min-h-[36px] rounded-md border border-border px-2.5 text-2xs text-text-dim hover:border-accent">
                    {ba("savedIntentDeleteCancelLabel")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-busy={s.deleteStatus === "deleting"}
                  onClick={s.onRequestDelete}
                  className="min-h-[36px] rounded-md border border-border px-2.5 text-2xs text-text-dim hover:border-danger hover:text-danger"
                >
                  {s.deleteStatus === "deleting" ? ba("savedIntentDeletingText") : ba("savedIntentDeleteButtonLabel")}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!s.hasSavedIntent ? (
        <p className="mt-1 text-2xs text-text-muted">{s.hasConfirmedIntent ? ba("savedIntentUnsavedNoticeText") : ba("savedIntentNoConfirmedIntentText")}</p>
      ) : (
        <p className="mt-1 text-2xs text-text-muted">{s.matchesCurrent ? ba("savedIntentUpToDateText") : ba("savedIntentDivergedText")}</p>
      )}
      {s.hasPendingChanges ? <p className="mt-0.5 text-2xs text-text-muted">{ba("savedIntentPendingChangesText")}</p> : null}
      {s.saveStatus === "success" ? (
        <p role="status" aria-live="polite" className="mt-0.5 text-2xs text-success">
          {ba("savedIntentSaveSuccessText")}
        </p>
      ) : null}
      {s.saveStatus === "failed" ? (
        <p role="alert" className="mt-0.5 text-2xs text-danger">
          {ba("savedIntentSaveFailedText")}
        </p>
      ) : null}
      {s.deleteStatus === "failed" ? (
        <p role="alert" className="mt-0.5 text-2xs text-danger">
          {ba("savedIntentDeleteFailedText")}
        </p>
      ) : null}
      {s.restoredNotice?.presetUnresolved ? (
        <p role="status" className="mt-0.5 text-2xs text-text-muted">
          {ba("savedIntentPresetUnresolvedText")}
        </p>
      ) : null}
      {s.restoredNotice?.comparisonTargetInvalidated ? (
        <p role="status" className="mt-0.5 text-2xs text-text-muted">
          {ba("savedIntentComparisonTargetMissingText")}
        </p>
      ) : null}
    </div>
  );
}

function DiagnosisCard({
  model,
  isOpen,
  onToggleOpen,
  mode,
  onModeChange,
  ba,
  fillBa,
  fmt,
  locale,
  intentFindingText,
  closeLabel,
}: {
  model: BuildDiagnosisCardModel;
  isOpen: boolean;
  onToggleOpen: () => void;
  mode: "normal" | "harsh";
  onModeChange: (m: "normal" | "harsh") => void;
  ba: (k: keyof Dict) => string;
  fillBa: (s: string, vars: Record<string, string>) => string;
  fmt: (n: number) => string;
  locale: Locale;
  intentFindingText: (f: IntentFinding, m: "normal" | "harsh") => string;
  closeLabel: string;
}) {
  const headingId = "diagnosis-card-heading";
  const [imageExportOpen, setImageExportOpen] = useState(false);
  const [imageOrientation, setImageOrientation] = useState<ImageOrientation>("portrait");
  const [imageExportMode, setImageExportMode] = useState<"normal" | "harsh">(mode);
  const [imageStatus, setImageStatus] = useState<"idle" | "generating" | "success" | "failed">("idle");
  const imageOpenButtonRef = useRef<HTMLButtonElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageMountedRef = useRef(true);
  const imageResetTimerRef = useRef<number | null>(null);
  /** 同期的な連打対策(useStateは同一イベントループ内で複数回同期呼び出しされると更新前の値を
   *  読んでしまうため、真の多重生成防止はこのrefで行う。imageStatusは表示専用)。 */
  const imageGeneratingRef = useRef(false);

  useEffect(() => {
    imageMountedRef.current = true;
    return () => {
      imageMountedRef.current = false;
      if (imageResetTimerRef.current != null) window.clearTimeout(imageResetTimerRef.current);
    };
  }, []);

  // 画像用の判定は画面用と完全に同一データ(BuildDiagnosisCardModel)を使い、analysisModeタグだけを
  // 差し替える(build-diagnosis-card.tsのmodeパラメータは表示文体の切り替えにしか使われないため、
  // ここで判定を再計算することにはならない)。
  const imageModel: BuildDiagnosisCardModel = model.cardVariant === "intent" ? { ...model, analysisMode: imageExportMode } : model;
  const imageContent = buildDiagnosisImageContent(imageModel, ba, fillBa, fmt, locale, intentFindingText);

  useEffect(() => {
    if (!imageExportOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    drawBuildDiagnosisCardImage(canvas, imageContent, imageOrientation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageExportOpen, imageOrientation, imageExportMode, model, locale]);

  const handleCloseImageExport = () => {
    setImageExportOpen(false);
    imageOpenButtonRef.current?.focus();
  };

  const handleSaveImage = useCallback(async () => {
    // refへの同期チェック+即時セットで、同一イベントループ内の連続クリック(useStateの更新が
    // 反映される前の重複呼び出し)でも確実に1回だけ実行されるようにする。
    if (imageGeneratingRef.current) return;
    imageGeneratingRef.current = true;
    setImageStatus("generating");
    try {
      const filename = buildDiagnosisImageFileName({
        playerName: imageContent.playerName,
        buildName: imageModel.buildDisplayName,
        goalLabel: imageContent.primaryGoalLabel || "general",
        mode: imageExportMode,
        orientation: imageOrientation,
      });
      const outcome = await saveBuildDiagnosisCardImageAsPng(imageContent, filename, imageOrientation);
      if (!imageMountedRef.current) return;
      setImageStatus(outcome.ok ? "success" : "failed");
    } catch {
      if (imageMountedRef.current) setImageStatus("failed");
    } finally {
      imageGeneratingRef.current = false;
      if (imageMountedRef.current) {
        imageResetTimerRef.current = window.setTimeout(() => {
          if (imageMountedRef.current) setImageStatus("idle");
        }, 3000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageContent, imageModel.buildDisplayName, imageExportMode, imageOrientation]);
  return (
    <div className="mt-3 border-b border-border/60 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-semibold text-text-dim">
          {ba("diagnosisCardHeading")}
        </h3>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <div role="group" aria-label={ba("modeToggleGroupAriaLabel")} className="flex gap-1">
              <button
                type="button"
                aria-pressed={mode === "normal"}
                onClick={() => onModeChange("normal")}
                className={`min-h-[28px] rounded-md border px-2 text-2xs ${mode === "normal" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
              >
                {ba("normalModeLabel")}
              </button>
              <button
                type="button"
                aria-pressed={mode === "harsh"}
                onClick={() => onModeChange("harsh")}
                className={`min-h-[28px] rounded-md border px-2 text-2xs ${mode === "harsh" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
              >
                {ba("harshModeLabel")}
              </button>
            </div>
          ) : null}
          {isOpen && model.cardVariant === "intent" ? (
            <button
              ref={imageOpenButtonRef}
              type="button"
              disabled={model.hasPendingChanges}
              aria-expanded={imageExportOpen}
              aria-controls="diagnosis-image-export-panel"
              aria-label={ba("imageSaveButtonAriaLabel")}
              onClick={() => setImageExportOpen((v) => !v)}
              className="min-h-[28px] rounded-md border border-border px-2 text-2xs text-text-dim hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ba("imageSaveButtonLabel")}
            </button>
          ) : null}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="diagnosis-card-body"
            onClick={onToggleOpen}
            className="min-h-[28px] rounded-md border border-border px-2 text-2xs text-text-dim hover:border-accent"
          >
            {isOpen ? ba("diagnosisCardHideLabel") : ba("diagnosisCardShowLabel")}
          </button>
        </div>
      </div>
      {isOpen ? (
        <div id="diagnosis-card-body" role="region" aria-labelledby={headingId} className="mt-2 rounded-card border border-border/60 bg-surface-alt p-3">
          {model.hasPendingChanges ? (
            <p role="status" className="mb-2 rounded border border-accent/40 bg-accent-soft px-2 py-1 text-2xs font-semibold text-accent">
              {ba("diagnosisCardPendingChangesNotice")}
            </p>
          ) : null}
          {model.cardVariant === "no-intent" ? (
            <p className="text-text-muted">{ba("diagnosisCardGuidanceNoIntentText")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {/* 左: 選手・目的・適合状態 */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="truncate font-semibold text-text" title={model.playerDisplayName}>
                    {model.playerDisplayName}
                  </p>
                  <p className="truncate text-2xs text-text-dim" title={model.buildDisplayName}>
                    {model.buildDisplayName}
                  </p>
                  {model.intendedPositions.length > 0 ? <p className="text-2xs text-text-muted">{ba("intentPositionLabel")}: {model.intendedPositions.join(" / ")}</p> : null}
                </div>
                <div>
                  <p className="text-2xs font-semibold text-text-dim">{ba("presetConfirmedMainLabel")}</p>
                  <p>{model.selectedPrimaryPresetId ? ba((getPresetById(model.selectedPrimaryPresetId)?.titleKey ?? "") as keyof Dict) : "—"}</p>
                  {model.selectedSubPresetIds.length > 0 ? (
                    <p className="mt-0.5 text-2xs text-text-muted">
                      {ba("presetConfirmedSubLabel")}:{" "}
                      {model.selectedSubPresetIds
                        .map((id) => getPresetById(id))
                        .filter((p): p is BuildIntentPreset => p != null)
                        .map((p) => ba(p.titleKey as keyof Dict))
                        .join(locale === "ja" ? "・" : ", ")}
                    </p>
                  ) : null}
                  {model.primaryGoalId ? (
                    <p className="mt-0.5 text-2xs text-text-muted">
                      {ba("intentReflectionFieldPrimaryGoal")}: {ba(INTENT_GOAL_KEY[model.primaryGoalId])}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-2xs font-semibold text-text-dim">{ba("diagnosisCardAlignmentLabel")}</p>
                  <Badge tone={model.alignmentStatus === "high" ? "accent" : model.alignmentStatus === "poorly-aligned" ? "warning" : "neutral"} size="xs">
                    {diagnosisAlignmentText(model.alignmentStatus, model.dataAvailability.abilityDataStatus === "available", ba)}
                  </Badge>
                </div>
                <p className="text-2xs text-text-muted">
                  {ba("pointsHeading")}: {model.totalPoints == null ? fmt(model.usedPoints) : `${fmt(model.usedPoints)} / ${fmt(model.totalPoints)}`}
                  {model.remainingPoints != null ? ` (${fmt(model.remainingPoints)})` : ""}
                </p>
                <p className="text-2xs text-text-muted">
                  {ba("confidenceLabel")}: {ba(CONFIDENCE_KEY[model.confidenceStatus])}
                </p>
              </div>

              {/* 中央: 見出し・主な成果・最大の注意点 */}
              <div className="flex flex-col gap-2">
                <p className="font-semibold leading-relaxed text-text">{diagnosisHeadlineText(model, ba, fillBa, locale)}</p>
                <div>
                  <p className="text-2xs font-semibold text-text-dim">{ba("achievementsHeading")}</p>
                  {model.achievementItems.length > 0 ? (
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {model.achievementItems.map((a) => (
                        <li key={a.abilityId}>
                          {abilityLabel(a.abilityId, locale)} {fillBa(ba("abilityGainValueTemplate"), { value: fmt(a.delta) })}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-0.5 text-text-muted">{ba("diagnosisCardNoAchievementsText")}</p>
                  )}
                </div>
                <div>
                  <p className="text-2xs font-semibold text-text-dim">{ba("concernHeading")}</p>
                  <p className="mt-0.5">{diagnosisConcernText(model.primaryConcern, mode, ba, fillBa, locale, intentFindingText)}</p>
                </div>
              </div>

              {/* 右: 改善候補・維持する長所・比較・制限 */}
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-2xs font-semibold text-text-dim">{ba("improvementHeading")}</p>
                  <p className="mt-0.5">{model.topImprovement ? intentFindingText(model.topImprovement.finding, mode) : ba("diagnosisCardConcernNoneText")}</p>
                </div>
                {model.preserveHighlight ? (
                  <div>
                    <p className="text-2xs font-semibold text-text-dim">{ba("preserveHighlightHeading")}</p>
                    <p className="mt-0.5">
                      {model.preserveHighlight.confirmed
                        ? model.preserveHighlight.representativeAbilities.length > 0
                          ? model.preserveHighlight.representativeAbilities.map((a) => `${abilityLabel(a.abilityId, locale)} ${fillBa(ba("abilityGainValueTemplate"), { value: fmt(a.delta) })}`).join(locale === "ja" ? "・" : ", ")
                          : groupDisplayName(model.preserveHighlight.groupId, locale)
                        : ba("diagnosisCardPreserveUnconfirmedText")}
                    </p>
                  </div>
                ) : null}
                {model.comparisonSummary ? (
                  <div>
                    <p className="text-2xs font-semibold text-text-dim">{ba("comparisonSummaryHeading")}</p>
                    <p className="mt-0.5 truncate font-semibold text-text" title={model.comparisonSummary.targetBuildName}>
                      {model.comparisonSummary.targetBuildName}
                    </p>
                    {model.comparisonSummary.comparisonStatus === "not-comparable" || model.comparisonSummary.comparisonStatus === "insufficient-data" ? (
                      <p role="status" className="mt-0.5 text-text-muted">
                        {model.comparisonSummary.limitations.includes("condition-legacy-vs-current")
                          ? ba("abilityComparisonConditionLegacyText")
                          : model.comparisonSummary.limitations.includes("condition-one-unallocated")
                            ? ba("abilityComparisonConditionUnallocatedText")
                            : ba("comparisonInsufficientAbilityDataText")}
                      </p>
                    ) : (
                      <>
                        <p className="mt-0.5">
                          {ba("comparisonPurposeClosenessLabel")}: {ba(PURPOSE_SIMILARITY_KEY[model.comparisonSummary.purposeSimilarity])}
                        </p>
                        <p className="mt-0.5">
                          {ba("comparisonDifferentiationLabel")}: {ba(DIFFERENTIATION_STATUS_KEY[model.comparisonSummary.differentiationStatus])}
                        </p>
                        {model.comparisonSummary.majorDifference ? (
                          <p className="mt-0.5 text-text-muted">
                            {fillBa(ba(model.comparisonSummary.majorDifference.currentHigher ? "comparisonMajorDiffCurrentHigherTemplate" : "comparisonMajorDiffOtherHigherTemplate"), {
                              ability: abilityLabel(model.comparisonSummary.majorDifference.abilityId, locale),
                              diff: fmt(model.comparisonSummary.majorDifference.diff),
                            })}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-text-muted">{comparisonRecommendationText(model.comparisonSummary, ba, fillBa, locale)}</p>
                      </>
                    )}
                  </div>
                ) : null}
                {model.disclaimerCodes.length > 0 ? (
                  <div>
                    <p className="text-2xs font-semibold text-text-dim">{ba("limitationsHeading")}</p>
                    <ul className="mt-0.5 flex flex-col gap-0.5 text-text-muted">
                      {model.disclaimerCodes.map((code, i) => {
                        const key = INTENT_FINDING_KEY[code];
                        return key ? <li key={`${code}-${i}`}>{ba(key)}</li> : null;
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          {model.cardVariant === "intent" && imageExportOpen ? (
            <div id="diagnosis-image-export-panel" role="region" aria-label={ba("imagePreviewHeading")} className="mt-3 rounded-card border border-border/60 bg-surface p-3">
              {model.hasPendingChanges ? (
                <p role="status" className="mb-2 text-2xs font-semibold text-accent">
                  {ba("imagePendingChangesBlockedText")}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-2xs font-semibold text-text-dim">{ba("imagePreviewHeading")}</p>
                    <button type="button" onClick={handleCloseImageExport} className="min-h-[28px] rounded-md border border-border px-2 text-2xs text-text-dim hover:border-accent">
                      {closeLabel}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div role="group" aria-label={ba("imageOrientationLabel")} className="flex gap-1">
                      <button
                        type="button"
                        aria-pressed={imageOrientation === "portrait"}
                        onClick={() => setImageOrientation("portrait")}
                        className={`min-h-[32px] rounded-md border px-2.5 text-2xs ${imageOrientation === "portrait" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
                      >
                        {ba("imageOrientationPortraitLabel")}
                      </button>
                      <button
                        type="button"
                        aria-pressed={imageOrientation === "landscape"}
                        onClick={() => setImageOrientation("landscape")}
                        className={`min-h-[32px] rounded-md border px-2.5 text-2xs ${imageOrientation === "landscape" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
                      >
                        {ba("imageOrientationLandscapeLabel")}
                      </button>
                    </div>
                    <div role="group" aria-label={ba("imageModeGroupAriaLabel")} className="flex gap-1">
                      <button
                        type="button"
                        aria-pressed={imageExportMode === "normal"}
                        onClick={() => setImageExportMode("normal")}
                        className={`min-h-[32px] rounded-md border px-2.5 text-2xs ${imageExportMode === "normal" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
                      >
                        {ba("normalModeLabel")}
                      </button>
                      <button
                        type="button"
                        aria-pressed={imageExportMode === "harsh"}
                        onClick={() => setImageExportMode("harsh")}
                        className={`min-h-[32px] rounded-md border px-2.5 text-2xs ${imageExportMode === "harsh" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
                      >
                        {ba("harshModeLabel")}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <canvas
                      ref={previewCanvasRef}
                      width={BUILD_DIAGNOSIS_IMAGE_SIZES[imageOrientation].width * BUILD_DIAGNOSIS_IMAGE_SIZES[imageOrientation].scale}
                      height={BUILD_DIAGNOSIS_IMAGE_SIZES[imageOrientation].height * BUILD_DIAGNOSIS_IMAGE_SIZES[imageOrientation].scale}
                      aria-hidden="true"
                      className="rounded border border-border/60"
                      style={{ width: "100%", maxWidth: imageOrientation === "portrait" ? 220 : 420, height: "auto" }}
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={imageStatus === "generating"}
                        aria-busy={imageStatus === "generating"}
                        onClick={handleSaveImage}
                        className="min-h-[44px] rounded-md border border-accent bg-accent-soft px-3 text-2xs font-semibold text-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {imageStatus === "generating" ? ba("imageGeneratingText") : ba("imageSaveConfirmLabel")}
                      </button>
                      {imageStatus === "success" ? (
                        <span role="status" aria-live="polite" className="text-2xs text-success">
                          {ba("imageSuccessText")}
                        </span>
                      ) : null}
                      {imageStatus === "failed" ? (
                        <span role="alert" className="text-2xs text-danger">
                          {ba("imageFailedText")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const BuildAnalysisPanel = forwardRef<
  HTMLDivElement,
  {
    analysis: SavedBuildAnalysis;
    playerName: string;
    buildName: string;
    panelId: string;
    onClose: () => void;
    /** 能力値データを取得中か(分析エンジンの available=false を「未取得」と「確認不能」で区別する表示用)。 */
    abilityLoading?: boolean;
    /** 分析目的(この画面でのみ保持・保存しない・試験的機能)。 */
    intent: BuildIntentInput;
    /** 自由記述(育成の狙い)のみの変更(AI解析の要否判定・stale判定に使うため、他の変更と区別する)。 */
    onFreeTextChange: (freeText: string) => void;
    /** 自由記述以外(手動詳細設定)の変更。呼び出し側で manual/confirmed+修正済み への状態遷移を判定する。 */
    onManualIntentChange: (intent: BuildIntentInput) => void;
    intentAnalysis: BuildIntentAnalysis;
    /** 使用予定ポジションの選択肢(既存プロジェクトの確認済みポジション由来)。 */
    availablePositions: string[];
    /** 比較対象として選択できる、同一カードの実在する保存ビルド。 */
    availableComparisonBuilds: { buildId: string; buildName: string }[];
    /** 育成の狙い(自由記述)のAI解析ライフサイクル状態。 */
    extractionStatus: BuildIntentExtractionStatus;
    /** 確認済みAI抽出結果を、確認後に手動修正したか(true の間は「AIの解釈をユーザーが修正」と表示する)。 */
    userModifiedAfterConfirm: boolean;
    /** ユーザーがまだ確認していない、AIの解釈結果(確認前は分析へ反映しない)。 */
    pendingExtraction: BuildIntentExtraction | null;
    extractionError: BuildIntentExtractionError | null;
    onRequestExtraction: () => void;
    onCancelExtraction: () => void;
    onConfirmExtraction: () => void;
    onDiscardExtraction: () => void;
    /** 候補確認(clarifications)の選択状態: clarificationId → 選択済みoptionId(未回答は未定義)。 */
    clarificationSelections: Record<string, string>;
    onSelectClarificationOption: (clarificationId: string, optionId: string) => void;
    /** 育成目的プリセット方式(標準UIのメイン導線)の状態・操作一式。 */
    presetIntent: PresetIntentUIProps;
    /** 確定済み育成目的の永続保存の状態・操作一式。 */
    savedIntent: SavedIntentUIProps;
  }
>(function BuildAnalysisPanel(
  {
    analysis,
    playerName,
    buildName,
    panelId,
    onClose,
    abilityLoading = false,
    intent,
    onFreeTextChange,
    onManualIntentChange,
    intentAnalysis,
    availablePositions,
    availableComparisonBuilds,
    extractionStatus,
    userModifiedAfterConfirm,
    pendingExtraction,
    extractionError,
    onRequestExtraction,
    onCancelExtraction,
    onConfirmExtraction,
    onDiscardExtraction,
    clarificationSelections,
    onSelectClarificationOption,
    presetIntent,
    savedIntent,
  },
  ref,
) {
  const t = useT();
  const { locale } = useLocale();
  const [mode, setMode] = useState<"normal" | "harsh">("normal");
  /** 診断結果カードの開閉(保存しない・React stateのみ)。 */
  const [isDiagnosisCardOpen, setIsDiagnosisCardOpen] = useState(true);
  const ba = (k: keyof Dict) => t("buildAnalysis", k);
  const fillBa = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const fmt = (n: number) => formatNumber(n, locale);

  /**
   * 自由記述(freeText)だけの変更は onFreeTextChange へ、それ以外(手動詳細設定)の変更は
   * onManualIntentChange へ振り分ける(呼び出し側がAI解析ライフサイクルの状態遷移を正しく判定できるようにするため)。
   * 呼び出し元(このファイル内)は常に単一キーの partial で freeText を更新するため、この判定は安全に成立する。
   */
  const updateIntent = (partial: Partial<BuildIntentInput>) => {
    const keys = Object.keys(partial);
    if (keys.length === 1 && keys[0] === "freeText") {
      onFreeTextChange(partial.freeText as string);
      return;
    }
    onManualIntentChange(normalizeBuildIntent({ ...intent, ...partial }).intent);
  };

  const setGroupState = (groupId: string, state: GroupPriorityState) => {
    const next = { ...intent.groupPriorities };
    if (state === "normal") delete next[groupId];
    else next[groupId] = state;
    // 「優先」「補助的に重視」と「意図的に捨てる」は同一領域で矛盾するため、指定したら捨てる指定を外す。
    const nextIgnored = state === "priority" || state === "secondary" ? intent.intentionallyIgnoredGroups.filter((g) => g !== groupId) : intent.intentionallyIgnoredGroups;
    // 「最優先」と「上げすぎ注意」は原則矛盾するため、最優先へ変更したら上げすぎ注意の指定を外す(補助的優先とは併用可)。
    const nextAvoid = state === "priority" ? intent.avoidOverinvestmentGroups.filter((g) => g !== groupId) : intent.avoidOverinvestmentGroups;
    updateIntent({ groupPriorities: next, intentionallyIgnoredGroups: nextIgnored, avoidOverinvestmentGroups: nextAvoid });
  };

  const toggleInArray = (field: "avoidOverinvestmentGroups" | "intentionallyIgnoredGroups" | "strengthsToPreserve", groupId: string) => {
    const current = intent[field];
    const turningOn = !current.includes(groupId);
    const next = turningOn ? [...current, groupId] : current.filter((g) => g !== groupId);
    if (field === "intentionallyIgnoredGroups" && turningOn) {
      // 「意図的に捨てる」を新たに指定したら、同一領域の「優先」「補助的に重視」指定は矛盾するため外す。
      const nextPriorities = { ...intent.groupPriorities };
      if (nextPriorities[groupId] === "priority" || nextPriorities[groupId] === "secondary") delete nextPriorities[groupId];
      updateIntent({ intentionallyIgnoredGroups: next, groupPriorities: nextPriorities });
      return;
    }
    if (field === "avoidOverinvestmentGroups" && turningOn && intent.groupPriorities[groupId] === "priority") {
      // 「上げすぎ注意」を新たに指定したら、同一領域の「最優先」指定は矛盾するため通常へ戻す(補助的優先はそのまま維持)。
      const nextPriorities = { ...intent.groupPriorities };
      delete nextPriorities[groupId];
      updateIntent({ avoidOverinvestmentGroups: next, groupPriorities: nextPriorities });
      return;
    }
    updateIntent({ [field]: next } as Partial<BuildIntentInput>);
  };

  const intentFindingText = (f: IntentFinding, m: "normal" | "harsh"): string => {
    const key = f.code === "intent-overinvestment-outside-priority" ? INTENT_OVERINVESTMENT_KEY[m] : INTENT_FINDING_KEY[f.code];
    if (!key) return "";
    const vars: Record<string, string> = { category: groupDisplayName(f.groupId, locale) };
    for (const [k, v] of Object.entries(f.params)) {
      if (k === "abilityId") vars.ability = abilityLabel(String(v), locale);
      else vars[k] = typeof v === "number" ? fmt(v) : String(v);
    }
    return fillBa(ba(key), vars);
  };

  const findingText = (f: Finding, m: "normal" | "harsh"): string => {
    const key = (m === "normal" ? NORMAL_KEY : HARSH_KEY)[f.code];
    if (!key) return "";
    const template = ba(key);
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(f.params)) {
      if (k === "categoryId") {
        vars.category = groupDisplayName(String(v), locale);
      } else if (k === "abilityId") {
        vars.ability = abilityLabel(String(v), locale);
      } else {
        vars[k] = typeof v === "number" ? fmt(v) : String(v);
      }
    }
    return fillBa(template, vars);
  };

  const focus = analysis.trainingFocus;
  const primaryCategoryName = groupDisplayName(focus.primaryGroupId, locale);
  const secondaryCategoryName = groupDisplayName(focus.secondaryGroupId, locale);
  const focusText =
    focus.kind === "none"
      ? ba("trainingFocusNoneText")
      : focus.kind === "single"
        ? fillBa(ba("trainingFocusSingleTemplate"), { category: primaryCategoryName, level: String(focus.primaryLevel ?? 0) })
        : focus.kind === "balanced"
          ? ba("trainingFocusBalancedTemplate")
          : focus.secondaryGroupId
            ? fillBa(ba("trainingFocusDominantTemplate"), {
                category: primaryCategoryName,
                level: String(focus.primaryLevel ?? 0),
                secondary: secondaryCategoryName,
              })
            : fillBa(ba("trainingFocusDominantNoSecondaryTemplate"), {
                category: primaryCategoryName,
                level: String(focus.primaryLevel ?? 0),
              });

  const reviewPoints = mode === "normal" ? analysis.normalReviewPoints : analysis.harshReviewPoints;
  const hasStrengths = analysis.strengths.length > 0;
  const hasConcerns = analysis.concerns.length > 0;
  const strengthsConcernsTwoCol = hasStrengths && hasConcerns;
  const hasSuggestions = analysis.improvementSuggestions.length > 0;
  const hasComparison = analysis.comparisonSummary.length > 0;
  const suggestionsComparisonTwoCol = hasSuggestions && hasComparison;
  const comparisonSummaries = buildComparisonSummaries(
    analysis.comparisonSummary,
    intentAnalysis.comparisonRecommendations,
    analysis.abilityImpact.comparisonDifferences,
    intent,
    intentAnalysis,
  );
  const comparisonEntryById = new Map(analysis.comparisonSummary.map((c) => [c.otherBuildId, c]));
  const comparisonTargetMissing = intent.comparisonTargetBuildId != null && !comparisonSummaries.some((s) => s.isUserComparisonTarget);

  // 診断結果カード: 既存の確定済み結果(analysis/intentAnalysis/comparisonSummaries)を合成するだけで、
  // ここで新しい判定・優先順位は生成しない。draft状態(presetIntent.draft*)は一切渡さない。
  const hasPendingIntentChanges = presetIntent.presetStatus === "modified" || presetIntent.presetStatus === "conflicted";
  const diagnosisCard = buildDiagnosisCardModel({
    analysis,
    intentAnalysis,
    intent,
    comparisonSummaries,
    mode,
    playerDisplayName: playerName,
    cardDisplayName: null,
    buildDisplayName: buildName,
    confirmedPrimaryPresetId: presetIntent.confirmedMainPresetId,
    confirmedSubPresetIds: presetIntent.confirmedSubPresetIds,
    abilityLoading,
    hasPendingChanges: hasPendingIntentChanges,
  });

  return (
    <div
      ref={ref}
      id={panelId}
      role="region"
      aria-label={fillBa(ba("panelHeadingTemplate"), { name: playerName })}
      className="mt-4 scroll-mt-4 rounded-card border border-accent/60 bg-surface p-3 text-xs sm:p-4"
    >
      {/* ヘッダー: 横幅いっぱい */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-text">{fillBa(ba("panelHeadingTemplate"), { name: playerName })}</p>
          <p className="truncate text-xs text-text-dim" title={buildName} data-build-analysis-subtitle="true">
            {buildName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-text-dim">
            <span className="tabular-nums">
              {ba("pointsHeading")}:{" "}
              {analysis.totalPoints == null ? `${fmt(analysis.usedPoints)}` : `${fmt(analysis.usedPoints)} / ${fmt(analysis.totalPoints)}`}
              {analysis.remainingPoints != null ? ` (${fmt(analysis.remainingPoints)})` : ""}
            </span>
            <Badge tone={analysis.completionState === "complete" || analysis.completionState === "near-complete" ? "accent" : "neutral"} size="xs">
              {ba(COMPLETION_KEY[analysis.completionState])}
            </Badge>
            <span>
              {ba("confidenceLabel")}:{" "}
              <Badge tone={analysis.confidence.level === "high" ? "accent" : analysis.confidence.level === "unavailable" ? "warning" : "neutral"} size="xs">
                {ba(CONFIDENCE_KEY[analysis.confidence.level])}
              </Badge>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={fillBa(ba("closePanelAriaTemplate"), { name: playerName })}
          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md border border-border hover:border-accent"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* 分析目的(任意入力・保存しない・試験的機能) */}
      <div className="border-b border-border/60 py-3">
        <SectionHeading>{ba("intentSectionHeading")}</SectionHeading>
        <p className="mt-1 text-2xs text-text-muted">{ba("intentUnsavedNote")}</p>

        {SHOW_LEGACY_FREE_TEXT_INTENT_UI ? (
          <>
            {/* 1. 育成の狙い(自由記述・AI解析の入力) */}
            <label className="mt-2 flex flex-col gap-1 text-2xs text-text-dim">
              {ba("buildIntentFreeTextLabel")}
              <span className="text-2xs font-normal text-text-muted" id={`${panelId}-free-text-desc`}>
                {ba("buildIntentFreeTextDescription")}
              </span>
              <textarea
                value={intent.freeText}
                onChange={(e) => updateIntent({ freeText: e.target.value })}
                maxLength={FREE_TEXT_MAX_LENGTH}
                placeholder={ba("buildIntentFreeTextPlaceholder")}
                rows={5}
                aria-describedby={`${panelId}-free-text-desc ${panelId}-free-text-count`}
                className="w-full resize-y rounded border border-border bg-surface px-2 py-1.5 text-xs break-words"
              />
            </label>
            <p id={`${panelId}-free-text-count`} className="mt-0.5 text-2xs tabular-nums text-text-muted">
              {fillBa(ba("intentUserNoteCounterTemplate"), { count: String(intent.freeText.length), max: String(FREE_TEXT_MAX_LENGTH) })}
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer text-2xs text-accent">{ba("buildIntentExampleToggleLabel")}</summary>
              <p className="mt-1 max-w-3xl whitespace-pre-wrap break-words text-2xs text-text-muted">{ba("buildIntentExampleText")}</p>
            </details>

            {/* 2. 育成意図を読み取る(標準解析・ルールベース。外部AIサービスへは送信しない) */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRequestExtraction}
                disabled={extractionStatus === "analyzing" || intent.freeText.trim().length === 0}
                className="min-h-[32px] rounded-md border border-accent bg-accent-soft px-2.5 text-2xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {extractionStatus === "analyzing" ? ba("buildIntentAnalyzingLabel") : ba("buildIntentAnalyzeButtonLabel")}
              </button>
              {extractionStatus === "analyzing" ? (
                <button
                  type="button"
                  onClick={onCancelExtraction}
                  className="min-h-[32px] rounded-md border border-border px-2.5 text-2xs text-text-dim hover:border-accent"
                >
                  {ba("buildIntentCancelLabel")}
                </button>
              ) : null}
              <span aria-live="polite" className="text-2xs text-text-muted">
                {extractionStatus === "confirmed" && userModifiedAfterConfirm ? ba("buildIntentStatusConfirmedModifiedText") : ba(EXTRACTION_STATUS_TEXT_KEY[extractionStatus])}
              </span>
            </div>
            <p className="mt-1 text-2xs text-text-muted">{ba("buildIntentMethodNotice")}</p>

            {extractionStatus === "stale" ? (
              <p className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-2xs text-warning">{ba("buildIntentStaleNotice")}</p>
            ) : null}
            {/*
              通知は extractionError の有無で出す(extractionStatus は既存の手動設定/確定済み構造化意図がある場合、
              AI試行の失敗後もその情報源を失わないよう manual/confirmed/stale へフォールバックすることがあるため、
              「AI未設定/失敗の通知」自体は extractionStatus と切り離して常に表示する)。
            */}
            {extractionStatus === "not-configured" || extractionError?.code === "NOT_CONFIGURED" ? (
              <p className="mt-2 rounded border border-info/40 bg-info/10 px-2 py-1 text-2xs text-info">{ba("buildIntentNotConfiguredNotice")}</p>
            ) : null}
            {extractionError != null && extractionError.code !== "NOT_CONFIGURED" ? (
              <p role="alert" className="mt-2 rounded border border-danger/40 bg-danger/10 px-2 py-1 text-2xs text-danger">
                {ba("buildIntentFailedNotice")}
              </p>
            ) : null}
            {extractionStatus === "manual" ? (
              <p className="mt-2 rounded border border-border/60 bg-surface-2/50 px-2 py-1 text-2xs text-text-dim">{ba("buildIntentManualNotice")}</p>
            ) : null}

            {/* 3. 読み取った育成意図(確認前は分析へ反映しない。読み取れた内容/確認してほしい内容/読み取れなかった内容の3区分で表示する) */}
            {pendingExtraction ? (
              <BuildIntentExtractionResultView
                pendingExtraction={pendingExtraction}
                locale={locale}
                ba={ba}
                availableComparisonBuilds={availableComparisonBuilds}
                clarificationSelections={clarificationSelections}
                onSelectClarificationOption={onSelectClarificationOption}
                onConfirmExtraction={onConfirmExtraction}
                onRequestExtraction={onRequestExtraction}
                onDiscardExtraction={onDiscardExtraction}
                onInsertExampleText={(example) => {
                  const current = intent.freeText;
                  const next = current.trim().length > 0 ? `${current}\n${example}` : example;
                  updateIntent({ freeText: next.slice(0, FREE_TEXT_MAX_LENGTH) });
                }}
              />
            ) : null}

            {/* 4. 詳細設定を修正(手動・折りたたみ。AIを使わない場合もここから直接指定できる) */}
            <details className="mt-3">
              <summary className="cursor-pointer text-2xs font-semibold text-accent">{ba("buildIntentManualDetailsToggleLabel")}</summary>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-2xs text-text-dim">
                  {ba("intentPositionLabel")}
                  <select
                    value={intent.intendedPositions[0] ?? ""}
                    onChange={(e) => updateIntent({ intendedPositions: e.target.value ? [e.target.value] : [] })}
                    className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
                  >
                    <option value="">{ba("intentPositionNoneOption")}</option>
                    {availablePositions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-2xs text-text-dim">
                  {ba("intentPrimaryGoalLabel")}
                  <select
                    value={intent.primaryGoal}
                    onChange={(e) => updateIntent({ primaryGoal: e.target.value as PrimaryGoalId })}
                    className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
                  >
                    {PRIMARY_GOAL_IDS.map((g) => (
                      <option key={g} value={g}>
                        {ba(INTENT_GOAL_KEY[g])}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {availableComparisonBuilds.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-2xs text-text-dim">
                    {ba("buildIntentComparisonTargetLabel")}
                    <select
                      value={intent.comparisonTargetBuildId ?? ""}
                      onChange={(e) => updateIntent({ comparisonTargetBuildId: e.target.value || null })}
                      className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
                    >
                      <option value="">{ba("buildIntentComparisonTargetNoneOption")}</option>
                      {availableComparisonBuilds.map((b) => (
                        <option key={b.buildId} value={b.buildId}>
                          {b.buildName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div className="mt-3">
                <SectionHeading>{ba("intentGroupPrioritiesHeading")}</SectionHeading>
                {intentAnalysis.priorityCountGuidance ? (
                  <p className="mt-1 rounded border border-info/40 bg-info/10 px-2 py-1 text-2xs text-info">
                    {intentFindingText(intentAnalysis.priorityCountGuidance, "normal")}
                  </p>
                ) : null}
                {intentAnalysis.lowerPriorityCountGuidance ? (
                  <p className="mt-1 rounded border border-info/40 bg-info/10 px-2 py-1 text-2xs text-info">
                    {intentFindingText(intentAnalysis.lowerPriorityCountGuidance, "normal")}
                  </p>
                ) : null}
                <p className="mt-1 text-2xs font-semibold text-text-muted">{ba("intentFieldPlayersHeading")}</p>
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PROGRESSION_GROUPS.filter((g) => !g.isGoalkeeping).map((g) => (
                    <GroupPriorityCard
                      key={g.groupId}
                      name={`${panelId}-priority-${g.groupId}`}
                      label={groupDisplayName(g.groupId, locale)}
                      state={groupPriorityState(intent, g.groupId)}
                      onChange={(next) => setGroupState(g.groupId, next)}
                      avoidOverinvestment={intent.avoidOverinvestmentGroups.includes(g.groupId)}
                      onToggleAvoidOverinvestment={() => toggleInArray("avoidOverinvestmentGroups", g.groupId)}
                      intentionallyIgnored={intent.intentionallyIgnoredGroups.includes(g.groupId)}
                      onToggleIntentionallyIgnored={() => toggleInArray("intentionallyIgnoredGroups", g.groupId)}
                      ba={ba}
                    />
                  ))}
                </div>
                <p className="mt-2 text-2xs font-semibold text-text-muted">{ba("intentGoalkeepingHeading")}</p>
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {PROGRESSION_GROUPS.filter((g) => g.isGoalkeeping).map((g) => (
                    <GroupPriorityCard
                      key={g.groupId}
                      name={`${panelId}-priority-${g.groupId}`}
                      label={groupDisplayName(g.groupId, locale)}
                      state={groupPriorityState(intent, g.groupId)}
                      onChange={(next) => setGroupState(g.groupId, next)}
                      avoidOverinvestment={intent.avoidOverinvestmentGroups.includes(g.groupId)}
                      onToggleAvoidOverinvestment={() => toggleInArray("avoidOverinvestmentGroups", g.groupId)}
                      intentionallyIgnored={intent.intentionallyIgnoredGroups.includes(g.groupId)}
                      onToggleIntentionallyIgnored={() => toggleInArray("intentionallyIgnoredGroups", g.groupId)}
                      ba={ba}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xs font-semibold text-text-muted">{ba("buildIntentStrengthsToPreserveLabel")}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {PROGRESSION_GROUPS.map((g) => {
                    const checked = intent.strengthsToPreserve.includes(g.groupId);
                    return (
                      <label
                        key={g.groupId}
                        className={`flex min-h-[28px] cursor-pointer items-center gap-1 rounded border px-1.5 text-2xs ${checked ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleInArray("strengthsToPreserve", g.groupId)} className="sr-only" />
                        {checked ? <Icon name="check" size={10} /> : null}
                        {groupDisplayName(g.groupId, locale)}
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
          </>
        ) : null}

        {/* 育成目的プリセット方式(標準UIのメイン導線)。検索・カテゴリ・カード選択・プレビュー・詳細設定・確定を1つにまとめる。 */}
        <PresetIntentSection
          presetIntent={presetIntent}
          availablePositions={availablePositions}
          availableComparisonBuilds={availableComparisonBuilds}
          locale={locale}
          ba={ba}
          fillBa={fillBa}
          panelId={panelId}
        />

        {/* 5. 入力内容の反映状況: 実際の分析ロジックと必ず一致させる(目的プリセット方式) */}
        <div className="mt-3">
          <SectionHeading>{ba("intentReflectionHeading")}</SectionHeading>
          <p className="mt-1 text-2xs text-text-dim">
            {ba("presetReflectionSourceLabel")}:{" "}
            <Badge tone={resolvePresetReflectionSource(presetIntent, intent) !== "none" ? "accent" : "neutral"} size="xs">
              {ba(PRESET_REFLECTION_SOURCE_KEY[resolvePresetReflectionSource(presetIntent, intent)])}
            </Badge>
          </p>
          {(() => {
            // 目的プリセット方式の標準UIでは自由記述を使用しないため、freeText行はそもそも表示しない
            // (常に空になり、「該当なし」を誤って目的なしと誤読させるため)。
            const entries = computeIntentReflectionStatus(intent, {
              freeTextApplied: false,
              comparisonTargetResolved: intentAnalysis.reflectionStatus.find((e) => e.field === "comparisonTarget")?.status === "used",
              preserveConfirmed: intentAnalysis.reflectionStatus.find((e) => e.field === "strengthsToPreserve")?.status === "used",
            }).filter((e) => e.field !== "freeText");
            const filled = entries.filter((e) => e.status !== "not-specified");
            const unspecified = entries.filter((e) => e.status === "not-specified");
            return (
              <>
                <dl className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filled.map((entry) => (
                    <ReflectionStatusRow key={entry.field} entry={entry} intent={intent} ba={ba} locale={locale} availableComparisonBuilds={availableComparisonBuilds} />
                  ))}
                </dl>
                {unspecified.length > 0 ? (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-2xs text-text-muted">{ba("intentReflectionUnspecifiedToggleLabel")}</summary>
                    <dl className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {unspecified.map((entry) => (
                        <ReflectionStatusRow key={entry.field} entry={entry} intent={intent} ba={ba} locale={locale} availableComparisonBuilds={availableComparisonBuilds} />
                      ))}
                    </dl>
                  </details>
                ) : null}
              </>
            );
          })()}
        </div>

        {intentAnalysis.hasIntent ? (
          <div className="mt-3 border-t border-border/40 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <SectionHeading>{ba("intentAlignmentLabel")}</SectionHeading>
              <Badge
                tone={
                  intentAnalysis.alignment === "high"
                    ? "accent"
                    : intentAnalysis.alignment === "poorly-aligned"
                      ? "warning"
                      : "neutral"
                }
                size="xs"
              >
                {ba(INTENT_ALIGNMENT_KEY[intentAnalysis.alignment])}
              </Badge>
            </div>
            {/*
              この構造化グリッドは辛口モードでのみ表示する(通常モードの短い結論段落=composeIntentNormalText と
              内容が重複するため、2つのモードで同じ分析を2回表示しないよう、モード切り替えをこのセクション全体へ
              適用する)。
            */}
            {mode === "harsh" ? (
              <>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <IntentTextList
                    heading={ba("intentAlignedHeading")}
                    texts={[
                      ...intentAnalysis.priorityAlignments
                        .filter((a) => a.state === "strongly-aligned" || a.state === "mostly-aligned")
                        .map((a) => priorityAlignmentEntryText(a, ba, fillBa, fmt, locale)),
                      ...(intentAnalysis.balanceGoalFinding?.code === "intent-primary-goal-reflected" ? [ba("intentFindingPrimaryGoalReflected")] : []),
                    ]}
                    ba={ba}
                  />
                  {/* 目的との明確な不一致(最優先の未反映・優先度不足・明確な優先順位逆転)。軽度の逆転は含めない。 */}
                  <IntentTextList
                    heading={ba("intentMisalignmentHeading")}
                    texts={[
                      ...intentAnalysis.priorityAlignments
                        .filter((a) => a.state === "present-but-underprioritized" || a.state === "not-reflected" || a.state === "insufficient-data")
                        .map((a) => priorityAlignmentEntryText(a, ba, fillBa, fmt, locale)),
                      ...intentAnalysis.secondaryAlignments
                        .filter((a) => a.priorityInversionSeverity === "clear-inversion")
                        .map((a) => intentFindingText({ code: "intent-secondary-priority-inversion", groupId: a.groupId, params: {} }, "normal")),
                      ...(intentAnalysis.balanceGoalFinding?.code === "intent-primary-goal-mismatch"
                        ? [fillBa(ba("intentFindingPrimaryGoalMismatch"), { category: groupDisplayName(intentAnalysis.balanceGoalFinding.groupId, locale) })]
                        : []),
                    ]}
                    ba={ba}
                  />
                  {/* 優先順位の確認事項(明確な不一致ではないが、配分が意図どおりか確認してほしい軽微な逆転)。 */}
                  <IntentTextList
                    heading={ba("intentConfirmationHeading")}
                    texts={intentAnalysis.priorityConfirmationItems.map((f) => intentFindingText(f, "normal"))}
                    ba={ba}
                  />
                  <IntentTextList
                    heading={ba("intentOverinvestmentHeading")}
                    texts={[
                      ...intentAnalysis.avoidOverinvestmentFindings.map((f) => intentFindingText(f, "normal")),
                      ...intentAnalysis.possibleOverinvestmentForIntent.map((f) => intentFindingText(f, "normal")),
                    ]}
                    ba={ba}
                  />
                  {/* 低優先・今回は評価対象外(1件へ統合。領域ごとの重複免責文は生成しない)。 */}
                  <IntentTextList
                    heading={ba("intentAcceptableLowHeading")}
                    texts={intentAnalysis.acceptableLowSummary ? [composeAcceptableLowText(intentAnalysis.acceptableLowSummary, ba, fillBa, locale)] : []}
                    ba={ba}
                  />
                  <IntentTextList
                    heading={ba("intentSecondaryHeading")}
                    texts={intentAnalysis.secondaryAlignments.map((a) => secondaryAlignmentEntryText(a, ba, fillBa, fmt, locale))}
                    ba={ba}
                  />
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <SavedIntentControls savedIntent={savedIntent} ba={ba} />

      <DiagnosisCard
        model={diagnosisCard}
        isOpen={isDiagnosisCardOpen}
        onToggleOpen={() => setIsDiagnosisCardOpen((v) => !v)}
        mode={mode}
        onModeChange={setMode}
        ba={ba}
        fillBa={fillBa}
        fmt={fmt}
        locale={locale}
        intentFindingText={intentFindingText}
        closeLabel={t("common", "close")}
      />

      {/* 左: 配分と能力値成果 / 右: 長所と注意点 */}
      <div className="grid grid-cols-1 gap-4 border-b border-border/60 py-3 lg:grid-cols-2">
        {/* 左: 配分と能力値成果 */}
        <div className="flex flex-col gap-3">
          <div>
            <SectionHeading>{ba("trainingFocusHeading")}</SectionHeading>
            <p className="mt-1">{focusText}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <SectionHeading>{ba("strongestGrowthHeading")}</SectionHeading>
              {analysis.strongestGrowthAreas.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {analysis.strongestGrowthAreas.map((area) => (
                    <li key={area.groupId}>
                      <Badge tone="accent" size="xs">
                        {groupDisplayName(area.groupId, locale)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-text-muted">{ba("strongestGrowthNoneText")}</p>
              )}
            </div>
            <div>
              <SectionHeading>{ba("underinvestedHeading")}</SectionHeading>
              {analysis.underinvestedAreas.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {analysis.underinvestedAreas.map((area) => (
                    <li key={area.groupId}>
                      <Badge tone="warning" size="xs">
                        {groupDisplayName(area.groupId, locale)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-text-muted">{ba("underinvestedNoneText")}</p>
              )}
            </div>
          </div>
          <div>
            <SectionHeading>{ba("abilityMainEffectsHeading")}</SectionHeading>
            {abilityLoading ? (
              <p className="mt-1 text-text-muted">{ba("abilityLoadingText")}</p>
            ) : !analysis.abilityImpact.available ? (
              <p className="mt-1 text-text-muted">{ba("abilityNoDataText")}</p>
            ) : analysis.abilityImpact.largestGains.length === 0 ? (
              <p className="mt-1 text-text-muted">{ba("abilityNoGainsText")}</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-0.5">
                {analysis.abilityImpact.largestGains.map((g: AbilityRankEntry) => (
                  <li key={g.abilityId} className="flex items-center justify-between gap-2">
                    <span className="truncate">{abilityLabel(g.abilityId, locale)}</span>
                    <span className="shrink-0 tabular-nums text-accent">{fillBa(ba("abilityGainValueTemplate"), { value: fmt(g.value) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 右: 長所と注意点 */}
        <div className={`grid grid-cols-1 gap-3 ${strengthsConcernsTwoCol ? "sm:grid-cols-2" : ""}`}>
          {hasStrengths ? (
            <div>
              <SectionHeading>{ba("strengthsHeading")}</SectionHeading>
              <ul className="mt-1 list-disc pl-4">
                {analysis.strengths.map((f, i) => (
                  <li key={`${f.code}-${i}`}>{findingText(f, "normal")}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {hasConcerns ? (
            <div>
              <SectionHeading>{ba("concernsHeading")}</SectionHeading>
              <ul className="mt-1 list-disc pl-4">
                {analysis.concerns.map((f, i) => (
                  <li key={`${f.code}-${i}`}>{findingText(f, "normal")}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!hasStrengths && !hasConcerns ? (
            <div>
              <SectionHeading>{ba("strengthsHeading")}</SectionHeading>
              <p className="mt-1 text-text-muted">{ba("noStrengthsText")}</p>
              <p className="mt-2 font-semibold text-text-dim">{ba("concernsHeading")}</p>
              <p className="mt-1 text-text-muted">{ba("noConcernsText")}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* 通常 / 辛口 評価: 横幅いっぱいだが文章は読みやすい幅に収める */}
      <div className="border-b border-border/60 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading>{mode === "normal" ? ba("normalReviewHeading") : ba("harshReviewHeading")}</SectionHeading>
          <div role="group" aria-label={ba("modeToggleGroupAriaLabel")} className="flex gap-1">
            <button
              type="button"
              aria-pressed={mode === "normal"}
              onClick={() => setMode("normal")}
              className={`min-h-[32px] rounded-md border px-2.5 text-2xs ${mode === "normal" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
            >
              {ba("normalModeLabel")}
            </button>
            <button
              type="button"
              aria-pressed={mode === "harsh"}
              onClick={() => setMode("harsh")}
              className={`min-h-[32px] rounded-md border px-2.5 text-2xs ${mode === "harsh" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
            >
              {ba("harshModeLabel")}
            </button>
          </div>
        </div>
        {/* 1. 育成配分そのものの評価(既存の一般分析・目的入力の有無に関わらず不変) */}
        <div>
          <p className="mt-2 text-2xs font-semibold text-text-muted">{ba("generalEvaluationHeading")}</p>
          {reviewPoints.length > 0 ? (
            <p className="mt-1 max-w-3xl leading-relaxed">
              {reviewPoints.map((f, i) => (
                <span key={`${f.code}-${i}`}>{findingText(f, mode)} </span>
              ))}
            </p>
          ) : (
            <p className="mt-1 text-text-muted">{ba("trainingFocusNoneText")}</p>
          )}
        </div>

        {/* 2. 入力した目的に対する評価(目的未入力時は案内を表示し、空表示にしない)
             通常: 結論相当を含む短い1段落(辛口の単純な短縮版にしない)。
             辛口: 結論から始まる見出し付きセクション(内容がないセクションは表示しない)。 */}
        <div className="mt-3 border-t border-border/40 pt-2">
          <p className="text-2xs font-semibold text-text-muted">{ba("intentEvaluationHeading")}</p>
          {mode === "harsh" && intentAnalysis.hasIntent ? (
            <p className="mt-1 rounded border border-accent/40 bg-accent-soft px-2 py-1 text-2xs font-semibold text-accent">
              {presetConfirmedBannerText(presetIntent, ba, locale)}
            </p>
          ) : null}
          {!intentAnalysis.hasIntent ? (
            <p className="mt-1 text-text-muted">{ba("intentEvaluationEmptyGuidance")}</p>
          ) : mode === "normal" ? (
            <p className="mt-1 max-w-3xl leading-relaxed text-text-dim">
              {composeIntentNormalText(intentAnalysis, intent, ba, fillBa, fmt, locale, intentFindingText)}
            </p>
          ) : (
            composeIntentHarshSections(intentAnalysis, intent, ba, fillBa, fmt, locale, intentFindingText).map((section, i) => (
              <div key={i} className="mt-2">
                <p className="text-2xs font-semibold text-text-dim">{section.heading}</p>
                <p className="mt-0.5 max-w-3xl leading-relaxed text-text-dim">{section.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 改善候補・同一カード比較 */}
      <div className={`grid grid-cols-1 gap-3 py-3 ${suggestionsComparisonTwoCol ? "md:grid-cols-2" : ""}`}>
        <div>
          <SectionHeading>{ba("improvementHeading")}</SectionHeading>
          {intentAnalysis.hasIntent ? (
            <>
              {intentAnalysis.improvementPriorities.length > 0 ? (
                <ol className="mt-1 flex flex-col gap-1.5">
                  {intentAnalysis.improvementPriorities.map((f, i) => (
                    <IntentImprovementCard
                      key={`${f.code}-${i}`}
                      rank={i + 1}
                      finding={f}
                      preserveHighlight={i === 0 ? intentAnalysis.preserveHighlight : null}
                      ba={ba}
                      fillBa={fillBa}
                      locale={locale}
                      intentFindingText={intentFindingText}
                    />
                  ))}
                </ol>
              ) : (
                <p className="mt-1 text-text-muted">{ba("noSuggestionsText")}</p>
              )}
              {/* 低優先・評価対象外領域は一般的な観点からも改善候補にしない。目的別と競合しない残りだけを補足として折りたたむ。 */}
              {(() => {
                const generalSuggestionsForIntent = filterImprovementSuggestionsForIntent(analysis.improvementSuggestions, intent);
                return generalSuggestionsForIntent.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-2xs text-text-muted">{ba("generalSuggestionsToggleLabel")}</summary>
                    <ol className="mt-1 flex flex-col gap-1.5">
                      {generalSuggestionsForIntent.map((s) => (
                        <SuggestionRow key={s.code + s.priority} s={s} ba={ba} fillBa={fillBa} fmt={fmt} locale={locale} />
                      ))}
                    </ol>
                  </details>
                ) : null;
              })()}
            </>
          ) : hasSuggestions ? (
            <ol className="mt-1 flex flex-col gap-1.5">
              {analysis.improvementSuggestions.map((s) => (
                <SuggestionRow key={s.code + s.priority} s={s} ba={ba} fillBa={fillBa} fmt={fmt} locale={locale} />
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-text-muted">{ba("noSuggestionsText")}</p>
          )}
        </div>
        {hasComparison ? (
          <div>
            <SectionHeading>{ba("comparisonHeading")}</SectionHeading>
            {comparisonTargetMissing ? <p role="status" className="mt-1 text-text-muted">{ba("comparisonTargetNotFoundText")}</p> : null}
            <ul className="mt-1 flex flex-col gap-1.5">
              {comparisonSummaries.map((s) => {
                const entry = comparisonEntryById.get(s.targetBuildId);
                return entry ? <ComparisonSummaryCard key={s.targetBuildId} s={s} entry={entry} mode={mode} ba={ba} fillBa={fillBa} fmt={fmt} locale={locale} /> : null;
              })}
            </ul>
          </div>
        ) : (
          <div>
            <SectionHeading>{ba("comparisonHeading")}</SectionHeading>
            <p className="mt-1 text-text-muted">{ba("noComparisonText")}</p>
          </div>
        )}
      </div>

      {/* 能力値差分詳細（補助情報・既定で折りたたみ） */}
      {analysis.abilityImpact.available ? (
        <details className="border-t border-border/60 pt-2">
          <summary className="cursor-pointer text-2xs text-text-muted hover:text-text">{ba("abilityDetailToggleLabel")}</summary>
          <div className="mt-1 grid grid-cols-1 gap-3 text-2xs sm:grid-cols-2">
            <div>
              <p className="font-semibold text-text-dim">{ba("abilityLargestGainsLabel")}</p>
              <ul className="mt-0.5 flex flex-col gap-0.5 text-text-muted">
                {analysis.abilityImpact.largestGains.map((g: AbilityRankEntry) => {
                  const base = analysis.abilityImpact.baseAbilities?.[g.abilityId];
                  const trained = analysis.abilityImpact.trainedAbilities?.[g.abilityId];
                  const final = analysis.abilityImpact.finalAbilities?.[g.abilityId];
                  return (
                    <li key={g.abilityId}>
                      {fillBa(ba("abilityDetailRowTemplate"), {
                        ability: abilityLabel(g.abilityId, locale),
                        before: base != null ? fmt(base) : "—",
                        trained: trained != null ? fmt(trained) : "—",
                        final: final != null ? fmt(final) : "—",
                        delta: fmt(g.value),
                      })}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text-dim">{ba("abilityHighestFinalLabel")}</p>
              <ul className="mt-0.5 flex flex-col gap-0.5 text-text-muted">
                {analysis.abilityImpact.highestFinalAbilities.map((g: AbilityRankEntry) => (
                  <li key={g.abilityId}>
                    {abilityLabel(g.abilityId, locale)}: {fmt(g.value)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      ) : null}

      {/* 分析上の制限（補助情報・既定で折りたたみ） */}
      <details className="border-t border-border/60 pt-2">
        <summary className="cursor-pointer text-2xs text-text-muted hover:text-text">{ba("limitationsHeading")}</summary>
        {analysis.limitations.length > 0 ? (
          <ul className="mt-1 list-disc pl-4 text-2xs text-text-muted">
            {analysis.limitations.map((code, i) => {
              const key = NORMAL_KEY[code];
              return <li key={`${code}-${i}`}>{key ? ba(key) : code}</li>;
            })}
          </ul>
        ) : (
          <p className="mt-1 text-2xs text-text-muted">{ba("noLimitationsText")}</p>
        )}
      </details>

      <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={fillBa(ba("closePanelAriaTemplate"), { name: playerName })}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-3 text-2xs hover:border-accent"
        >
          <Icon name="close" size={12} />
          {t("common", "close")}
        </button>
      </div>
    </div>
  );
});

/**
 * 目的別改善候補1件分(結論・辛口の最終判断と単一正本を共有する intentAnalysis.improvementPriorities から生成する)。
 * 低優先・今回は評価対象外の領域は improvementPriorities に含まれないため、ここへは出てこない。
 */
function IntentImprovementCard({
  rank,
  finding,
  preserveHighlight,
  ba,
  fillBa,
  locale,
  intentFindingText,
}: {
  rank: number;
  finding: IntentFinding;
  preserveHighlight: PriorityAlignmentEntry | null;
  ba: (k: keyof Dict) => string;
  fillBa: (s: string, vars: Record<string, string>) => string;
  locale: Locale;
  intentFindingText: (f: IntentFinding, m: "normal" | "harsh") => string;
}) {
  const targetCategoryName = finding.groupId ? groupDisplayName(finding.groupId, locale) : "";
  return (
    <li className="rounded-md border border-border/60 p-2">
      <p className="font-semibold text-text">
        {fillBa(ba("priorityLabelTemplate"), { priority: String(rank) })}
        {targetCategoryName ? ` — ${targetCategoryName}` : ""}
      </p>
      <p className="mt-0.5 text-text-dim">
        {ba("suggestionReasonLabel")}
        {intentFindingText(finding, "harsh")}
      </p>
      <p className="mt-0.5 text-text-muted">
        {ba("suggestionPreserveLabel")}
        {preserveHighlight ? groupDisplayName(preserveHighlight.groupId, locale) : ba("suggestionPreserveNoneText")}
      </p>
      <p className="mt-0.5 text-2xs text-text-muted">{ba("improvementSourceIntentLabel")}</p>
    </li>
  );
}

function SuggestionRow({
  s,
  ba,
  fillBa,
  fmt,
  locale,
}: {
  s: ImprovementSuggestion;
  ba: (k: keyof Dict) => string;
  fillBa: (s: string, vars: Record<string, string>) => string;
  fmt: (n: number) => string;
  locale: Locale;
}) {
  const titleKey = SUGGESTION_TITLE_KEY[s.code];
  const reasonKey = SUGGESTION_REASON_KEY[s.code];
  const recheckKey = SUGGESTION_RECHECK_KEY[s.code];
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.params)) {
    if (k === "categoryId") vars.category = groupDisplayName(String(v), locale);
    else vars[k] = typeof v === "number" ? fmt(v) : String(v);
  }
  const targetCategoryName = groupDisplayName(s.targetGroupId, locale);
  const preserveCategoryName = groupDisplayName(s.preserveGroupId, locale);
  return (
    <li className="rounded-md border border-border/60 p-2">
      <p className="font-semibold text-text">
        {fillBa(ba("priorityLabelTemplate"), { priority: String(s.priority) })} — {titleKey ? fillBa(ba(titleKey), vars) : s.code}
      </p>
      {s.targetGroupId ? <p className="mt-0.5 text-text-dim">{fillBa(ba("suggestionTargetTemplate"), { category: targetCategoryName })}</p> : null}
      {reasonKey ? (
        <p className="mt-0.5 text-text-dim">
          {ba("suggestionReasonLabel")}
          {fillBa(ba(reasonKey), vars)}
        </p>
      ) : null}
      {recheckKey ? (
        <p className="mt-0.5 text-text-dim">
          {ba("suggestionRecheckLabel")}
          {ba(recheckKey)}
        </p>
      ) : null}
      <p className="mt-0.5 text-text-muted">
        {ba("suggestionPreserveLabel")}
        {s.preserveGroupId ? preserveCategoryName : ba("suggestionPreserveNoneText")}
      </p>
    </li>
  );
}

function directionText(
  diff: number | null,
  otherName: string,
  ba: (k: keyof Dict) => string,
  fillBa: (s: string, vars: Record<string, string>) => string,
  fmt: (n: number) => string,
  keys: { more: keyof Dict; less: keyof Dict; same: keyof Dict; unknown: keyof Dict },
): string {
  if (diff == null) return ba(keys.unknown);
  if (diff === 0) return fillBa(ba(keys.same), { other: otherName });
  return fillBa(ba(diff > 0 ? keys.more : keys.less), { other: otherName, diff: fmt(Math.abs(diff)) });
}

function IntentTextList({
  heading,
  texts,
  ba,
}: {
  heading: string;
  texts: string[];
  ba: (k: keyof Dict) => string;
}) {
  const nonEmpty = texts.filter((s) => s.length > 0);
  return (
    <div>
      <p className="font-semibold text-text-dim">{heading}</p>
      {nonEmpty.length > 0 ? (
        <ul className="mt-1 list-disc pl-4">
          {nonEmpty.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-text-muted">{ba("intentNoneText")}</p>
      )}
    </div>
  );
}

const GROUP_STATE_OPTIONS: GroupPriorityState[] = ["priority", "secondary", "normal", "low"];

/**
 * 能力領域ごとの3段階(優先/通常/低優先)入力カード。
 * - ネイティブの radio グループ(1領域につき1つの name)で、排他的選択・キーボード操作・
 *   スクリーンリーダー対応を標準機能だけで満たす。
 * - 選択状態は文字・枠線・背景・チェックアイコンを組み合わせて示し、色だけに依存しない。
 */
function GroupPriorityCard({
  name,
  label,
  state,
  onChange,
  avoidOverinvestment,
  onToggleAvoidOverinvestment,
  intentionallyIgnored,
  onToggleIntentionallyIgnored,
  ba,
}: {
  name: string;
  label: string;
  state: GroupPriorityState;
  onChange: (next: GroupPriorityState) => void;
  avoidOverinvestment: boolean;
  onToggleAvoidOverinvestment: () => void;
  intentionallyIgnored: boolean;
  onToggleIntentionallyIgnored: () => void;
  ba: (k: keyof Dict) => string;
}) {
  return (
    <fieldset
      className={`rounded-md border p-2 text-2xs transition-colors ${
        state === "priority"
          ? "border-accent bg-accent-soft"
          : state === "secondary"
            ? "border-info/60 bg-info/10"
            : state === "low"
              ? "border-border bg-surface-2/50"
              : "border-border/60 bg-surface"
      }`}
    >
      <legend className="truncate px-1 font-semibold text-text">{label}</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {GROUP_STATE_OPTIONS.map((opt) => {
          const checked = state === opt;
          return (
            <label
              key={opt}
              className={`flex min-h-[32px] cursor-pointer items-center justify-center gap-0.5 rounded border px-1 text-center text-2xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                checked
                  ? opt === "secondary"
                    ? "border-info bg-info font-semibold text-white"
                    : "border-accent bg-accent font-semibold text-white"
                  : "border-border text-text-dim hover:border-accent"
              }`}
            >
              <input type="radio" name={name} value={opt} checked={checked} onChange={() => onChange(opt)} className="sr-only" />
              {checked ? <Icon name="check" size={10} /> : null}
              {ba(GROUP_STATE_KEY[opt])}
            </label>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <label
          className={`flex min-h-[26px] cursor-pointer items-center gap-0.5 rounded border px-1 text-2xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
            avoidOverinvestment ? "border-warning bg-warning/10 text-warning" : "border-border text-text-dim hover:border-accent"
          }`}
        >
          <input type="checkbox" checked={avoidOverinvestment} onChange={onToggleAvoidOverinvestment} className="sr-only" />
          {avoidOverinvestment ? <Icon name="check" size={10} /> : null}
          {ba("buildIntentAvoidOverinvestmentLabel")}
        </label>
        <label
          className={`flex min-h-[26px] cursor-pointer items-center gap-0.5 rounded border px-1 text-2xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
            intentionallyIgnored ? "border-border bg-surface-2 text-text-dim" : "border-border text-text-dim hover:border-accent"
          }`}
        >
          <input type="checkbox" checked={intentionallyIgnored} onChange={onToggleIntentionallyIgnored} className="sr-only" />
          {intentionallyIgnored ? <Icon name="check" size={10} /> : null}
          {ba("buildIntentIntentionallyIgnoreLabel")}
        </label>
      </div>
    </fieldset>
  );
}

function categoryTabClassName(selected: boolean): string {
  return `min-h-[32px] rounded-md border px-2.5 text-2xs ${selected ? "border-accent bg-accent text-white font-semibold" : "border-border text-text-dim hover:border-accent"}`;
}

/** 目的プリセット1件のカード(メイン/サブとして選択できる)。 */
function PresetCard({
  preset,
  locale,
  ba,
  isMain,
  isSub,
  subDisabled,
  onSelectMain,
  onToggleSub,
}: {
  preset: BuildIntentPreset;
  locale: Locale;
  ba: (k: keyof Dict) => string;
  isMain: boolean;
  isSub: boolean;
  subDisabled: boolean;
  onSelectMain: () => void;
  onToggleSub: () => void;
}) {
  const bd = (code: string) => ba(code as keyof Dict);
  const abilityAreas = [...preset.priorityGroups, ...preset.secondaryGroups];
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border p-2 text-2xs ${
        isMain ? "border-accent bg-accent-soft" : isSub ? "border-info/60 bg-info/10" : "border-border/60 bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="font-semibold text-text">{bd(preset.titleKey)}</p>
        {isMain ? (
          <Badge tone="accent" size="xs">
            {ba("presetMainSelectedBadge")}
          </Badge>
        ) : isSub ? (
          <Badge tone="neutral" size="xs">
            {ba("presetSubSelectedBadge")}
          </Badge>
        ) : null}
      </div>
      <p className="text-text-dim">{bd(preset.shortDescriptionKey)}</p>
      {abilityAreas.length > 0 ? (
        <p className="text-2xs text-text-muted">
          {ba("presetPrimaryAbilityAreasLabel")}: {joinCategories(abilityAreas, locale)}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onSelectMain}
          aria-pressed={isMain}
          className={`min-h-[28px] rounded border px-2 text-2xs ${isMain ? "border-accent bg-accent text-white font-semibold" : "border-border text-text-dim hover:border-accent"}`}
        >
          {ba("presetMainSelectLabel")}
        </button>
        <button
          type="button"
          onClick={onToggleSub}
          disabled={subDisabled}
          aria-pressed={isSub}
          className={`min-h-[28px] rounded border px-2 text-2xs disabled:cursor-not-allowed disabled:opacity-40 ${isSub ? "border-info bg-info text-white font-semibold" : "border-border text-text-dim hover:border-accent"}`}
        >
          {ba("presetSubSelectLabel")}
        </button>
      </div>
    </div>
  );
}

/** 設定プレビューの1行(プリセット由来/ユーザー変更/未指定を区別して表示する)。 */
function PresetPreviewRow({ label, value, sourceLabel, ba }: { label: string; value: string; sourceLabel?: string; ba: (k: keyof Dict) => string }) {
  return (
    <div className="rounded border border-border/60 p-1.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-text">
        {value || ba("buildIntentInterpNoneValue")}
        {sourceLabel ? <span className="ml-1 text-2xs text-text-muted">({sourceLabel})</span> : null}
      </dd>
    </div>
  );
}

/**
 * 育成目的プリセット方式(標準UIのメイン導線)。
 * - 目的検索・おすすめ・カテゴリ・カード一覧からメイン目的(最大1件)・サブ目的(最大2件)を選択する。
 * - 選択直後に設定プレビューを即時更新するが、通常/辛口評価へは「この目的で分析」を押すまで反映しない。
 * - 詳細設定(既存の4段階優先度UIを再利用)でプリセット由来の既定値を調整でき、
 *   プリセット既定値とユーザー修正を表示上区別する。
 * - 選択した目的と詳細設定が逆方向を向く場合は競合として検出し、自動解消せずユーザーに選ばせる。
 */
function PresetIntentSection({
  presetIntent,
  availablePositions,
  availableComparisonBuilds,
  locale,
  ba,
  panelId,
}: {
  presetIntent: PresetIntentUIProps;
  availablePositions: string[];
  availableComparisonBuilds: { buildId: string; buildName: string }[];
  locale: Locale;
  ba: (k: keyof Dict) => string;
  fillBa: (s: string, vars: Record<string, string>) => string;
  panelId: string;
}) {
  const {
    presetSearchQuery,
    onPresetSearchQueryChange,
    presetCategoryFilter,
    onPresetCategoryFilterChange,
    draftMainPresetId,
    draftSubPresetIds,
    onSelectMainPreset,
    onToggleSubPreset,
    draftIntent,
    onDraftIntentChange,
    onResetPresetDefaults,
    onDiscardManualEdits,
    conflicts,
    onResolveConflictUsePreset,
    onResolveConflictUseManual,
    confirmedMainPresetId,
    confirmedSubPresetIds,
    presetStatus,
    onConfirmPresetIntent,
    onRevertToConfirmedPreset,
    onReturnToGeneralAnalysis,
    justCarriedOverFromSiblingBuild,
  } = presetIntent;

  const bd = (code: string) => ba(code as keyof Dict);
  const resolveText = (key: string) => bd(key);

  // 目的確定後は目的一覧(検索・おすすめ・カテゴリ・カード)を自動でコンパクト表示へ切り替える。
  // 「目的を変更」を押した場合だけ再展開する(選択作業の途中で勝手に閉じない)。
  const [isBrowsingRequested, setIsBrowsingRequested] = useState(false);
  const prevConfirmedKeyRef = useRef<string>("");
  useEffect(() => {
    const key = `${confirmedMainPresetId ?? ""}|${[...confirmedSubPresetIds].sort().join(",")}`;
    if (key !== prevConfirmedKeyRef.current) {
      prevConfirmedKeyRef.current = key;
      setIsBrowsingRequested(false);
    }
  }, [confirmedMainPresetId, confirmedSubPresetIds]);
  // 何も確定していない間は常に一覧を表示する。一度確定した後は、詳細設定の変更などで
  // presetStatus が "modified"/"conflicted" へ変わっても、ユーザーが明示的に「目的を変更」を
  // 押すまで一覧を再表示しない(選択作業と無関係な変更で勝手に一覧が開き直らないようにする)。
  const hasConfirmedPreset = confirmedMainPresetId != null || confirmedSubPresetIds.length > 0;
  const showBrowseUI = !hasConfirmedPreset || isBrowsingRequested;

  const searched = presetSearchQuery.trim().length > 0 ? searchPresets(presetSearchQuery, BUILD_INTENT_PRESETS, resolveText) : BUILD_INTENT_PRESETS;
  const categoryFiltered = presetCategoryFilter === "all" ? searched : searched.filter((p) => p.categoryId === presetCategoryFilter);
  const showRecommended = presetSearchQuery.trim().length === 0 && presetCategoryFilter === "all";

  const presetDerived = presetDerivedGroupPriorities(draftMainPresetId, draftSubPresetIds);
  const mainPreset = getPresetById(draftMainPresetId);
  const subPresets = draftSubPresetIds.map((id) => getPresetById(id)).filter((p): p is BuildIntentPreset => p != null);
  const confirmedMainPreset = getPresetById(confirmedMainPresetId);
  const confirmedSubPresets = confirmedSubPresetIds.map((id) => getPresetById(id)).filter((p): p is BuildIntentPreset => p != null);

  const updateDraftIntent = (partial: Partial<BuildIntentInput>) => {
    onDraftIntentChange(normalizeBuildIntent({ ...draftIntent, ...partial }).intent);
  };
  const setDraftGroupState = (groupId: string, state: GroupPriorityState) => {
    const next = { ...draftIntent.groupPriorities };
    if (state === "normal") delete next[groupId];
    else next[groupId] = state;
    const nextIgnored =
      state === "priority" || state === "secondary" ? draftIntent.intentionallyIgnoredGroups.filter((g) => g !== groupId) : draftIntent.intentionallyIgnoredGroups;
    const nextAvoid = state === "priority" ? draftIntent.avoidOverinvestmentGroups.filter((g) => g !== groupId) : draftIntent.avoidOverinvestmentGroups;
    updateDraftIntent({ groupPriorities: next, intentionallyIgnoredGroups: nextIgnored, avoidOverinvestmentGroups: nextAvoid });
  };
  const toggleDraftArray = (field: "avoidOverinvestmentGroups" | "intentionallyIgnoredGroups" | "strengthsToPreserve", groupId: string) => {
    const current = draftIntent[field];
    const turningOn = !current.includes(groupId);
    const next = turningOn ? [...current, groupId] : current.filter((g) => g !== groupId);
    if (field === "intentionallyIgnoredGroups" && turningOn) {
      const nextPriorities = { ...draftIntent.groupPriorities };
      if (nextPriorities[groupId] === "priority" || nextPriorities[groupId] === "secondary") delete nextPriorities[groupId];
      updateDraftIntent({ intentionallyIgnoredGroups: next, groupPriorities: nextPriorities });
      return;
    }
    if (field === "avoidOverinvestmentGroups" && turningOn && draftIntent.groupPriorities[groupId] === "priority") {
      const nextPriorities = { ...draftIntent.groupPriorities };
      delete nextPriorities[groupId];
      updateDraftIntent({ avoidOverinvestmentGroups: next, groupPriorities: nextPriorities });
      return;
    }
    updateDraftIntent({ [field]: next } as Partial<BuildIntentInput>);
  };

  const subMaxReached = draftSubPresetIds.length >= MAX_SUB_PRESETS;
  const hasConflicts = conflicts.length > 0;

  // --- 目的変更・詳細変更・選択解除の警告(自由文用stale警告とは別の、目的プリセット専用の警告) ---
  const mainOrSubChanged = draftMainPresetId !== confirmedMainPresetId || [...draftSubPresetIds].sort().join(",") !== [...confirmedSubPresetIds].sort().join(",");
  const deselected = draftMainPresetId === null && draftSubPresetIds.length === 0 && (confirmedMainPresetId !== null || confirmedSubPresetIds.length > 0);
  const detailOnlyChanged = !mainOrSubChanged && presetStatus === "modified";

  return (
    <div className="mt-3">
      {justCarriedOverFromSiblingBuild ? (
        <p className="mb-2 rounded border border-info/40 bg-info/10 px-2 py-1 text-2xs text-info">{ba("presetCarriedOverNotice")}</p>
      ) : null}

      {showBrowseUI ? (
        <>
          {/* 1. 目的検索 */}
          <label className="flex flex-col gap-1 text-2xs text-text-dim">
            {ba("presetSearchLabel")}
            <input
              type="search"
              value={presetSearchQuery}
              onChange={(e) => onPresetSearchQueryChange(e.target.value)}
              placeholder={ba("presetSearchPlaceholder")}
              className="rounded border border-border bg-surface px-2 py-1.5 text-xs"
            />
          </label>

          {/* 2. おすすめ目的 */}
          {showRecommended ? (
            <div className="mt-2">
              <p className="text-2xs font-semibold text-text-muted">{ba("presetRecommendedHeading")}</p>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {RECOMMENDED_PRESET_IDS.map((id) => getPresetById(id))
                  .filter((p): p is BuildIntentPreset => p != null)
                  .map((p) => (
                    <PresetCard
                      key={p.id}
                      preset={p}
                      locale={locale}
                      ba={ba}
                      isMain={draftMainPresetId === p.id}
                      isSub={draftSubPresetIds.includes(p.id)}
                      subDisabled={!draftSubPresetIds.includes(p.id) && (subMaxReached || draftMainPresetId === p.id)}
                      onSelectMain={() => onSelectMainPreset(p.id)}
                      onToggleSub={() => onToggleSubPreset(p.id)}
                    />
                  ))}
              </div>
            </div>
          ) : null}

          {/* 3. カテゴリタブ */}
          <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label={ba("presetCategoryFilterLabel")}>
            <button type="button" role="tab" aria-selected={presetCategoryFilter === "all"} onClick={() => onPresetCategoryFilterChange("all")} className={categoryTabClassName(presetCategoryFilter === "all")}>
              {ba("presetCategoryAllLabel")}
            </button>
            {PRESET_CATEGORIES.map((c) => (
              <button
                key={c.categoryId}
                type="button"
                role="tab"
                aria-selected={presetCategoryFilter === c.categoryId}
                onClick={() => onPresetCategoryFilterChange(c.categoryId)}
                className={categoryTabClassName(presetCategoryFilter === c.categoryId)}
              >
                {bd(c.titleKey)}
              </button>
            ))}
          </div>

          {/* 4. 目的カード一覧 */}
          <div className="mt-2">
            {categoryFiltered.length === 0 ? (
              <p className="text-2xs text-text-muted">{ba("presetSearchNoResults")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categoryFiltered.map((p) => (
                  <PresetCard
                    key={p.id}
                    preset={p}
                    locale={locale}
                    ba={ba}
                    isMain={draftMainPresetId === p.id}
                    isSub={draftSubPresetIds.includes(p.id)}
                    subDisabled={!draftSubPresetIds.includes(p.id) && (subMaxReached || draftMainPresetId === p.id)}
                    onSelectMain={() => onSelectMainPreset(p.id)}
                    onToggleSub={() => onToggleSubPreset(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
          {subMaxReached ? (
            <p className="mt-1 text-2xs text-warning" aria-live="polite">
              {ba("presetSubMaxReachedNotice")}
            </p>
          ) : null}
        </>
      ) : (
        // 目的確定後のコンパクト表示(検索・カテゴリ・45件のカードは「目的を変更」を押すまで再表示しない)。
        <div className="rounded border border-border/60 p-2">
          <p className="text-2xs text-text-muted">{ba("presetConfirmedMainLabel")}</p>
          <p className="text-xs font-semibold text-text">{confirmedMainPreset ? bd(confirmedMainPreset.titleKey) : ba("presetPreviewNoneSelectedText")}</p>
          <p className="mt-1 text-2xs text-text-muted">{ba("presetConfirmedSubLabel")}</p>
          <p className="text-xs font-semibold text-text">
            {confirmedSubPresets.length > 0 ? confirmedSubPresets.map((p) => bd(p.titleKey)).join(locale === "ja" ? "・" : ", ") : ba("presetPreviewNoneSelectedText")}
          </p>
          <button
            type="button"
            onClick={() => setIsBrowsingRequested(true)}
            className="mt-2 min-h-[28px] rounded border border-border px-2 text-2xs text-text-dim hover:border-accent"
          >
            {ba("presetChangeIntentButtonLabel")}
          </button>
        </div>
      )}

      {/* 5-6. 選択中のメイン・サブ目的 */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded border border-border/60 p-1.5">
          <p className="text-2xs text-text-muted">{ba("presetPreviewMainLabel")}</p>
          <p className="mt-0.5 text-xs font-semibold text-text">{mainPreset ? bd(mainPreset.titleKey) : ba("presetPreviewNoneSelectedText")}</p>
        </div>
        <div className="rounded border border-border/60 p-1.5">
          <p className="text-2xs text-text-muted">{ba("presetPreviewSubLabel")}</p>
          <p className="mt-0.5 text-xs font-semibold text-text">
            {subPresets.length > 0 ? subPresets.map((p) => bd(p.titleKey)).join(locale === "ja" ? "・" : ", ") : ba("presetPreviewNoneSelectedText")}
          </p>
        </div>
      </div>

      {/* 7. 設定プレビュー(設定済みの項目を優先表示し、未指定を大量に並べない) */}
      <div className="mt-3 rounded-md border border-accent/40 bg-accent-soft/40 p-2">
        <SectionHeading>{ba("presetPreviewHeading")}</SectionHeading>
        <p className="mt-1 text-2xs font-semibold text-text-muted">{ba("presetPreviewDerivedHeading")}</p>
        <dl className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {draftIntent.primaryGoal !== "unspecified" ? (
            <PresetPreviewRow label={ba("buildIntentInterpGoalLabel")} value={ba(INTENT_GOAL_KEY[draftIntent.primaryGoal])} ba={ba} />
          ) : null}
          {PROGRESSION_GROUPS.filter((g) => (draftIntent.groupPriorities[g.groupId] ?? "normal") !== "normal").map((g) => {
            const state = draftIntent.groupPriorities[g.groupId] ?? "normal";
            const source = classifyGroupPrioritySource(g.groupId, state, presetDerived);
            const sourceLabel = source === "preset" ? ba("presetSourcePresetLabel") : source === "user" ? ba("presetSourceUserLabel") : undefined;
            return <PresetPreviewRow key={g.groupId} label={groupDisplayName(g.groupId, locale)} value={ba(GROUP_STATE_KEY[state])} sourceLabel={sourceLabel} ba={ba} />;
          })}
          {draftIntent.intendedPositions.length > 0 ? (
            <PresetPreviewRow label={ba("buildIntentInterpPositionLabel")} value={draftIntent.intendedPositions.join(" / ")} ba={ba} />
          ) : null}
          {draftIntent.comparisonTargetBuildId ? (
            <PresetPreviewRow
              label={ba("buildIntentInterpComparisonTargetLabel")}
              value={availableComparisonBuilds.find((b) => b.buildId === draftIntent.comparisonTargetBuildId)?.buildName ?? ""}
              ba={ba}
            />
          ) : null}
          {draftIntent.strengthsToPreserve.length > 0 ? (
            <PresetPreviewRow label={ba("buildIntentInterpPreserveLabel")} value={joinCategories(draftIntent.strengthsToPreserve, locale)} ba={ba} />
          ) : null}
        </dl>
        {draftIntent.primaryGoal === "unspecified" && Object.keys(draftIntent.groupPriorities).length === 0 && draftIntent.intendedPositions.length === 0 ? (
          <p className="mt-1 text-2xs text-text-muted">{ba("presetPreviewNoneSelectedText")}</p>
        ) : null}
      </div>

      {/* 8. 詳細設定(既存の4段階優先度UIを再利用してドラフトを調整する) */}
      <details className="mt-3">
        <summary className="cursor-pointer text-2xs font-semibold text-accent">{ba("presetDetailSettingsToggleLabel")}</summary>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-2xs text-text-dim">
            {ba("intentPositionLabel")}
            <select
              value={draftIntent.intendedPositions[0] ?? ""}
              onChange={(e) => updateDraftIntent({ intendedPositions: e.target.value ? [e.target.value] : [] })}
              className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
            >
              <option value="">{ba("intentPositionNoneOption")}</option>
              {availablePositions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-2xs text-text-dim">
            {ba("intentPrimaryGoalLabel")}
            <select
              value={draftIntent.primaryGoal}
              onChange={(e) => updateDraftIntent({ primaryGoal: e.target.value as PrimaryGoalId })}
              className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
            >
              {PRIMARY_GOAL_IDS.map((g) => (
                <option key={g} value={g}>
                  {ba(INTENT_GOAL_KEY[g])}
                </option>
              ))}
            </select>
          </label>
        </div>
        {availableComparisonBuilds.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-2xs text-text-dim">
              {ba("buildIntentComparisonTargetLabel")}
              <select
                value={draftIntent.comparisonTargetBuildId ?? ""}
                onChange={(e) => updateDraftIntent({ comparisonTargetBuildId: e.target.value || null })}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs"
              >
                <option value="">{ba("buildIntentComparisonTargetNoneOption")}</option>
                {availableComparisonBuilds.map((b) => (
                  <option key={b.buildId} value={b.buildId}>
                    {b.buildName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="mt-3">
          <SectionHeading>{ba("intentGroupPrioritiesHeading")}</SectionHeading>
          <p className="mt-1 text-2xs font-semibold text-text-muted">{ba("intentFieldPlayersHeading")}</p>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRESSION_GROUPS.filter((g) => !g.isGoalkeeping).map((g) => (
              <GroupPriorityCard
                key={g.groupId}
                name={`${panelId}-preset-priority-${g.groupId}`}
                label={groupDisplayName(g.groupId, locale)}
                state={draftIntent.groupPriorities[g.groupId] ?? "normal"}
                onChange={(next) => setDraftGroupState(g.groupId, next)}
                avoidOverinvestment={draftIntent.avoidOverinvestmentGroups.includes(g.groupId)}
                onToggleAvoidOverinvestment={() => toggleDraftArray("avoidOverinvestmentGroups", g.groupId)}
                intentionallyIgnored={draftIntent.intentionallyIgnoredGroups.includes(g.groupId)}
                onToggleIntentionallyIgnored={() => toggleDraftArray("intentionallyIgnoredGroups", g.groupId)}
                ba={ba}
              />
            ))}
          </div>
          <p className="mt-2 text-2xs font-semibold text-text-muted">{ba("intentGoalkeepingHeading")}</p>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRESSION_GROUPS.filter((g) => g.isGoalkeeping).map((g) => (
              <GroupPriorityCard
                key={g.groupId}
                name={`${panelId}-preset-priority-${g.groupId}`}
                label={groupDisplayName(g.groupId, locale)}
                state={draftIntent.groupPriorities[g.groupId] ?? "normal"}
                onChange={(next) => setDraftGroupState(g.groupId, next)}
                avoidOverinvestment={draftIntent.avoidOverinvestmentGroups.includes(g.groupId)}
                onToggleAvoidOverinvestment={() => toggleDraftArray("avoidOverinvestmentGroups", g.groupId)}
                intentionallyIgnored={draftIntent.intentionallyIgnoredGroups.includes(g.groupId)}
                onToggleIntentionallyIgnored={() => toggleDraftArray("intentionallyIgnoredGroups", g.groupId)}
                ba={ba}
              />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xs font-semibold text-text-muted">{ba("buildIntentStrengthsToPreserveLabel")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {PROGRESSION_GROUPS.map((g) => {
              const checked = draftIntent.strengthsToPreserve.includes(g.groupId);
              return (
                <label
                  key={g.groupId}
                  className={`flex min-h-[28px] cursor-pointer items-center gap-1 rounded border px-1.5 text-2xs ${checked ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"}`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleDraftArray("strengthsToPreserve", g.groupId)} className="sr-only" />
                  {checked ? <Icon name="check" size={10} /> : null}
                  {groupDisplayName(g.groupId, locale)}
                </label>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={onResetPresetDefaults} className="min-h-[28px] rounded border border-border px-2 text-2xs text-text-dim hover:border-accent">
            {ba("presetResetToPresetDefaultsLabel")}
          </button>
          <button type="button" onClick={onDiscardManualEdits} className="min-h-[28px] rounded border border-border px-2 text-2xs text-text-dim hover:border-accent">
            {ba("presetDiscardManualEditsLabel")}
          </button>
        </div>
      </details>

      {/* 競合(選択した目的と詳細設定が逆方向。自動解消しない) */}
      {hasConflicts ? (
        <div role="alert" className="mt-3 rounded-md border border-danger/50 bg-danger/10 p-2">
          <p className="text-2xs font-semibold text-danger">{ba("presetConflictHeading")}</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {conflicts.map((c) => (
              <li key={c.groupId} className="rounded border border-border/60 bg-surface p-1.5 text-2xs">
                <p>
                  {ba("presetConflictTargetLabel")}: {groupDisplayName(c.groupId, locale)}
                </p>
                <p className="text-text-dim">
                  {ba("presetConflictMainGoalLabel")}: {ba(GROUP_STATE_KEY[c.presetState])} / {ba("presetConflictManualSettingLabel")}:{" "}
                  {c.manualIgnored ? ba("buildIntentIntentionallyIgnoreLabel") : ba(GROUP_STATE_KEY[c.manualState])}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onResolveConflictUsePreset(c.groupId)}
                    className="min-h-[26px] rounded border border-border px-1.5 text-2xs hover:border-accent"
                  >
                    {ba("presetConflictUsePresetLabel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveConflictUseManual(c.groupId)}
                    className="min-h-[26px] rounded border border-border px-1.5 text-2xs hover:border-accent"
                  >
                    {ba("presetConflictUseManualLabel")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-2xs text-danger">{ba("presetConflictBlocksConfirmNotice")}</p>
        </div>
      ) : null}

      {/* 9. この目的で分析 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirmPresetIntent}
          disabled={hasConflicts}
          className="min-h-[32px] rounded-md border border-accent bg-accent px-2.5 text-2xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ba("presetConfirmButtonLabel")}
        </button>
        {confirmedMainPreset || confirmedSubPresets.length > 0 ? (
          <button type="button" onClick={onReturnToGeneralAnalysis} className="min-h-[32px] rounded-md border border-border px-2.5 text-2xs text-text-dim hover:border-accent">
            {ba("presetReturnToGeneralAnalysisLabel")}
          </button>
        ) : null}
      </div>

      {/* 目的変更/詳細変更/選択解除の警告(自由文用stale警告とは別の専用警告) */}
      {deselected ? (
        <div className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-2xs text-warning">
          <p>{ba("presetDeselectedNotice")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button type="button" onClick={onReturnToGeneralAnalysis} className="min-h-[26px] rounded border border-border px-1.5 text-2xs hover:border-accent">
              {ba("presetReturnToGeneralAnalysisLabel")}
            </button>
            <button type="button" onClick={onRevertToConfirmedPreset} className="min-h-[26px] rounded border border-border px-1.5 text-2xs hover:border-accent">
              {ba("presetKeepPreviousSelectionLabel")}
            </button>
          </div>
        </div>
      ) : mainOrSubChanged ? (
        <div className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-2xs text-warning">
          <p>{ba("presetChangedNotConfirmedNotice")}</p>
          <p className="mt-1">
            {ba("presetChangedCurrentSelectionLabel")}: {mainPreset ? bd(mainPreset.titleKey) : ba("presetPreviewNoneSelectedText")}
          </p>
          <p>
            {ba("presetChangedInUseLabel")}: {confirmedMainPreset ? bd(confirmedMainPreset.titleKey) : ba("presetPreviewNoneSelectedText")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button type="button" onClick={onConfirmPresetIntent} disabled={hasConflicts} className="min-h-[26px] rounded border border-border px-1.5 text-2xs hover:border-accent disabled:cursor-not-allowed disabled:opacity-50">
              {ba("presetAnalyzeWithNewLabel")}
            </button>
            <button type="button" onClick={onRevertToConfirmedPreset} className="min-h-[26px] rounded border border-border px-1.5 text-2xs hover:border-accent">
              {ba("presetRevertToPreviousLabel")}
            </button>
          </div>
        </div>
      ) : detailOnlyChanged ? (
        <div className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-2xs text-warning">
          <p>{ba("presetDetailChangedNotice")}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button type="button" onClick={onConfirmPresetIntent} disabled={hasConflicts} className="min-h-[26px] rounded border border-border px-1.5 text-2xs hover:border-accent disabled:cursor-not-allowed disabled:opacity-50">
              {ba("presetAnalyzeWithChangedSettingsLabel")}
            </button>
            <button type="button" onClick={onRevertToConfirmedPreset} className="min-h-[26px] rounded border border-border px-1.5 text-2xs hover:border-accent">
              {ba("presetRevertDetailChangesLabel")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** AI解釈結果の1行表示(専用の分かりやすい「未指定」表現に統一する)。 */
/**
 * 「読み取れた内容」/「確認してほしい内容」/「読み取れなかった内容」の3区分表示。
 * - 内部プレフィックス(旧 unanalyzed:)・テンプレートID・グループIDなどの内部識別子は一切表示しない
 *   (labelCode/descriptionCode/questionCode/reasonCode は ba() で ja/en の自然文へ変換してから表示する)。
 * - 候補確認(clarifications)を選択しても、ここでは何も確定しない(「この内容で分析」を押すまで反映しない)。
 * - 何も読み取れず候補確認もない場合は、大きな見出しで「入力内容を十分に整理できませんでした」を表示する
 *   (未指定の項目を大量に並べない)。
 */
function BuildIntentExtractionResultView({
  pendingExtraction,
  locale,
  ba,
  availableComparisonBuilds,
  clarificationSelections,
  onSelectClarificationOption,
  onConfirmExtraction,
  onRequestExtraction,
  onDiscardExtraction,
  onInsertExampleText,
}: {
  pendingExtraction: BuildIntentExtraction;
  locale: Locale;
  ba: (k: keyof Dict) => string;
  availableComparisonBuilds: { buildId: string; buildName: string }[];
  clarificationSelections: Record<string, string>;
  onSelectClarificationOption: (clarificationId: string, optionId: string) => void;
  onConfirmExtraction: () => void;
  onRequestExtraction: () => void;
  onDiscardExtraction: () => void;
  onInsertExampleText: (example: string) => void;
}) {
  // ba() は buildAnalysis 辞書のキーだけを受け取るが、labelCode 等は文字列として保持されているため、
  // ここでの変換対象は事前に用意した固定コード(このファイル内のテンプレート・辞書だけに由来)に限られる。
  const bd = (code: string): string => ba(code as keyof Dict);

  const rows: { key: string; label: string; value: string }[] = [
    { key: "position", label: ba("buildIntentInterpPositionLabel"), value: pendingExtraction.intendedPositions.join(" / ") },
    {
      key: "goal",
      label: ba("buildIntentInterpGoalLabel"),
      value: pendingExtraction.primaryGoal === "unspecified" ? "" : ba(INTENT_GOAL_KEY[pendingExtraction.primaryGoal]),
    },
    { key: "priority", label: ba("buildIntentInterpPriorityLabel"), value: joinCategories(pendingExtraction.priorityGroups, locale) },
    { key: "secondary", label: ba("buildIntentInterpSecondaryLabel"), value: joinCategories(pendingExtraction.secondaryGroups, locale) },
    {
      key: "avoid",
      label: ba("buildIntentInterpAvoidOverinvestmentLabel"),
      value: joinCategories(pendingExtraction.avoidOverinvestmentGroups, locale),
    },
    {
      key: "ignored",
      label: ba("buildIntentInterpIgnoredLabel"),
      value: joinCategories(pendingExtraction.intentionallyIgnoredGroups, locale),
    },
    {
      key: "comparisonTarget",
      label: ba("buildIntentInterpComparisonTargetLabel"),
      value: pendingExtraction.comparisonTargetBuildId
        ? (availableComparisonBuilds.find((b) => b.buildId === pendingExtraction.comparisonTargetBuildId)?.buildName ?? "")
        : "",
    },
    {
      key: "comparisonFocus",
      label: ba("buildIntentInterpComparisonFocusLabel"),
      value: joinCategories(pendingExtraction.comparisonFocusGroups, locale),
    },
    { key: "preserve", label: ba("buildIntentInterpPreserveLabel"), value: joinCategories(pendingExtraction.strengthsToPreserve, locale) },
  ];
  const filledRows = rows.filter((r) => r.value !== "");
  const emptyRows = rows.filter((r) => r.value === "");
  const hasClarifications = pendingExtraction.clarifications.length > 0;
  const hasUnanalyzed = pendingExtraction.unanalyzedSegments.length > 0;
  const isFullyUnanalyzable = filledRows.length === 0 && !hasClarifications;
  const allClarificationsAnswered = pendingExtraction.clarifications.every((c) => Boolean(clarificationSelections[c.id]));

  const examples: { label: string; text: string }[] = [
    { label: ba("buildIntentAdditionalExampleCrossSupplyLabel"), text: ba("buildIntentAdditionalExampleCrossSupplyText") },
    { label: ba("buildIntentAdditionalExampleCrossReceiveLabel"), text: ba("buildIntentAdditionalExampleCrossReceiveText") },
    { label: ba("buildIntentAdditionalExampleCrossAmbiguousLabel"), text: ba("buildIntentAdditionalExampleCrossAmbiguousText") },
  ];

  return (
    <div className="mt-3 rounded-md border border-accent/40 bg-accent-soft/40 p-2">
      {isFullyUnanalyzable ? (
        <div>
          <p className="text-sm font-bold text-text">{ba("buildIntentUnanalyzedZeroHeading")}</p>
          <p className="mt-1 text-2xs text-text-dim">{ba("buildIntentUnanalyzedZeroBody")}</p>
          {hasUnanalyzed ? (
            <ul className="mt-1.5 list-disc pl-4 text-2xs text-text-dim">
              {pendingExtraction.unanalyzedSegments.map((s, i) => (
                <li key={i} className="break-words">
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1.5 text-2xs text-text-muted">{ba("buildIntentManualSettingsHintText")}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <SectionHeading>{ba("buildIntentReadHeading")}</SectionHeading>
            <span className="text-2xs text-text-muted">
              {ba("buildIntentConfidenceLabel")}: {ba(EXTRACTION_CONFIDENCE_KEY[pendingExtraction.confidence])}
            </span>
          </div>
          <dl className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {filledRows.map((r) => (
              <InterpretationRow key={r.key} label={r.label} value={r.value} ba={ba} />
            ))}
          </dl>
          {emptyRows.length > 0 ? (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-2xs text-text-muted">{ba("buildIntentUnspecifiedCollapsedLabel")}</summary>
              <dl className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {emptyRows.map((r) => (
                  <InterpretationRow key={r.key} label={r.label} value={r.value} ba={ba} />
                ))}
              </dl>
            </details>
          ) : null}
        </>
      )}

      {hasClarifications ? (
        <div className="mt-3" aria-live="polite">
          <SectionHeading>{ba("buildIntentClarificationHeading")}</SectionHeading>
          <div className="mt-1.5 flex flex-col gap-2">
            {pendingExtraction.clarifications.map((c) => (
              <ClarificationFieldset
                key={c.id}
                clarification={c}
                selectedOptionId={clarificationSelections[c.id]}
                onSelect={(optionId) => onSelectClarificationOption(c.id, optionId)}
                bd={bd}
              />
            ))}
          </div>
          {!allClarificationsAnswered ? <p className="mt-1.5 text-2xs text-warning">{ba("buildIntentClarificationPendingNotice")}</p> : null}
        </div>
      ) : null}

      {hasUnanalyzed && !isFullyUnanalyzable ? (
        <div className="mt-3">
          <SectionHeading>{ba("buildIntentUnanalyzedHeading")}</SectionHeading>
          <p className="mt-1 text-2xs text-text-dim">{ba("buildIntentUnanalyzedIntro")}</p>
          <ul className="mt-1 list-disc pl-4 text-2xs text-text-dim">
            {pendingExtraction.unanalyzedSegments.map((s, i) => (
              <li key={i} className="break-words">
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2">
        <p className="text-2xs font-semibold text-text-dim">{ba("buildIntentAmbiguitiesHeading")}</p>
        {pendingExtraction.ambiguities.length > 0 ? (
          <ul className="mt-0.5 list-disc pl-4 text-2xs text-text-dim">
            {pendingExtraction.ambiguities.map((a, i) => (
              <li key={i} className="break-words">
                {a}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-0.5 text-2xs text-text-muted">{ba("buildIntentAmbiguitiesNoneText")}</p>
        )}
      </div>

      {isFullyUnanalyzable || hasClarifications ? (
        <div className="mt-3">
          <p className="text-2xs font-semibold text-text-dim">{ba("buildIntentAdditionalExamplesHeading")}</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {examples.map((ex) => (
              <li key={ex.label} className="rounded border border-border/60 p-1.5">
                <p className="text-2xs text-text-muted">{ex.label}</p>
                <p className="mt-0.5 break-words text-2xs text-text">{ex.text}</p>
                <button
                  type="button"
                  onClick={() => onInsertExampleText(ex.text)}
                  className="mt-1 min-h-[28px] rounded border border-border px-2 text-2xs text-text-dim hover:border-accent"
                >
                  {ba("buildIntentAdditionalExampleInsertLabel")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirmExtraction}
          disabled={!allClarificationsAnswered}
          className="min-h-[32px] rounded-md border border-accent bg-accent px-2.5 text-2xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ba("buildIntentConfirmButtonLabel")}
        </button>
        <button
          type="button"
          onClick={onRequestExtraction}
          className="min-h-[32px] rounded-md border border-border px-2.5 text-2xs text-text-dim hover:border-accent"
        >
          {ba("buildIntentRetryLabel")}
        </button>
        <button
          type="button"
          onClick={onDiscardExtraction}
          className="min-h-[32px] rounded-md border border-border px-2.5 text-2xs text-text-dim hover:border-accent"
        >
          {ba("buildIntentDiscardLabel")}
        </button>
      </div>
    </div>
  );
}

/** 候補確認1件分(radio排他・「どれにも当てはまらない」を必ず含む・内部IDは表示しない)。 */
function ClarificationFieldset({
  clarification,
  selectedOptionId,
  onSelect,
  bd,
}: {
  clarification: BuildIntentClarification;
  selectedOptionId: string | undefined;
  onSelect: (optionId: string) => void;
  bd: (code: string) => string;
}) {
  return (
    <fieldset className="rounded border border-border/60 p-1.5">
      <legend className="px-0.5 text-2xs font-semibold text-text">{bd(clarification.questionCode)}</legend>
      <p className="text-2xs text-text-muted">{bd(clarification.reasonCode)}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {clarification.options.map((o) => (
          <label
            key={o.id}
            className="flex min-h-[32px] cursor-pointer items-start gap-1.5 rounded border border-border/40 p-1.5 hover:border-accent"
          >
            <input
              type="radio"
              name={`clarification-${clarification.id}`}
              value={o.id}
              checked={selectedOptionId === o.id}
              onChange={() => onSelect(o.id)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="break-words text-2xs font-semibold text-text">{bd(o.labelCode)}</span>
              <span className="break-words text-2xs text-text-muted">{bd(o.descriptionCode)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InterpretationRow({ label, value, ba }: { label: string; value: string; ba: (k: keyof Dict) => string }) {
  return (
    <div className="rounded border border-border/60 p-1.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-text" title={value || undefined}>
        {value || ba("buildIntentInterpNoneValue")}
      </dd>
    </div>
  );
}

/** 「入力内容の反映状況」の1行(実際の分析ロジックの扱いと必ず一致させる)。 */
function ReflectionStatusRow({
  entry,
  intent,
  ba,
  locale,
  availableComparisonBuilds,
}: {
  entry: { field: IntentFieldKey; status: IntentFieldStatus; count: number };
  intent: BuildIntentInput;
  ba: (k: keyof Dict) => string;
  locale: Locale;
  availableComparisonBuilds: { buildId: string; buildName: string }[];
}) {
  const valueText = (() => {
    switch (entry.field) {
      case "primaryGoal":
        return intent.primaryGoal === "unspecified" ? "" : ba(INTENT_GOAL_KEY[intent.primaryGoal]);
      case "position":
        return intent.intendedPositions.join(" / ");
      case "priorityGroups": {
        const ids = PROGRESSION_GROUPS.filter((g) => intent.groupPriorities[g.groupId] === "priority").map((g) => groupDisplayName(g.groupId, locale));
        return ids.join(" / ");
      }
      case "secondaryPriorityGroups": {
        const ids = PROGRESSION_GROUPS.filter((g) => intent.groupPriorities[g.groupId] === "secondary").map((g) => groupDisplayName(g.groupId, locale));
        return ids.join(" / ");
      }
      case "lowerPriorityGroups": {
        // 「今回は評価対象外」にも指定されている領域は、低優先一覧へ重複表示しない(評価対象外を優先する)。
        const ids = PROGRESSION_GROUPS.filter((g) => intent.groupPriorities[g.groupId] === "low" && !intent.intentionallyIgnoredGroups.includes(g.groupId)).map((g) =>
          groupDisplayName(g.groupId, locale),
        );
        return ids.join(" / ");
      }
      case "avoidOverinvestmentGroups":
        return joinCategories(intent.avoidOverinvestmentGroups, locale);
      case "intentionallyIgnoredGroups":
        return joinCategories(intent.intentionallyIgnoredGroups, locale);
      case "comparisonTarget":
        return intent.comparisonTargetBuildId
          ? (availableComparisonBuilds.find((b) => b.buildId === intent.comparisonTargetBuildId)?.buildName ?? "")
          : "";
      case "freeText":
        return intent.freeText.trim();
      case "strengthsToPreserve":
        return joinCategories(intent.strengthsToPreserve, locale);
      default:
        return "";
    }
  })();
  return (
    <div className="rounded border border-border/60 p-2">
      <dt className="font-semibold text-text-dim">{ba(REFLECTION_FIELD_KEY[entry.field])}</dt>
      <dd className="mt-0.5 truncate text-text" title={valueText || undefined}>
        {valueText || ba("intentNoneText")}
      </dd>
      <dd className="mt-1">
        <Badge tone={entry.status === "used" ? "accent" : entry.status === "limited-by-data" ? "warning" : "neutral"} size="xs">
          {ba(REFLECTION_STATUS_KEY[entry.status])}
        </Badge>
      </dd>
    </div>
  );
}
