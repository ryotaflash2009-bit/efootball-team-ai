import {
  COST_BLOCK_SIZE_V3,
  DEFAULT_RULESET_ID,
  RULESET_ID_COST_V3,
  POINTS_PER_LEVEL,
  PROGRESSION_RULES_VERSION,
  PROGRESSION_RULES_VERSION_MISDATED,
  PROGRESSION_RULES_VERSION_V1,
  RULESET_ID_V1,
  STAT_CAP,
} from "./constants";
import {
  costForNextLevel,
  cumulativeCost,
  maxLevelForBudget,
  linearCostForIncrease,
  maxUsefulPointsForStat,
} from "./point-cost";
import type { RuleConfidence } from "./types";

/**
 * 育成ルールセット。
 * - staged-2026-08-28 (v2): グループ単位の配分・段階コスト（現行）
 * - provisional-linear (v1): 能力値単位の配分・線形コスト（旧・移行元）
 * - staged-2026-10-08: v2 と同じグループ単位の配分で、段階コストを「4 段階ごとに +1」に直したもの（現行・2026-10-08）。
 *   配分の解釈（能力値の上昇）は v2 と同じで、違うのはポイントの計算だけ。ビルドの `costRuleId` で選ぶ。
 */
export interface Ruleset {
  id: string;
  version: string;
  /** 配分の単位: "group"（v2） | "stat"（v1） */
  allocationUnit: "group" | "stat";
  pointsPerLevel: number;
  pointsPerLevelConfidence: RuleConfidence;
  statCap: number;
  totalPoints(maximumLevel: number | null | undefined): number;
  totalPointsConfidence: RuleConfidence;
  /** v2: グループレベル currentLevel→+1 のコスト */
  costForNextLevel(currentLevel: number): number;
  cumulativeCost(level: number): number;
  maxLevelForBudget(budget: number): number;
  costConfidence: RuleConfidence;
  /** v1 互換 */
  linearCostForIncrease(currentValue: number, increaseBy: number): number;
  maxUsefulPointsForStat(currentValue: number): number;
}

function totalPointsFromLevel(maximumLevel: number | null | undefined): number {
  const lv = typeof maximumLevel === "number" && Number.isFinite(maximumLevel) ? Math.trunc(maximumLevel) : 0;
  return lv <= 1 ? 0 : (lv - 1) * POINTS_PER_LEVEL;
}

const V2: Ruleset = {
  id: DEFAULT_RULESET_ID,
  version: PROGRESSION_RULES_VERSION,
  allocationUnit: "group",
  pointsPerLevel: POINTS_PER_LEVEL,
  pointsPerLevelConfidence: "confirmed",
  statCap: STAT_CAP,
  totalPoints: totalPointsFromLevel,
  totalPointsConfidence: "confirmed",
  costForNextLevel,
  cumulativeCost,
  maxLevelForBudget,
  costConfidence: "provisional",
  linearCostForIncrease,
  maxUsefulPointsForStat,
};

const V1: Ruleset = {
  id: RULESET_ID_V1,
  version: PROGRESSION_RULES_VERSION_V1,
  allocationUnit: "stat",
  pointsPerLevel: POINTS_PER_LEVEL,
  pointsPerLevelConfidence: "confirmed",
  statCap: STAT_CAP,
  totalPoints: totalPointsFromLevel,
  totalPointsConfidence: "confirmed",
  costForNextLevel: () => 1,
  cumulativeCost: (level) => Math.max(0, Math.trunc(level)),
  maxLevelForBudget: (budget) => Math.max(0, Math.trunc(budget)),
  costConfidence: "provisional",
  linearCostForIncrease,
  maxUsefulPointsForStat,
};

const V2_COST4: Ruleset = {
  ...V2,
  id: RULESET_ID_COST_V3,
  costForNextLevel: (level) => costForNextLevel(level, COST_BLOCK_SIZE_V3),
  cumulativeCost: (level) => cumulativeCost(level, COST_BLOCK_SIZE_V3),
  maxLevelForBudget: (budget) => maxLevelForBudget(budget, COST_BLOCK_SIZE_V3),
  costConfidence: "confirmed",
};

const RULESETS: Record<string, Ruleset> = { [V2.id]: V2, [V1.id]: V1, [V2_COST4.id]: V2_COST4 };

/** 新しいビルドに保存するコストの規則（現行）。 */
export const CURRENT_COST_RULE_ID = RULESET_ID_COST_V3;
/** `costRuleId` の無い既存のビルドのコストの規則（保存した時の規則・5 段階ごと）。 */
export const LEGACY_COST_RULE_ID = DEFAULT_RULESET_ID;
export const COST_RULE_IDS: readonly string[] = [LEGACY_COST_RULE_ID, CURRENT_COST_RULE_ID];

/** 保存されたコストの規則の ID を正規化する（無い・不明 → 旧規則。黙って現行へ変えない）。 */
export function resolveCostRuleId(costRuleId: string | null | undefined): string {
  return typeof costRuleId === "string" && COST_RULE_IDS.includes(costRuleId) ? costRuleId : LEGACY_COST_RULE_ID;
}

export function isCurrentCostRule(costRuleId: string | null | undefined): boolean {
  return resolveCostRuleId(costRuleId) === CURRENT_COST_RULE_ID;
}

/** 規則バージョン文字列 → ルールセット（誤日付バージョンも v2 として受理） */
const BY_VERSION: Record<string, Ruleset> = {
  [V2.version]: V2,
  [PROGRESSION_RULES_VERSION_MISDATED]: V2,
  [V1.version]: V1,
};

export function getRuleset(idOrVersion?: string | null): Ruleset {
  if (!idOrVersion) return V2;
  return RULESETS[idOrVersion] ?? BY_VERSION[idOrVersion] ?? V2;
}

export function listRulesetIds(): string[] {
  return Object.keys(RULESETS);
}

/** v2 相当のバージョン名（正規名 + 誤日付） */
export function isV2RulesVersion(version: string | null | undefined): boolean {
  return version === PROGRESSION_RULES_VERSION || version === PROGRESSION_RULES_VERSION_MISDATED;
}

/** v1（旧規則）かどうか。誤日付 v2 は legacy ではない（バージョン名の正規化だけ必要）。 */
export function isLegacyRulesVersion(version: string | null | undefined): boolean {
  if (!version) return false;
  if (isV2RulesVersion(version)) return false;
  return true;
}

/** 誤日付など非正規な v2 バージョン名を正規名へ */
export function normalizeRulesVersion(version: string | null | undefined): string {
  if (!version) return PROGRESSION_RULES_VERSION;
  if (version === PROGRESSION_RULES_VERSION_MISDATED) return PROGRESSION_RULES_VERSION;
  return version;
}
