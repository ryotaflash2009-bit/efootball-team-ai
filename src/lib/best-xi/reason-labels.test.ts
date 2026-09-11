import { describe, it, expect } from "vitest";
import {
  EXCLUSION_REASON_LABEL_KEY,
  LIMITATION_LABEL_KEY,
  SELECTION_REASON_LABEL_KEY,
  UNAVAILABLE_CARD_LABEL_KEY,
  UNFILLED_SLOT_REASON_LABEL_KEY,
} from "./reason-labels";
import type {
  BestXiCandidateBuildStatus,
  BestXiExclusionReasonCode,
  BestXiLimitationCode,
  BestXiSelectionReasonCode,
} from "./types";

const SELECTION_CODES: BestXiSelectionReasonCode[] = [
  "exactPosition",
  "topPositionRating",
  "onlyEligibleCandidate",
  "bestBuildAmongOwnBuilds",
  "fullAbilityDataConfirmed",
  "noSavedBuildUsesBaseStats",
];
const EXCLUSION_CODES: BestXiExclusionReasonCode[] = [
  "sameCardBuildUsedElsewhere",
  "lowerPositionRating",
  "lowerSuitability",
  "abilityDataUnavailable",
  "usedInOtherRequiredSlot",
  "noAppropriateSlotInFormation",
  "legacyRulesLimitedComparison",
  "positionSuitabilityUnresolved",
];
const LIMITATION_CODES: BestXiLimitationCode[] = [
  "singleFormationOnly",
  "noBenchSelection",
  "noManagerSelection",
  "personIdentityUnavailable",
  "additionalPositionAptitudeLimited",
];
const UNAVAILABLE_CODES: BestXiCandidateBuildStatus[] = ["noWorldCardData", "noAbilityData"];

describe("reason-labels: 網羅性", () => {
  it("すべての選考理由コードに辞書キーが定義されている", () => {
    for (const code of SELECTION_CODES) {
      expect(SELECTION_REASON_LABEL_KEY[code]).toBeTruthy();
    }
  });
  it("すべての選外理由コードに辞書キーが定義されている", () => {
    for (const code of EXCLUSION_CODES) {
      expect(EXCLUSION_REASON_LABEL_KEY[code]).toBeTruthy();
    }
  });
  it("すべての制限事項コードに辞書キーが定義されている", () => {
    for (const code of LIMITATION_CODES) {
      expect(LIMITATION_LABEL_KEY[code]).toBeTruthy();
    }
  });
  it("すべての候補不可理由コードに辞書キーが定義されている", () => {
    for (const code of UNAVAILABLE_CODES) {
      expect(UNAVAILABLE_CARD_LABEL_KEY[code]).toBeTruthy();
    }
  });
  it("すべての空きスロット理由コードに辞書キーが定義されている", () => {
    expect(UNFILLED_SLOT_REASON_LABEL_KEY.noCandidate).toBeTruthy();
    expect(UNFILLED_SLOT_REASON_LABEL_KEY.onlyIneligibleCandidates).toBeTruthy();
  });
  it("キー名が重複していない(同じ辞書キーを別コードへ誤って割り当てていない)", () => {
    const all = [
      ...Object.values(SELECTION_REASON_LABEL_KEY),
      ...Object.values(EXCLUSION_REASON_LABEL_KEY),
      ...Object.values(LIMITATION_LABEL_KEY),
      ...Object.values(UNAVAILABLE_CARD_LABEL_KEY),
      ...Object.values(UNFILLED_SLOT_REASON_LABEL_KEY),
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});
