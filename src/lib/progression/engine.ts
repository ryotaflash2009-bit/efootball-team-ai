import { PROGRESSION_RULES_VERSION, STAT_CAPS } from "./constants";
import { getRuleset, isLegacyRulesVersion } from "./progression-rules";
import {
  normalizeGroupAllocation,
  summarizeGroupPoints,
  groupBreakdowns,
} from "./group-allocation";
import { statAllocationToGroupLevels, detectAllocationUnit } from "./migrate-build";
import { calculateProgressionDeltas } from "./calculate-progression";
import { calculatePlayerBooster } from "./calculate-player-booster";
import { CONDITIONAL_BOOSTER_RULES_VERSION } from "./conditional-boosters";
import { type BoosterApplicationMode } from "./booster-resolution";
import { calculateManagerBooster } from "./calculate-manager-booster";
import { calculateFinalStats } from "./calculate-final-stats";
import { calculateRating } from "./calculate-rating";
import { getProgressionEligibility } from "./card-eligibility";
import { RULE_REGISTRY } from "./rule-registry";
import type { CalculationMode, ProgressionInput, ProgressionResult } from "./types";

function rulesText(status: "confirmed" | "provisional" | "unresolved"): string[] {
  return RULE_REGISTRY.filter((r) => r.confirmationStatus === status).map(
    (r) => `${r.ruleName}: ${r.description}`,
  );
}

const UNSUPPORTED_RULES = [
  "公式のOVR計算式・ポジション別OVRの正確な重み",
  "Max Level Stats（最大レベル時の各能力値）の内訳",
  "グループ配分1段階あたりの能力別の正確な上昇量（重み付き/上限）",
  "段階コストの9段階/13段階以降の正確な値（外挿・confirmed ではない）",
  "育成・選手ブースター・監督補正を含む最終能力値の上限（暫定で99にクランプ）",
];

