import type { WorldStatGroup } from "./types";

/**
 * eFootball World の 26 能力値キー（World は表示名をキーにしている）と
 * その英語表示名・カテゴリ・表示順。
 * 日本語名は screenshots 未確認のため入れない（推測しない）。
 */
export interface WorldStatDef {
  key: string;
  nameEn: string;
  group: WorldStatGroup;
  order: number;
}

export const WORLD_STAT_DEFS: WorldStatDef[] = [
  { key: "offensiveAwareness", nameEn: "Offensive Awareness", group: "offense", order: 1 },
  { key: "ballControl", nameEn: "Ball Control", group: "offense", order: 2 },
  { key: "dribbling", nameEn: "Dribbling", group: "offense", order: 3 },
  { key: "tightPossession", nameEn: "Tight Possession", group: "offense", order: 4 },
  { key: "lowPass", nameEn: "Low Pass", group: "offense", order: 5 },
  { key: "loftedPass", nameEn: "Lofted Pass", group: "offense", order: 6 },
  { key: "finishing", nameEn: "Finishing", group: "offense", order: 7 },
  { key: "heading", nameEn: "Heading", group: "offense", order: 8 },
  { key: "setPieceTaking", nameEn: "Set Piece Taking", group: "offense", order: 9 },
  { key: "curl", nameEn: "Curl", group: "offense", order: 10 },
  { key: "defensiveAwareness", nameEn: "Defensive Awareness", group: "defense", order: 11 },
  { key: "tackling", nameEn: "Tackling", group: "defense", order: 12 },
  { key: "aggression", nameEn: "Aggression", group: "defense", order: 13 },
  { key: "defensiveEngagement", nameEn: "Defensive Engagement", group: "defense", order: 14 },
  { key: "gkAwareness", nameEn: "GK Awareness", group: "gk", order: 15 },
  { key: "gkCatching", nameEn: "GK Catching", group: "gk", order: 16 },
  { key: "gkParrying", nameEn: "GK Parrying", group: "gk", order: 17 },
  { key: "gkReflexes", nameEn: "GK Reflexes", group: "gk", order: 18 },
  { key: "gkReach", nameEn: "GK Reach", group: "gk", order: 19 },
  { key: "speed", nameEn: "Speed", group: "physical", order: 20 },
  { key: "acceleration", nameEn: "Acceleration", group: "physical", order: 21 },
  { key: "kickingPower", nameEn: "Kicking Power", group: "physical", order: 22 },
  { key: "jumping", nameEn: "Jumping", group: "physical", order: 23 },
  { key: "physicalContact", nameEn: "Physical Contact", group: "physical", order: 24 },
  { key: "balance", nameEn: "Balance", group: "physical", order: 25 },
  { key: "stamina", nameEn: "Stamina", group: "physical", order: 26 },
];

export const WORLD_STAT_KEYS: string[] = WORLD_STAT_DEFS.map((d) => d.key);

const DEF_BY_KEY = new Map(WORLD_STAT_DEFS.map((d) => [d.key, d]));

export function getStatDef(key: string): WorldStatDef | undefined {
  return DEF_BY_KEY.get(key);
}

export const WORLD_STAT_GROUP_LABELS: Record<WorldStatGroup, string> = {
  offense: "攻撃",
  defense: "守備",
  gk: "GK",
  physical: "身体能力",
};

/**
 * 能力値の色帯。eFHUB の正確なしきい値は未確認のため、本アプリ独自の妥当な区分。
 * 色だけに依存させない（UI 側で必ず数値も表示する）。
 */
export type StatTier = "elite" | "high" | "mid" | "low" | "poor";

export function statTier(value: number | null | undefined): StatTier {
  if (value == null || !Number.isFinite(value)) return "poor";
  if (value >= 90) return "elite";
  if (value >= 80) return "high";
  if (value >= 70) return "mid";
  if (value >= 60) return "low";
  return "poor";
}
