import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import { STAT_CAP } from "./constants";
import { getRuleset } from "./progression-rules";
import { maxUsefulPointsForStat } from "./point-cost";
import type { PointsSummary, ProgressionCard } from "./types";

/**
 * v1 互換（能力値単位の配分）。現行 UI は group-allocation.ts（v2）を使う。
 * ここは旧ビルドの解釈・移行補助のためだけに残す。
 */

const STAT_KEY_SET = new Set(WORLD_STAT_KEYS);
const MAX_SANE_ALLOCATION = 999;

export interface NormalizeResult {
  allocation: Record<string, number>;
  rejected: string[];
}

export function normalizeAllocation(
  raw: Record<string, unknown> | null | undefined,
  card: ProgressionCard,
): NormalizeResult {
  const out: Record<string, number> = {};
  const rejected: string[] = [];
  if (!raw || typeof raw !== "object") return { allocation: out, rejected };
  for (const [key, value] of Object.entries(raw)) {
    if (!STAT_KEY_SET.has(key)) { rejected.push(`${key}: 未知の能力値キー`); continue; }
    if (typeof value !== "number" || !Number.isFinite(value)) { rejected.push(`${key}: 数値でない`); continue; }
    if (value < 0) { rejected.push(`${key}: 負数`); continue; }
    if (!Number.isInteger(value)) { rejected.push(`${key}: 小数`); continue; }
    if (value > MAX_SANE_ALLOCATION) { rejected.push(`${key}: 異常に大きい`); continue; }
    const base = card.baseStats[key];
    const room = typeof base === "number" ? maxUsefulPointsForStat(base) : STAT_CAP;
    const clamped = Math.min(value, room);
    if (clamped !== value) rejected.push(`${key}: 上限まで丸め`);
    if (clamped > 0) out[key] = clamped;
  }
  return { allocation: out, rejected };
}

export function totalAllocated(allocation: Record<string, number>): number {
  return Object.values(allocation).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
}

export function summarizePoints(
  allocation: Record<string, number>,
  card: ProgressionCard,
  rulesetId?: string | null,
): PointsSummary {
  const ruleset = getRuleset(rulesetId);
  const totalPoints = ruleset.totalPoints(card.maximumLevel);
  const used = totalAllocated(allocation); // v1: 線形
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