/** 育成計算のトップレベル（v2）。純関数。 */
export function calculateBuild(input: ProgressionInput): ProgressionResult {
  const { card } = input;
  const inputRulesVersion = input.rulesetId ?? PROGRESSION_RULES_VERSION;
  const ruleset = getRuleset(PROGRESSION_RULES_VERSION);
  const eligibility = getProgressionEligibility(card);

  // v1 形式（per-stat）が来たら v2（per-group）へ移行
  const unit = detectAllocationUnit(input.allocation ?? {});
  const rawGroupAlloc =
    unit === "stat" ? statAllocationToGroupLevels(input.allocation) : input.allocation ?? {};

  const { allocation, rejected } = normalizeGroupAllocation(rawGroupAlloc, card);
  // 育成不可カードは配分を無視
  const effectiveAllocation = eligibility.canProgress ? allocation : {};

  const points = summarizeGroupPoints(effectiveAllocation, card, PROGRESSION_RULES_VERSION);
  const groups = groupBreakdowns(effectiveAllocation, card, PROGRESSION_RULES_VERSION);

  const boosterMode: BoosterApplicationMode =
    input.boosterApplicationMode ??
    ((input.experimentalModeEnabled ?? input.applyProvisionalBoosters) ? "experimental" : "standard");

  const progressionDeltas = calculateProgressionDeltas(card, effectiveAllocation);
  const playerBooster = calculatePlayerBooster(
    card,
    input.selectedPlayerBoosters ?? [],
    boosterMode,
    input.selectedConditionalBoosters ?? [],
  );
  const managerBooster = calculateManagerBooster(card, input.manager ?? null);

  const finalStats = calculateFinalStats({
    card,
    mode: boosterMode,
    progressionDeltas,
    gameMeasuredDeltas: playerBooster.gameMeasuredDeltas,
    externalVerifiedDeltas: playerBooster.externalVerifiedDeltas,
    conditionalDeltas: playerBooster.conditionalUserDeltas,
    manualTrialDeltas: playerBooster.manualTrialDeltas,
    confirmedB2Deltas: playerBooster.confirmedB2Deltas,
    experimentalExtraDeltas: playerBooster.experimentalExtraDeltas,
    managerBoosterDeltas: managerBooster.deltas,
  });
  const stats = finalStats.stats;

  const rating = calculateRating({
    stats,
    position: card.registeredPosition,
    storedOvrBase: card.ovrBase,
    storedOvrMax: card.ovrMax,
  });

  const anyProgression = Object.keys(progressionDeltas).length > 0;
  const calculationMode: CalculationMode = anyProgression ? "provisional" : "confirmed";
  const isLegacyInput = unit === "stat" || isLegacyRulesVersion(input.rulesetId ?? null);

  const warnings: string[] = [];
  for (const r of rejected) warnings.push(`配分の補正: ${r}`);
  if (!eligibility.canProgress && eligibility.reason) warnings.push(eligibility.reason);
  if (points.overAllocated) warnings.push(`育成ポイントの使いすぎ: ${points.usedPoints} / ${points.totalPoints}`);
  if (isLegacyInput) warnings.push("このビルドは旧規則で作成されています。現行規則で再計算すると配分の解釈が変わります。");
  if (playerBooster.boosters.length > 0) warnings.push(playerBooster.note);
  if (playerBooster.selection.applied.length > 0) warnings.push(playerBooster.selection.note);
  if (playerBooster.conditionalSelections.length > 0) {
    warnings.push(
      "Total Package の条件段階はユーザーが手動指定した試算値です（アプリが Game Plan の対象リーグ人数を自動検証した値ではありません）。標準最終値・比較の順位・チーム集計には含めていません。",
    );
  }
  if (managerBooster.applied) warnings.push(managerBooster.note);
  if (finalStats.finalCapApplied) {
    warnings.push(
      "一部の能力値が99上限に達しています（超過分は無効）。ただし育成・ブースター・監督補正込みの最終上限が99である確証はまだありません（暫定処理）。",
    );
  }

  return {
    rulesVersion: PROGRESSION_RULES_VERSION,
    rulesetId: ruleset.id,
    inputRulesVersion,
    isLegacyInput,
    eligibility: {
      canProgress: eligibility.canProgress,
      reason: eligibility.reason,
      confirmationStatus: eligibility.confirmationStatus,
    },
    calculationMode,
    card: {
      worldCardId: card.worldCardId,
      nameEn: card.nameEn,
      nameJa: card.nameJa,
      registeredPosition: card.registeredPosition,
      cardType: card.cardType,
      ovrBase: card.ovrBase,
      ovrMax: card.ovrMax,
      maximumLevel: card.maximumLevel,
    },
    points,
    groups,
    stats,
    statCaps: {
      base: { value: STAT_CAPS.base.value, confidence: STAT_CAPS.base.confidence },
      progression: { value: STAT_CAPS.progression.value, confidence: STAT_CAPS.progression.confidence },
      playerBooster: { value: STAT_CAPS.playerBooster.value, confidence: STAT_CAPS.playerBooster.confidence },
      managerBooster: { value: STAT_CAPS.managerBooster.value, confidence: STAT_CAPS.managerBooster.confidence },
      final: { value: STAT_CAPS.final.value, confidence: STAT_CAPS.final.confidence },
    },
    finalCapApplied: finalStats.finalCapApplied,
    playerBoosters: playerBooster.boosters,
    playerBoosterSelection: playerBooster.selection,
    playerBoosterAttached: playerBooster.attached,
    playerBoosterByStat: Object.fromEntries(
      [...new Set([
        ...Object.keys(playerBooster.gameMeasuredDeltas),
        ...Object.keys(playerBooster.externalVerifiedDeltas),
        ...Object.keys(playerBooster.conditionalUserDeltas),
        ...Object.keys(playerBooster.manualTrialDeltas),
        ...Object.keys(playerBooster.confirmedB2Deltas),
        ...Object.keys(playerBooster.experimentalExtraDeltas),
      ])].map((k) => [
        k,
        {
          gameMeasured: playerBooster.gameMeasuredDeltas[k] ?? 0,
          externalVerified: playerBooster.externalVerifiedDeltas[k] ?? 0,
          conditional: playerBooster.conditionalUserDeltas[k] ?? 0,
          manualTrial: playerBooster.manualTrialDeltas[k] ?? 0,
          confirmedB2: playerBooster.confirmedB2Deltas[k] ?? 0,
          experimentalExtra: playerBooster.experimentalExtraDeltas[k] ?? 0,
        },
      ]),
    ),
    booster: {
      applicationMode: boosterMode,
      appliedTotal: sumValues(playerBooster.appliedDeltas),
      gameMeasuredTotal: sumValues(playerBooster.gameMeasuredDeltas),
      externalVerifiedTotal: sumValues(playerBooster.externalVerifiedDeltas),
      experimentalExtraTotal: sumValues(playerBooster.experimentalExtraDeltas),
      conditionalTotal: sumValues(playerBooster.conditionalUserDeltas),
      confirmedB2Total: sumValues(playerBooster.confirmedB2Deltas),
      hasConfirmedB2: Object.keys(playerBooster.confirmedB2Deltas).length > 0,
      hasManualTrial: playerBooster.selection.applied.length > 0,
      hasProvisionalAttached:
        Object.keys(playerBooster.provisionalAttachedDeltas).length > 0,
      hasConditionalAttached:
        Object.keys(playerBooster.conditionalAttachedDeltas).length > 0,
      hasConditionalSelection: playerBooster.conditionalSelections.length > 0,
      hasExperimentalExtra:
        Object.keys(playerBooster.experimentalExtraDeltas).length > 0,
      conditionalSelections: playerBooster.conditionalSelections.map((c) => ({
        boosterKey: c.boosterKey,
        nameEn: c.nameEn,
        nameJa: c.nameJa,
        selection: c.selection,
        level: c.level,
        description: c.description,
      })),
      conditionalRulesVersion: CONDITIONAL_BOOSTER_RULES_VERSION,
      evidenceSummary: playerBooster.evidenceSummary,
      note:
        boosterMode === "strict"
          ? "厳密モード: ユーザー保存済みスクリーンショットで実測できた付属ブースターだけを通常の最終値へ適用しています。適用の基準は効果内容の証拠で、発動方式（固定型 / Power of Many）は問いません。"
          : "標準モード: 効果内容を外部データベース間で照合した高信頼値を含みます。KONAMI 公式の計算結果として確認された値ではありません。発動方式の証拠が不足するブースターは、Power of Many（条件型）である具体的証拠がないため固定型と推定して暫定適用しています（「外部照合済み・固定型推定を含む」）。",
      warnings:
        playerBooster.evidenceSummary.externalCrossVerified.length > 0 && boosterMode !== "strict"
          ? ["通常の最終値には外部2ソース照合済み（KONAMI 公式未確認）のブースター効果が含まれています。発動方式が固定型と推定されたもの（Power of Many である具体的証拠がないため暫定適用）を含みます。"]
          : [],
    },
    manager: {
      applied: managerBooster.applied,
      note: managerBooster.note,
      managerName: managerBooster.managerName,
      reasons: managerBooster.reasons,
    },
    rating,
    confirmedRules: rulesText("confirmed"),
    provisionalRules: rulesText("provisional"),
    unresolvedRules: [...rulesText("unresolved"), ...UNSUPPORTED_RULES],
    warnings,
  };
}

function sumValues(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + b, 0);
}

/** 空の配分（育成前の状態） */
export function emptyAllocation(): Record<string, number> {
  return {};
}
