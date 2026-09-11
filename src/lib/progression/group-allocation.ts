import { STAT_CAP } from "./constants";
import { getRuleset } from "./progression-rules";
import { PROGRESSION_GROUPS, PROGRESSION_GROUP_IDS, getGroupDef } from "./stat-groups";
import type { PointsSummary, ProgressionCard, ProgressionGroup } from "./types";

/**
 * v2: グループ単位の育成配分。
 * allocation: { [groupId]: categoryLevel }。カテゴリレベル L → そのグループの対象能力値がそれぞれ +L（99上限）。
 * コストは段階制（getRuleset().costForNextLevel）。
 */

const GROUP_ID_SET = new Set(PROGRESSION_GROUP_IDS);
const MAX_SANE_LEVEL = 200;

export interface NormalizeGroupResult {
  allocation: Record<string, number>;
  rejected: string[];
}

/** グループの対象能力値のうち最も余裕がある値（= このグループを上げて意味のある最大レベル） */
export function maxUsefulLevelForGroup(card: ProgressionCard, groupId: string): number {
  const g = getGroupDef(groupId);
  if (!g) return 0;
  let room = 0;
  for (const s of g.affectedStats) {
    const base = card.baseStats[s] ?? 0;
    room = Math.max(room, Math.max(0, STAT_CAP - base));
  }
  return room;
}

export function normalizeGroupAllocation(
  raw: Record<string, unknown> | null | undefined,
  card: ProgressionCard,
): NormalizeGroupResult {
  const out: Record<string, number> = {};
  const rejected: string[] = [];
  if (!raw || typeof raw !== "object") return { allocation: out, rejected };

  for (const [key, value] of Object.entries(raw)) {
    if (!GROUP_ID_SET.has(key)) {
      rejected.push(`${key}: 未知のグループID`);
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      rejected.push(`${key}: 数値でない (${String(value)})`);
      continue;
    }
    if (value < 0) {
      rejected.push(`${key}: 負数 (${value})`);
      continue;
    }
    if (!Number.isInteger(value)) {
      rejected.push(`${key}: 小数 (${value})`);
      continue;
    }
    if (value > MAX_SANE_LEVEL) {
      rejected.push(`${key}: 異常に大きい (${value})`);
      continue;
    }
    const cap = maxUsefulLevelForGroup(card, key);
    const clamped = Math.min(value, cap);
    if (clamped !== value) rejected.push(`${key}: 上限まで丸め (${value} → ${clamped})`);
    if (clamped > 0) out[key] = clamped;
  }
  return { allocation: out, rejected };
}

export function usedPoints(allocation: Record<string, number>): number {
  const ruleset = getRuleset();
  let sum = 0;
  for (const level of Object.values(allocation)) {
    if (Number.isFinite(level) && level > 0) sum += ruleset.cumulativeCost(Math.trunc(level));
  }
  return sum;
}

export function summarizeGroupPoints(
  allocation: Record<string, number>,
  card: ProgressionCard,
  rulesetId?: string | null,
): PointsSummary {
  const ruleset = getRuleset(rulesetId);
  const totalPoints = ruleset.totalPoints(card.maximumLevel);
  const used = usedPoints(allocation);
  const remaining = totalPoints - used;
  const overAllocated = used > totalPoints;
  return {
    totalPoints,
    usedPoints: used,
    remainingPoints: remaining,
    totalPointsConfidence: ruleset.totalPointsConfidence,
    canAdd: remaining > 0,
    canReduce: used > 0,
    atCap: remaining <= 0 && totalPoints > 0,
    overAllocated,
    valid: !overAllocated && used >= 0,
  };
}

/** グループレベルを delta 増減（残ポイント・グループ上限を尊重） */
export function adjustGroupLevel(
  allocation: Record<string, number>,
  card: ProgressionCard,
  groupId: string,
  delta: number,
  rulesetId?: string | null,
): Record<string, number> {
  if (!GROUP_ID_SET.has(groupId) || !Number.isInteger(delta) || delta === 0) return { ...allocation };
  const ruleset = getRuleset(rulesetId);
  const next = { ...allocation };
  const current = next[groupId] ?? 0;
  const groupCap = maxUsefulLevelForGroup(card, groupId);
  const step = delta > 0 ? 1 : -1;
  let level = current;

  for (let i = 0; i < Math.abs(delta); i++) {
    if (step > 0) {
      if (level >= groupCap) break;
      const summaryNow = summarizeGroupPoints(next, card, rulesetId);
      const cost = ruleset.costForNextLevel(level);
      if (summaryNow.remainingPoints < cost) break;
      level += 1;
    } else {
      if (level <= 0) break;
      level -= 1;
    }
    if (level <= 0) delete next[groupId];
    else next[groupId] = level;
  }
  return next;
}

/** グループ単位の内訳 */
export function groupBreakdowns(
  allocation: Record<string, number>,
  card: ProgressionCard,
  rulesetId?: string | null,
): ProgressionGroup[] {
  const ruleset = getRuleset(rulesetId);
  const summary = summarizeGroupPoints(allocation, card, rulesetId);
  return PROGRESSION_GROUPS.map((g) => {
    const level = allocation[g.groupId] ?? 0;
    const groupCap = maxUsefulLevelForGroup(card, g.groupId);
    const nextCost = level < groupCap ? ruleset.costForNextLevel(level) : null;
    return {
      groupId: g.groupId,
      nameEn: g.nameEn,
      nameJa: null,
      affectedStats: g.affectedStats,
      allocatedPoints: level,
      consumedProgressionPoints: ruleset.cumulativeCost(level),
      maximumAllocation: groupCap,
      nextLevelCost: nextCost,
      canAddLevel: nextCost != null && summary.remainingPoints >= nextCost && !summary.overAllocated,
      atMax: level >= groupCap && groupCap > 0,
      ruleVersion: ruleset.version,
      statsConfidence: g.statsConfidence,
      confirmationStatus: g.statsConfidence,
    };
  });
}
