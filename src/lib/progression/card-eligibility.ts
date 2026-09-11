import type { ProgressionCard } from "./types";
import { getRuleset } from "./progression-rules";

/**
 * 育成可否の判定。
 * confirmed: TRENDING（POTW 等）カード、または最大レベル1のカードは育成不可。
 *   根拠: pesmastery（"Trending — Able Level up: No"）+ SQLite 実測（TRENDING 3,502件すべて Lv1）。
 */
export interface ProgressionEligibility {
  canProgress: boolean;
  reason: string | null;
  totalPoints: number;
  confirmationStatus: "confirmed";
}

export function getProgressionEligibility(card: ProgressionCard): ProgressionEligibility {
  const ruleset = getRuleset();
  const cardType = (card.cardType ?? "").toUpperCase();
  const maxLevel = card.maximumLevel ?? 0;

  if (cardType === "TRENDING") {
    return { canProgress: false, reason: "TRENDING カード（POTW 等）は育成できません。", totalPoints: 0, confirmationStatus: "confirmed" };
  }
  if (maxLevel <= 1) {
    return { canProgress: false, reason: "最大レベルが1のため育成ポイントがありません。", totalPoints: 0, confirmationStatus: "confirmed" };
  }
  return { canProgress: true, reason: null, totalPoints: ruleset.totalPoints(maxLevel), confirmationStatus: "confirmed" };
}
