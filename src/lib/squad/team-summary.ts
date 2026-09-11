import { COMPARE_CATEGORIES } from "@/lib/comparison/categories";
import type { StatBreakdown } from "@/lib/progression/types";
import { isUnresolvedCompatibility } from "./position";
import type { SquadSlotResult, SquadSubResult, TeamSummary, SlotRole } from "./types";

/**
 * チーム集計。カテゴリは既存 COMPARE_CATEGORIES（7分類）の **単純平均**。
 * 独自の「チーム総合力」を公式値として出さない。
 */

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function statMap(stats: StatBreakdown[], pick: (s: StatBreakdown) => number): Map<string, number> {
  return new Map(stats.map((s) => [s.key, pick(s)]));
}

export function buildTeamSummary(
  slots: SquadSlotResult[],
  subs: SquadSubResult[],
  warningCount: number,
  opts?: {
    /** 能力値の採り方（既定: 標準最終値 finalValue）。条件反映後は conditionalFinalValue。 */
    statValue?: (s: StatBreakdown) => number;
    /** 表示OVR の採り方（既定: displayedOvr）。 */
    ovrValue?: (e: NonNullable<SquadSlotResult["entry"]>) => number | null;
  },
): TeamSummary {
  const statValue = opts?.statValue ?? ((s: StatBreakdown) => s.finalValue);
  const ovrValue = opts?.ovrValue ?? ((e: NonNullable<SquadSlotResult["entry"]>) => e.displayedOvr);
  const filled = slots.filter((s) => s.entry != null);

  const positionCounts = new Map<string, number>();
  const roleCounts = new Map<SlotRole, number>();
  for (const s of slots) {
    if (!s.entry) continue;
    positionCounts.set(s.position, (positionCounts.get(s.position) ?? 0) + 1);
    roleCounts.set(s.role, (roleCounts.get(s.role) ?? 0) + 1);
  }

  const baseOvrs = filled.map((s) => s.entry!.baseOvr).filter((v): v is number => typeof v === "number");
  const dispOvrs = filled.map((s) => ovrValue(s.entry!)).filter((v): v is number => typeof v === "number");

  const categoryAverages = COMPARE_CATEGORIES.map((c) => {
    const perPlayer: number[] = [];
    for (const s of filled) {
      const m = statMap(s.entry!.result.stats, statValue);
      const vals = c.statKeys.map((k) => m.get(k) ?? 0);
      perPlayer.push(vals.reduce((a, b) => a + b, 0) / c.statKeys.length);
    }
    const a = avg(perPlayer);
    return {
      category: c.label,
      categoryId: c.id,
      avg: a ?? 0,
      sum: Math.round(perPlayer.reduce((x, y) => x + y, 0)),
    };
  });

  // 先発全員が持つスキル
  let sharedSkills: string[] = [];
  if (filled.length > 0) {
    const sets = filled.map((s) => new Set(s.entry!.display.playerSkills));
    sharedSkills = [...sets[0]].filter((sk) => sets.every((set) => set.has(sk))).sort();
  }

  const managerBoostedCount = filled.filter((s) => s.entry!.managerBoosterDelta !== 0).length;
  const unresolvedCompatibilityCount = slots.filter(
    (s) => s.entry != null && isUnresolvedCompatibility(s.compatibility.status),
  ).length;
  const gkMismatchCount = slots.filter(
    (s) => s.entry != null && s.compatibility.status === "gkMismatch",
  ).length;

  return {
    startingCount: filled.length,
    benchCount: subs.length,
    positionBreakdown: [...positionCounts.entries()]
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count || a.position.localeCompare(b.position)),
    roleBreakdown: (["GK", "DF", "MF", "FW"] as SlotRole[])
      .map((role) => ({ role, count: roleCounts.get(role) ?? 0 }))
      .filter((r) => r.count > 0),
    avgBaseOvr: avg(baseOvrs),
    avgDisplayedOvr: avg(dispOvrs),
    categoryAverages,
    sharedSkillCount: sharedSkills.length,
    sharedSkills,
    managerBoostedCount,
    unresolvedCompatibilityCount,
    gkMismatchCount,
    warningCount,
  };
}
