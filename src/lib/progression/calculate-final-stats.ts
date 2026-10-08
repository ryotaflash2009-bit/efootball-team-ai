import { WORLD_STAT_DEFS } from "@/lib/world/stats";
import { STAT_CAPS, STAT_FLOOR } from "./constants";
import type { BoosterApplicationMode } from "./booster-resolution";
import type { ProgressionCard, RuleConfidence, StatBreakdown, StatSource } from "./types";

/**
 * 最終能力値の合成。ブースターは証拠レベル別に分けて足す。
 *   strict      = base + progression + gameMeasured + manager + other
 *   standard    = strict + externalCrossVerified + confirmedB2（確認済み B2・本マイルストーンで追加）
 *   conditional = standard + conditionalBoosterDelta（Total Package のユーザー手動指定・自動判定ではない）
 *   experimental = standard + experimentalExtra（検証中の付属 + 条件手動指定 + 未確認の手動試算）
 *
 * confirmedB2Deltas（B2 のうち isConfirmedB2Candidate）は standard 以降に一度だけ加算する。
 * experimentalExtraDeltas 側は既に未確認分のみを持つ（呼び出し元 calculatePlayerBooster で分離済み）ため、
 * ここで二重加算にはならない。
 *
 * `finalValue` / `playerBoosterDelta` は現在の適用モードでの採用値（条件手動指定は含まない）。
 * `strictFinalValue` / `standardFinalValue` / `conditionalFinalValue` / `experimentalFinalValue` は
 * モードに関わらず常に持つ。条件未指定なら conditionalFinalValue = standardFinalValue。
 * 上限（2026-10-09 に確定）: **基礎＋育成は 99 で止まり、ブースター・監督の補正はその上に足す（99 を超えられる）**。
 *   根拠: KONAMI 公式 v3.00「Boosters … allow players to perform beyond the normal ceiling of 99」・
 *   eFHUB の計算（育成は min(99)・監督ブースターと選手ブースターは止めない）。下限 STAT_FLOOR は従来どおり。
 *   `capApplied` / `finalCapApplied` は「育成が 99 で止まった」ことを示す。
 */

export interface FinalStatsResult {
  stats: StatBreakdown[];
  finalCapApplied: boolean;
  finalCapValue: number;
  finalCapConfidence: RuleConfidence;
}

