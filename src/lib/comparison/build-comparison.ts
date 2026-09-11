import { calculateBuild } from "@/lib/progression/engine";
import { resolveAllocation as resolveBuildAllocation } from "@/lib/progression/resolve-allocation";
import { WORLD_STAT_DEFS, WORLD_STAT_GROUP_LABELS } from "@/lib/world/stats";
import { PROGRESSION_RULES_VERSION } from "@/lib/progression/constants";
import { COMPARE_CATEGORIES } from "./categories";
import type {
  CategoryComparison,
  ComparisonPlayerInput,
  ComparisonResult,
  SkillComparison,
  StatComparisonRow,
} from "./types";

/**
 * 比較の中核。比較専用の育成計算式は作らず、既存の calculateBuild をそのまま使う。
 * 各選手について: buildMode（auto-allocate）または savedAllocation → calculateBuild(card, allocation, manager)。
 */

function resolveAllocation(p: ComparisonPlayerInput): Record<string, number> {
  return resolveBuildAllocation(p.card, p.buildMode, p.savedAllocation ?? null);
}

function skillComparison(perPlayerSkills: string[][]): SkillComparison {
  const n = perPlayerSkills.length;
  const sets = perPlayerSkills.map((s) => new Set(s));
  const all = new Set<string>();
  for (const s of perPlayerSkills) for (const x of s) all.add(x);

  const shared: string[] = [];
  const partial: { skill: string; playerIdx: number[] }[] = [];
  const uniqueByPlayer: string[][] = perPlayerSkills.map(() => []);

  for (const skill of all) {
    const holders: number[] = [];
    for (let i = 0; i < n; i++) if (sets[i].has(skill)) holders.push(i);
    if (holders.length === n) shared.push(skill);
    else if (holders.length === 1) uniqueByPlayer[holders[0]].push(skill);
    else partial.push({ skill, playerIdx: holders });
  }

  return {
    shared: shared.sort(),
    partial: partial.sort((a, b) => a.skill.localeCompare(b.skill)),
    uniqueByPlayer: uniqueByPlayer.map((a) => a.sort()),
    countByPlayer: perPlayerSkills.map((s) => s.length),
  };
}

export function buildComparison(inputs: ComparisonPlayerInput[]): ComparisonResult {
  const players = inputs.map((input) => {
    const allocation = resolveAllocation(input);
    const result = calculateBuild({
      card: input.card,
      allocation,
      manager: input.manager,
      selectedPlayerBoosters: input.selectedPlayerBoosters ?? [],
      selectedConditionalBoosters: input.selectedConditionalBoosters ?? [],
      boosterApplicationMode:
        input.boosterApplicationMode ??
        ((input.experimentalModeEnabled ?? input.applyProvisionalBoosters) ? "experimental" : "standard"),
    });
    return { input, result };
  });

  // ---- 能力値行 ----
  const stats: StatComparisonRow[] = WORLD_STAT_DEFS.map((def) => {
    const perPlayer = players.map(
      (p) => p.result.stats.find((s) => s.key === def.key)!,
    );
    const finals = perPlayer.map((s) => s.finalValue);
    const max = Math.max(...finals);
    const min = Math.min(...finals);
    return {
      key: def.key,
      nameEn: def.nameEn,
      group: WORLD_STAT_GROUP_LABELS[def.group],
      perPlayer,
      highestPlayerIdx: finals.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0),
      lowestPlayerIdx: finals.map((v, i) => (v === min ? i : -1)).filter((i) => i >= 0),
      spread: max - min,
    };
  });

  // ---- カテゴリ（単純合計/平均） ----
  const categories: CategoryComparison[] = COMPARE_CATEGORIES.map((c) => {
    const totalByPlayer = players.map((p) =>
      c.statKeys.reduce((sum, k) => sum + (p.result.stats.find((s) => s.key === k)?.finalValue ?? 0), 0),
    );
    const avgByPlayer = totalByPlayer.map((t) => Math.round((t / c.statKeys.length) * 10) / 10);
    return {
      category: c.label,
      categoryId: c.id,
      totalByPlayer,
      avgByPlayer,
      spread: Math.max(...totalByPlayer) - Math.min(...totalByPlayer),
    };
  });

  const totalStatByPlayer = players.map((p) =>
    p.result.stats.reduce((sum, s) => sum + s.finalValue, 0),
  );

  // ---- スキル ----
  const playerSkills = skillComparison(inputs.map((i) => i.display.playerSkills));
  const aiStyles = skillComparison(inputs.map((i) => i.display.aiStyles));

  // ---- 基本情報 ----
  const infoDefs: { label: string; get: (i: ComparisonPlayerInput) => string | number | null }[] = [
    { label: "カードタイプ", get: (i) => i.display.cardType },
    { label: "登録ポジション", get: (i) => i.display.registeredPosition },
    { label: "基礎OVR", get: (i) => i.display.ovrBase },
    { label: "最大OVR", get: (i) => i.display.ovrMax },
    { label: "最大レベル", get: (i) => i.display.maximumLevel },
    { label: "攻撃プレースタイル", get: (i) => i.display.playingStyle },
    { label: "守備プレースタイル", get: (i) => i.display.playingStyleDefensive },
    { label: "国籍", get: (i) => i.display.nationality },
    { label: "地域", get: (i) => i.display.region },
    { label: "リーグ", get: (i) => i.display.league },
    { label: "チーム", get: (i) => i.display.team },
    { label: "年齢", get: (i) => i.display.age },
    { label: "身長", get: (i) => i.display.height },
    { label: "体重", get: (i) => i.display.weight },
    { label: "利き足", get: (i) => i.display.preferredFoot },
  ];
  const basicInfo = infoDefs.map((d) => ({
    label: d.label,
    perPlayer: inputs.map((i) => d.get(i)),
  }));

  // ---- 警告 ----
  const warnings: string[] = [];
  const wset = new Set<string>();
  for (const p of players) for (const w of p.result.warnings) if (!wset.has(w)) { wset.add(w); warnings.push(w); }
  warnings.push("カテゴリ合計・平均・総合は単純計算です（eFootball の公式カテゴリ重み・総合評価とは異なります）。");

  const positions = new Set(inputs.map((i) => i.display.registeredPosition ?? ""));

  return {
    players,
    basicInfo,
    stats,
    playerSkills,
    aiStyles,
    categories,
    totalStatByPlayer,
    positionMatch: positions.size === 1,
    estimatedOvrByPlayer: players.map((p) => p.result.rating.estimatedOvr),
    hasAnyConditionalSelection: players.some((p) => p.result.booster.hasConditionalSelection),
    warnings,
    rulesVersion: PROGRESSION_RULES_VERSION,
  };
}
