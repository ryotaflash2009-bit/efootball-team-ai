/**
 * 比較用の能力値カテゴリ（7分類）。
 * eFootball の公式カテゴリ重みは未確認のため、各カテゴリは **単純合計 / 単純平均** として扱う
 * （独自の総合評価を公式値として表示しない）。
 * World の26能力キーを重複なく分類。
 */
export interface CompareCategoryDef {
  id: string;
  label: string;
  statKeys: string[];
}

export const COMPARE_CATEGORIES: CompareCategoryDef[] = [
  { id: "attack", label: "攻撃", statKeys: ["offensiveAwareness", "finishing", "heading", "setPieceTaking", "curl"] },
  { id: "dribble", label: "ドリブル", statKeys: ["ballControl", "dribbling", "tightPossession"] },
  { id: "pass", label: "パス", statKeys: ["lowPass", "loftedPass"] },
  { id: "defense", label: "守備", statKeys: ["defensiveAwareness", "tackling", "aggression", "defensiveEngagement"] },
  { id: "physical", label: "フィジカル", statKeys: ["physicalContact", "balance", "stamina", "jumping", "kickingPower"] },
  { id: "speed", label: "スピード", statKeys: ["speed", "acceleration"] },
  { id: "gk", label: "GK", statKeys: ["gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach"] },
];

const BY_STAT = new Map<string, string>();
for (const c of COMPARE_CATEGORIES) for (const s of c.statKeys) BY_STAT.set(s, c.id);

export function categoryForStat(statKey: string): string | undefined {
  return BY_STAT.get(statKey);
}
