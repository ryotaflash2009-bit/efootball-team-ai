import type { ProgressionCard } from "./types";
import { WORLD_STAT_DEFS } from "@/lib/world/stats";
import { groupIdForStat, PROGRESSION_GROUPS } from "./stat-groups";
import { calculateProgressionDeltas } from "./calculate-progression";
import { calculateFinalStats } from "./calculate-final-stats";
import { STAT_FLOOR, STAT_CAP } from "./constants";

/**
 * 保存ビルド個別分析の「能力値インパクト」分析（build-analysis.ts の analyzeSavedBuild とは独立）。
 *
 * - 純関数のみ。生成AI・外部API・HTTP・Math.random・現在日時分岐・
 *   localStorage/SQLite/DOM直接アクセスなし。入力非破壊。同一入力→同一出力。
 * - 既存の育成計算式は一切変更しない。ここで使う `calculateProgressionDeltas` /
 *   `calculateFinalStats` は既存の engine.ts が内部で使っているものと同一の純関数を
 *   そのまま再利用する（B1/B2/Power of Many/監督補正は含めず、育成配分のみを反映した
 *   参考値を得るために、それらの delta を空 {} で渡すだけ）。
 * - 「保存時点の最終能力値」は SavedBuild.calculatedStats（保存時に実際に確定した値）を
 *   そのまま使う。現在の規則で B1/B2/Power of Many/監督補正を再現・再計算しない
 *   （安全に再現できないため）。保存時点の値と現在再計算した値を混同しない。
 * - 分析結果は言語非依存（abilityId・groupId・数値・コード）のみを保持する。
 */

// ---------------------------------------------------------------------------
// 入力
// ---------------------------------------------------------------------------

/** 個別能力値取得元カード（fetch 済みの ProgressionCard・呼び出し側が用意する）。 */
export type AbilityCardInput = Pick<ProgressionCard, "worldCardId" | "baseStats" | "maximumLevel" | "registeredPosition">;

export interface AbilitySiblingInput {
  buildId: string;
  buildName: string;
  progressionAllocation: Record<string, number>;
  /** 保存時点の最終能力値（SavedBuild.calculatedStats）。空オブジェクトはデータなし扱い。 */
  calculatedStats: Record<string, number>;
  rulesVersionIsCurrent: boolean;
}

export interface BuildAbilityImpactInput {
  /** 現在分析中のビルドの育成配分（v2: groupId → level）。 */
  progressionAllocation: Record<string, number>;
  /** 保存時点の最終能力値（SavedBuild.calculatedStats）。 */
  calculatedStats: Record<string, number>;
  /** 現在分析中のビルドが現行規則で保存されているか。 */
  rulesVersionIsCurrent: boolean;
  /** 育成前能力値を含むカード（未取得なら null＝取得不能）。 */
  card: AbilityCardInput | null;
  /** 同一カードの他の保存ビルド（比較対象・最大件数は呼び出し側が既に絞り込み済み）。 */
  siblings: AbilitySiblingInput[];
}

// ---------------------------------------------------------------------------
// 出力（言語非依存）
// ---------------------------------------------------------------------------

export interface AbilityRankEntry {
  abilityId: string;
  groupId: string | null;
  value: number;
}

export interface GroupImpactEntry {
  groupId: string;
  allocatedLevel: number;
  /** このグループの対象能力値の育成による上昇量の合計（trainedAbilities - baseAbilities）。 */
  totalTrainedDelta: number;
  /** このグループの対象能力値が、このビルドの highestFinalAbilities に含まれているか。 */
  reflectedInHighestFinal: boolean;
}

export type AbilityFindingCode =
  | "overinvestment-candidate"
  | "underinvested-but-high-final"
  | "underinvested-and-low-final"
  | "underinvested-context-unknown"
  | "ability-data-unavailable";

export interface AbilityFinding {
  code: AbilityFindingCode;
  groupId: string | null;
  params: Record<string, string | number>;
}

export type AbilityComparisonClassification = "practically-same" | "different-focus" | "insufficient-data";