export function calculateFinalStats(input: {
  card: ProgressionCard;
  mode: BoosterApplicationMode;
  progressionDeltas: Record<string, number>;
  /** 参考画面で実測確認（game_client_verified ＋ screenshot_verified）の付属ブースター。 */
  gameMeasuredDeltas?: Record<string, number>;
  /** 外部2ソース整合（external_cross_verified）の付属ブースター。 */
  externalVerifiedDeltas?: Record<string, number>;
  /** Total Package などのユーザー手動指定の条件付き付属（全対象能力へ +段階値）。自動判定ではない。 */
  conditionalDeltas?: Record<string, number>;
  /** 手動試算ブースター（B2・付属を上書きする試算）ぶん。全件（確認済み+未確認）。表示用。 */
  manualTrialDeltas?: Record<string, number>;
  /** B2 のうち isConfirmedB2Candidate な分のみ（全対象能力へ +level）。standardFinalValue へ反映。 */
  confirmedB2Deltas?: Record<string, number>;
  /** 通常には乗らないが試算最終値には乗る分（検証中の付属 + 条件手動指定 + 未確認の手動試算）。 */
  experimentalExtraDeltas?: Record<string, number>;
  managerBoosterDeltas: Record<string, number>;
  otherDeltas?: Record<string, number>;
}): FinalStatsResult {
  const { card, mode, progressionDeltas, managerBoosterDeltas } = input;
  const gameMeasured = input.gameMeasuredDeltas ?? {};
  const externalVerified = input.externalVerifiedDeltas ?? {};
  const conditional = input.conditionalDeltas ?? {};
  const manualTrial = input.manualTrialDeltas ?? {};
  const confirmedB2 = input.confirmedB2Deltas ?? {};
  const experimentalExtra = input.experimentalExtraDeltas ?? {};
  const otherDeltas = input.otherDeltas ?? {};
  const PROGRESSION_CAP = STAT_CAPS.progression.value;
  let finalCapApplied = false;
  const floor = (v: number) => Math.max(STAT_FLOOR, v);

  const stats = WORLD_STAT_DEFS.map((def) => {
    const baseValue = Math.max(STAT_FLOOR, Math.min(STAT_CAPS.base.value, intOr0(card.baseStats[def.key] ?? 0)));
    const progressionDelta = intOr0(progressionDeltas[def.key]);
    const managerBoosterDelta = intOr0(managerBoosterDeltas[def.key]);
    const otherDelta = intOr0(otherDeltas[def.key]);
    const gameMeasuredBoosterDelta = intOr0(gameMeasured[def.key]);
    const externalVerifiedBoosterDelta = intOr0(externalVerified[def.key]);
    const conditionalBoosterDelta = intOr0(conditional[def.key]);
    const manualTrialBoosterDelta = intOr0(manualTrial[def.key]);
    const confirmedB2BoosterDelta = intOr0(confirmedB2[def.key]);
    const experimentalPlayerBoosterDelta = intOr0(experimentalExtra[def.key]);

    // 育成は 99 で止まる（基礎＋育成）。ブースター・監督の補正は止めずに足す。
    const progressedRaw = baseValue + progressionDelta;
    const progressed = Math.min(PROGRESSION_CAP, progressedRaw);
    const progressionCapped = progressed !== progressedRaw;
    const overflow = progressedRaw - progressed;
    const common = progressed + managerBoosterDelta + otherDelta;
    const strictRaw = common + gameMeasuredBoosterDelta;
    const standardRaw = strictRaw + externalVerifiedBoosterDelta + confirmedB2BoosterDelta;
    const strictFinalValue = floor(strictRaw);
    const standardFinalValue = floor(standardRaw);
    const conditionalFinalValue = floor(standardRaw + conditionalBoosterDelta);
    const experimentalFinalValue = floor(standardRaw + experimentalPlayerBoosterDelta);
    // 育成の 99 で止めた分を足し戻した値（上限が無かった場合・表示用）
    const strictUncapped = strictRaw + overflow;
    const standardUncapped = standardRaw + overflow;

    const playerBoosterDelta =
      mode === "strict"
        ? gameMeasuredBoosterDelta
        : gameMeasuredBoosterDelta + externalVerifiedBoosterDelta + confirmedB2BoosterDelta;
    const uncappedValue = mode === "strict" ? strictUncapped : standardUncapped;
    const finalValue = mode === "strict" ? strictFinalValue : standardFinalValue;
    const capApplied = progressionCapped;
    if (capApplied) finalCapApplied = true;

    const deltaSources: StatSource[] = [];
    if (progressionDelta !== 0) deltaSources.push("progression");
    if (playerBoosterDelta !== 0) deltaSources.push("player-booster");
    if (managerBoosterDelta !== 0) deltaSources.push("manager-booster");
    const source: StatSource =
      deltaSources.length === 0 ? "base" : deltaSources.length === 1 ? deltaSources[0] : "mixed";
    const confidence: RuleConfidence = deltaSources.length === 0 ? "confirmed" : "provisional";

    return {
      key: def.key,
      nameEn: def.nameEn,
      group: def.group,
      baseValue,
      progressionDelta,
      playerBoosterDelta,
      managerBoosterDelta,
      otherDelta,
      uncappedValue,
      finalValue,
      capApplied,
      source,
      confidence,
      gameMeasuredBoosterDelta,
      externalVerifiedBoosterDelta,
      conditionalBoosterDelta,
      manualTrialBoosterDelta,
      confirmedB2BoosterDelta,
      experimentalPlayerBoosterDelta,
      strictFinalValue,
      standardFinalValue,
      conditionalFinalValue,
      conditionalCapApplied: progressionCapped,
      experimentalFinalValue,
      experimentalCapApplied: progressionCapped,
    };
  });

  return {
    stats,
    finalCapApplied,
    finalCapValue: PROGRESSION_CAP,
    finalCapConfidence: STAT_CAPS.final.confidence,
  };
}

function intOr0(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0;
}
