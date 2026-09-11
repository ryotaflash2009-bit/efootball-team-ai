import { WORLD_STAT_KEYS, getStatDef } from "@/lib/world/stats";
import { PROGRESSION_RULES_VERSION } from "./constants";
import type { RuleConfidence } from "./types";

/**
 * 能力値グループ（eFootball 育成の10カテゴリ）。
 *
 * - 英語グループ名: confirmed（eFHUB RSC キー + 外部ガイド複数）
 * - 日本語グループ名: **未確認（仮称）**。正式名称を確認できていないため UI は英語名を表示する。
 *   Shooting は「シュート」を候補とし『撮影』とは訳さない。
 * - Shooting の対象能力値: confirmed（Finishing / Set Piece Taking(Place Kicking) / Curl。pesmastery + gamemarket + mobilegaminghub）
 * - 他9グループの対象能力値: provisional（本アプリの暫定割当。26能力を重複なく10分割）
 */

export interface StatGroupDef {
  groupId: string;
  nameEn: string;
  /** 日本語の仮称（未確認）。UI では原則 nameEn を表示する。 */
  nameJaCandidate: string | null;
  affectedStats: string[];
  /** この「対象能力値」の確認状態 */
  statsConfidence: RuleConfidence;
  isGoalkeeping: boolean;
}

export const PROGRESSION_GROUPS: StatGroupDef[] = [
  {
    groupId: "shooting",
    nameEn: "Shooting",
    nameJaCandidate: "シュート",
    affectedStats: ["finishing", "setPieceTaking", "curl"],
    statsConfidence: "confirmed",
    isGoalkeeping: false,
  },
  {
    groupId: "passing",
    nameEn: "Passing",
    nameJaCandidate: "パス",
    affectedStats: ["lowPass", "loftedPass", "offensiveAwareness"],
    statsConfidence: "provisional",
    isGoalkeeping: false,
  },
  {
    groupId: "dribbling",
    nameEn: "Dribbling",
    nameJaCandidate: "ドリブル",
    affectedStats: ["ballControl", "dribbling", "tightPossession"],
    statsConfidence: "provisional",
    isGoalkeeping: false,
  },
  {
    groupId: "dexterity",
    nameEn: "Dexterity",
    nameJaCandidate: null,
    affectedStats: ["speed", "acceleration"],
    statsConfidence: "provisional",
    isGoalkeeping: false,
  },
  {
    groupId: "lowerBodyStrength",
    nameEn: "Lower Body Strength",
    nameJaCandidate: null,
    affectedStats: ["kickingPower", "balance", "stamina"],
    statsConfidence: "provisional",
    isGoalkeeping: false,
  },
  {
    groupId: "aerialStrength",
    nameEn: "Aerial Strength",
    nameJaCandidate: null,
    affectedStats: ["heading", "jumping", "physicalContact"],
    statsConfidence: "provisional",
    isGoalkeeping: false,
  },
  {
    groupId: "defending",
    nameEn: "Defending",
    nameJaCandidate: "ディフェンス",
    affectedStats: ["defensiveAwareness", "tackling", "aggression", "defensiveEngagement"],
    statsConfidence: "provisional",
    isGoalkeeping: false,
  },
  {
    groupId: "goalkeeping1",
    nameEn: "Goalkeeping 1",
    nameJaCandidate: null,
    affectedStats: ["gkAwareness", "gkReflexes"],
    statsConfidence: "provisional",
    isGoalkeeping: true,
  },
  {
    groupId: "goalkeeping2",
    nameEn: "Goalkeeping 2",
    nameJaCandidate: null,
    affectedStats: ["gkCatching", "gkParrying"],
    statsConfidence: "provisional",
    isGoalkeeping: true,
  },
  {
    groupId: "goalkeeping3",
    nameEn: "Goalkeeping 3",
    nameJaCandidate: null,
    affectedStats: ["gkReach"],
    statsConfidence: "provisional",
    isGoalkeeping: true,
  },
];

export const GROUP_RULE_VERSION = PROGRESSION_RULES_VERSION;

const GROUP_BY_ID = new Map(PROGRESSION_GROUPS.map((g) => [g.groupId, g]));
const GROUP_BY_STAT = new Map<string, string>();
for (const g of PROGRESSION_GROUPS) {
  for (const s of g.affectedStats) GROUP_BY_STAT.set(s, g.groupId);
}

export function groupIdForStat(statKey: string): string | undefined {
  return GROUP_BY_STAT.get(statKey);
}
export function getGroupDef(groupId: string): StatGroupDef | undefined {
  return GROUP_BY_ID.get(groupId);
}
export const PROGRESSION_GROUP_IDS = PROGRESSION_GROUPS.map((g) => g.groupId);

/** 割当が26能力値をちょうど1回ずつ覆っているかの自己検証 */
export function validateGroupCoverage(): { ok: boolean; missing: string[]; duplicated: string[] } {
  const seen = new Map<string, number>();
  for (const g of PROGRESSION_GROUPS) {
    for (const s of g.affectedStats) seen.set(s, (seen.get(s) ?? 0) + 1);
  }
  const missing = WORLD_STAT_KEYS.filter((k) => !seen.has(k));
  const duplicated = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  const unknown = [...seen.keys()].filter((k) => !getStatDef(k));
  return { ok: missing.length === 0 && duplicated.length === 0 && unknown.length === 0, missing, duplicated };
}
