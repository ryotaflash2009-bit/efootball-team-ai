import type {
  BestXiCandidateBuildStatus,
  BestXiExclusionReasonCode,
  BestXiLimitationCode,
  BestXiSelectionReasonCode,
} from "./types";

/**
 * 内部の理由コード → `bestXi` 辞書キー名(文字列)への決定的な対応表。
 *
 * UI層はこのキー名を使って `t("bestXi", key)` を呼び出し、ja/enの自然文へ解決する。
 * 内部コードそのもの(exactPosition等)を画面へ直接表示しない。
 * どのコードも辞書キーが1件も欠けないことを Unit Test で確認する(audit:i18n-keys とは別に、
 * このマッピング自体の網羅性をテストする)。
 */
export const SELECTION_REASON_LABEL_KEY: Record<BestXiSelectionReasonCode, string> = {
  exactPosition: "reasonExactPosition",
  topPositionRating: "reasonTopPositionRating",
  onlyEligibleCandidate: "reasonOnlyEligibleCandidate",
  bestBuildAmongOwnBuilds: "reasonBestBuildAmongOwnBuilds",
  fullAbilityDataConfirmed: "reasonFullAbilityDataConfirmed",
  noSavedBuildUsesBaseStats: "reasonNoSavedBuildUsesBaseStats",
  intentPositionMatch: "reasonIntentPositionMatch",
  optimalOverallPlacement: "reasonOptimalOverallPlacement",
};

export const EXCLUSION_REASON_LABEL_KEY: Record<BestXiExclusionReasonCode, string> = {
  sameCardBuildUsedElsewhere: "exclusionSameCardBuildUsedElsewhere",
  lowerPositionRating: "exclusionLowerPositionRating",
  lowerSuitability: "exclusionLowerSuitability",
  abilityDataUnavailable: "exclusionAbilityDataUnavailable",
  usedInOtherRequiredSlot: "exclusionUsedInOtherRequiredSlot",
  noAppropriateSlotInFormation: "exclusionNoAppropriateSlotInFormation",
  legacyRulesLimitedComparison: "exclusionLegacyRulesLimitedComparison",
  positionSuitabilityUnresolved: "exclusionPositionSuitabilityUnresolved",
  gkFieldMismatch: "exclusionGkFieldMismatch",
};

export const LIMITATION_LABEL_KEY: Record<BestXiLimitationCode, string> = {
  singleFormationOnly: "limitationSingleFormationOnly",
  noBenchSelection: "limitationNoBenchSelection",
  noManagerSelection: "limitationNoManagerSelection",
  personIdentityUnavailable: "limitationPersonIdentityUnavailable",
  additionalPositionAptitudeLimited: "limitationAdditionalPositionAptitudeLimited",
  largeCandidatePoolBounded: "limitationLargeCandidatePoolBounded",
};

export const UNAVAILABLE_CARD_LABEL_KEY: Record<BestXiCandidateBuildStatus, string> = {
  noWorldCardData: "unavailableCardNoWorldCardData",
  noAbilityData: "unavailableCardNoAbilityData",
};

export const UNFILLED_SLOT_REASON_LABEL_KEY: Record<"noCandidate" | "onlyIneligibleCandidates", string> = {
  noCandidate: "unfilledSlotNoCandidate",
  onlyIneligibleCandidates: "unfilledSlotOnlyIneligibleCandidates",
};