export interface AbilityComparisonDifference {
  otherBuildId: string;
  otherBuildName: string;
  classification: AbilityComparisonClassification;
  /** 差が大きい能力値（絶対値降順・最大5件）。 */
  topDifferences: { abilityId: string; groupId: string | null; currentValue: number; otherValue: number; diff: number }[];
  /** 比較条件の違い（規則バージョンが異なる／一方が配分なし）。null なら条件は揃っている。 */
  conditionDifference: "legacy-vs-current" | "one-unallocated" | null;
}

export type AbilityConfidenceReason =
  | "ability-data-unavailable"
  | "comparison-data-unavailable"
  | "legacy-or-unknown-rules";

export interface BuildAbilityImpactAnalysis {
  available: boolean;
  baseAbilities: Record<string, number> | null;
  trainedAbilities: Record<string, number> | null;
  finalAbilities: Record<string, number> | null;
  abilityDeltas: Record<string, number> | null;
  largestGains: AbilityRankEntry[];
  smallestGains: AbilityRankEntry[];
  highestFinalAbilities: AbilityRankEntry[];
  lowestFinalAbilities: AbilityRankEntry[];
  groupImpact: GroupImpactEntry[];
  overinvestmentFindings: AbilityFinding[];
  underinvestmentFindings: AbilityFinding[];
  comparisonDifferences: AbilityComparisonDifference[];
  confidenceReasons: AbilityConfidenceReason[];
}

// ---------------------------------------------------------------------------
// しきい値（このアプリ独自の表示用ヒューリスティック。ゲーム内の公式規則の主張ではない）
// ---------------------------------------------------------------------------

const MAX_LARGEST_GAINS = 5;
const MAX_SMALLEST_GAINS = 3;
const MAX_HIGHEST_FINAL = 5;
const MAX_LOWEST_FINAL = 5;
const MAX_COMPARISON_DIFFERENCES = 5;
/** 「育成前から既に高い」とみなす基礎能力値のしきい値（99点満点の目安）。 */
const HIGH_BASE_THRESHOLD = 80;
/** 「最終能力値として十分高い」とみなすしきい値（配分が少ない領域を弱点断定しないための判定に使用）。 */
const HIGH_FINAL_THRESHOLD = 75;
/** 別ビルドとの能力値差が「実質的に同じ」とみなす最大絶対差（全能力値中の最大値がこの値以下）。 */
const PRACTICALLY_SAME_MAX_DIFF = 3;

const ORDER_BY_KEY = new Map(WORLD_STAT_DEFS.map((d) => [d.key, d.order]));

function sortedRank(entries: { abilityId: string; groupId: string | null; value: number }[], desc: boolean, max: number): AbilityRankEntry[] {
  return entries
    .slice()
    .sort((a, b) => {
      const diff = desc ? b.value - a.value : a.value - b.value;
      if (diff !== 0) return diff;
      return (ORDER_BY_KEY.get(a.abilityId) ?? 999) - (ORDER_BY_KEY.get(b.abilityId) ?? 999);
    })
    .slice(0, max);
}

/** 育成配分のみを反映した能力値（B1/B2/Power of Many/監督補正は含めない・既存の純関数をそのまま再利用）。 */
function computeTrainedAbilities(card: AbilityCardInput, allocation: Record<string, number>): Record<string, number> {
  const progressionDeltas = calculateProgressionDeltas(card as ProgressionCard, allocation);
  const result = calculateFinalStats({
    card: card as ProgressionCard,
    mode: "standard",
    progressionDeltas,
    managerBoosterDeltas: {},
  });
  const out: Record<string, number> = {};
  for (const s of result.stats) out[s.key] = s.finalValue;
  return out;
}

function clamp(v: number): number {
  return Math.max(STAT_FLOOR, Math.min(STAT_CAP, v));
}

export function groupAverage(abilities: Record<string, number>, groupId: string): number | null {
  const g = PROGRESSION_GROUPS.find((x) => x.groupId === groupId);
  if (!g) return null;
  const values = g.affectedStats.map((k) => abilities[k]).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function analyzeBuildAbilityImpact(input: BuildAbilityImpactInput): BuildAbilityImpactAnalysis {
  const { card, progressionAllocation, calculatedStats, rulesVersionIsCurrent, siblings } = input;
  const confidenceReasons: AbilityConfidenceReason[] = [];

  const hasFinal = Object.keys(calculatedStats).length > 0;
  const finalAbilities = hasFinal ? { ...calculatedStats } : null;

  if (!card) {
    confidenceReasons.push("ability-data-unavailable");
    if (!rulesVersionIsCurrent) confidenceReasons.push("legacy-or-unknown-rules");
    return {
      available: false,
      baseAbilities: null,
      trainedAbilities: null,
      finalAbilities,
      abilityDeltas: null,
      largestGains: [],
      smallestGains: [],
      highestFinalAbilities: [],
      lowestFinalAbilities: [],
      groupImpact: [],
      overinvestmentFindings: [],
      underinvestmentFindings: [],
      comparisonDifferences: [],
      confidenceReasons,
    };
  }

  const baseAbilities = { ...card.baseStats };
  const trainedAbilities = computeTrainedAbilities(card, progressionAllocation);
  const abilityDeltas: Record<string, number> = {};
  for (const key of Object.keys(baseAbilities)) {
    abilityDeltas[key] = clamp(trainedAbilities[key] ?? baseAbilities[key]) - clamp(baseAbilities[key]);
  }

  if (!hasFinal) confidenceReasons.push("ability-data-unavailable");
  if (!rulesVersionIsCurrent) confidenceReasons.push("legacy-or-unknown-rules");

  const deltaEntries = WORLD_STAT_DEFS.map((d) => ({ abilityId: d.key, groupId: groupIdForStat(d.key) ?? null, value: abilityDeltas[d.key] ?? 0 }));
  const positiveDeltaEntries = deltaEntries.filter((e) => e.value > 0);
  const largestGains = sortedRank(positiveDeltaEntries, true, MAX_LARGEST_GAINS);
  // 「ほとんど伸びていない」は、何かしら育成配分があるビルドでのみ意味を持つ（配分なしなら全て0で無意味）。
  const smallestGains = positiveDeltaEntries.length > 0 ? sortedRank(positiveDeltaEntries, false, MAX_SMALLEST_GAINS) : [];

  const finalEntries = finalAbilities
    ? WORLD_STAT_DEFS.map((d) => ({ abilityId: d.key, groupId: groupIdForStat(d.key) ?? null, value: finalAbilities[d.key] ?? 0 })).filter(
        (e) => typeof finalAbilities[e.abilityId] === "number",
      )
    : [];
  const highestFinalAbilities = sortedRank(finalEntries, true, MAX_HIGHEST_FINAL);
  const lowestFinalAbilities = sortedRank(finalEntries, false, MAX_LOWEST_FINAL);
  const highestFinalIds = new Set(highestFinalAbilities.map((e) => e.abilityId));

  // --- 配分と能力値成果の対応（groupImpact） ---
  const groupImpact: GroupImpactEntry[] = PROGRESSION_GROUPS.filter((g) => (progressionAllocation[g.groupId] ?? 0) > 0).map((g) => {
    const totalTrainedDelta = g.affectedStats.reduce((s, k) => s + (abilityDeltas[k] ?? 0), 0);
    const reflectedInHighestFinal = g.affectedStats.some((k) => highestFinalIds.has(k));
    return { groupId: g.groupId, allocatedLevel: progressionAllocation[g.groupId] ?? 0, totalTrainedDelta, reflectedInHighestFinal };
  });

  // --- 過剰投資候補（複数根拠が揃った場合だけ） ---
  const allocatedGroups = groupImpact.slice().sort((a, b) => b.allocatedLevel - a.allocatedLevel);
  const topAllocatedGroup = allocatedGroups[0] ?? null;
  const secondAllocatedLevel = allocatedGroups[1]?.allocatedLevel ?? 0;
  const overinvestmentFindings: AbilityFinding[] = [];
  if (topAllocatedGroup && card) {
    const baseAvg = groupAverage(baseAbilities, topAllocatedGroup.groupId);
    const isDominant = topAllocatedGroup.allocatedLevel > 0 && (secondAllocatedLevel === 0 || topAllocatedGroup.allocatedLevel >= secondAllocatedLevel * 1.5);
    const highBase = baseAvg != null && baseAvg >= HIGH_BASE_THRESHOLD;
    const hasAlternative = allocatedGroups.length > 1 || PROGRESSION_GROUPS.some((g) => (progressionAllocation[g.groupId] ?? 0) === 0);
    if (highBase && isDominant && hasAlternative) {
      overinvestmentFindings.push({
        code: "overinvestment-candidate",
        groupId: topAllocatedGroup.groupId,
        params: { baseAverage: Math.round(baseAvg as number), level: topAllocatedGroup.allocatedLevel },
      });
    }
  }

  // --- 配分が少ない領域の文脈（underinvestmentFindings） ---
  const underinvestmentFindings: AbilityFinding[] = [];
  const allocatedIds = new Set(Object.keys(progressionAllocation).filter((k) => (progressionAllocation[k] ?? 0) > 0));
  for (const g of PROGRESSION_GROUPS) {
    if (allocatedIds.has(g.groupId)) continue;
    if (allocatedIds.size === 0) continue; // 配分なし自体は別の finding（no-allocation）で扱う
    const finalAvg = finalAbilities ? groupAverage(finalAbilities, g.groupId) : null;
    if (finalAvg == null) {
      underinvestmentFindings.push({ code: "underinvested-context-unknown", groupId: g.groupId, params: {} });
    } else if (finalAvg >= HIGH_FINAL_THRESHOLD) {
      underinvestmentFindings.push({ code: "underinvested-but-high-final", groupId: g.groupId, params: { finalAverage: Math.round(finalAvg) } });
    } else {
      underinvestmentFindings.push({ code: "underinvested-and-low-final", groupId: g.groupId, params: { finalAverage: Math.round(finalAvg) } });
    }
  }

  // --- 同一カードの別ビルドとの能力値差 ---
  const comparisonDifferences: AbilityComparisonDifference[] = siblings.slice(0, MAX_COMPARISON_DIFFERENCES).map((sib) => {
    const sibHasFinal = Object.keys(sib.calculatedStats).length > 0;
    const conditionDifference: AbilityComparisonDifference["conditionDifference"] = !rulesVersionIsCurrent || !sib.rulesVersionIsCurrent
      ? "legacy-vs-current"
      : Object.keys(progressionAllocation).length === 0 || Object.keys(sib.progressionAllocation).length === 0
        ? "one-unallocated"
        : null;
    if (!hasFinal || !sibHasFinal) {
      return { otherBuildId: sib.buildId, otherBuildName: sib.buildName, classification: "insufficient-data", topDifferences: [], conditionDifference };
    }
    const diffs = WORLD_STAT_DEFS.map((d) => {
      const currentValue = finalAbilities?.[d.key] ?? 0;
      const otherValue = sib.calculatedStats[d.key] ?? 0;
      return { abilityId: d.key, groupId: groupIdForStat(d.key) ?? null, currentValue, otherValue, diff: currentValue - otherValue };
    });
    const maxAbsDiff = diffs.reduce((m, d) => Math.max(m, Math.abs(d.diff)), 0);
    const topDifferences = diffs
      .slice()
      .sort((a, b) => {
        const d = Math.abs(b.diff) - Math.abs(a.diff);
        if (d !== 0) return d;
        return (ORDER_BY_KEY.get(a.abilityId) ?? 999) - (ORDER_BY_KEY.get(b.abilityId) ?? 999);
      })
      .filter((d) => d.diff !== 0)
      .slice(0, MAX_COMPARISON_DIFFERENCES);
    const classification: AbilityComparisonClassification = maxAbsDiff <= PRACTICALLY_SAME_MAX_DIFF ? "practically-same" : "different-focus";
    return { otherBuildId: sib.buildId, otherBuildName: sib.buildName, classification, topDifferences, conditionDifference };
  });

  if (comparisonDifferences.some((c) => c.classification === "insufficient-data")) {
    confidenceReasons.push("comparison-data-unavailable");
  }

  return {
    available: true,
    baseAbilities,
    trainedAbilities,
    finalAbilities,
    abilityDeltas,
    largestGains,
    smallestGains,
    highestFinalAbilities,
    lowestFinalAbilities,
    groupImpact,
    overinvestmentFindings,
    underinvestmentFindings,
    comparisonDifferences,
    confidenceReasons: [...new Set(confidenceReasons)],
  };
}
