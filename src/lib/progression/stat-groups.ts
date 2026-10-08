import { WORLD_STAT_KEYS, getStatDef } from "@/lib/world/stats";
import { PROGRESSION_RULES_VERSION } from "./constants";
import type { RuleConfidence } from "./types";

/**
 * 能力値グループ（eFootball 育成の10カテゴリ）。
 *
 * - 英語グループ名: confirmed（eFHUB のキー + 外部ガイド複数）
 * - 日本語グループ名: **未確認（仮称）**。正式名称を確認できていないため UI は英語名を表示する。
 *   Shooting は「シュート」を候補とし『撮影』とは訳さない。
 * - 対象能力値（10 カテゴリすべて）: **eFHUB基準**（2026-10-09 に eFHUB の公開の育成シミュレーターの定義と照合。
 *   `docs/product/progression-efhub-crosscheck-2026-10-09.md`）。Shooting は外部ガイド複数とも一致。
 *   ゲームの公式の発表ではない（KONAMI は対象能力の一覧を公開していない）。画面では「eFHUB基準」と示し、「公式」とは書かない。
 * - Jumping は Aerial Strength と GK 1 の両方の対象（eFHUB の定義どおり）。両方を上げると +L が合算される。
 *   能力 → カテゴリの逆引き（groupIdForStat）は最初のカテゴリ（Aerial Strength）を返す。
 * - 2026-10-09 より前の割り当て（Passing に Offensive Awareness・Dexterity に Speed・GK の組み合わせ違い）は
 *   本アプリの暫定の推定で、eFHUB と 6 カテゴリで食い違っていたため直した。
 */

export interface StatGroupSource {
  /** 照合した基準（ゲームの公式ではない）。 */
  sourceId: "efhub";
  checkedAt: string;
  dataVersion: string;
}

export const STAT_GROUP_SOURCE: StatGroupSource = {
  sourceId: "efhub",
  checkedAt: "2026-10-09",
  dataVersion: "efhub.com progression simulator (client build dpl_7gGKaJc1jLQoxvhP9JHRJQakeEGq)",
};

export interface StatGroupDef {
  groupId: string;
  nameEn: string;
  /** 日本語の仮称（未確認）。UI では原則 nameEn を表示する。 */
  nameJaCandidate: string | null;
  affectedStats: string[];
  /** この「対象能力値」の確認状態（confirmed = eFHUB基準で照合済み。ゲームの公式の発表という意味ではない） */
  statsConfidence: RuleConfidence;
  isGoalkeeping: boolean;
}

function group(groupId: string, nameEn: string, nameJaCandidate: string | null, affectedStats: string[], isGoalkeeping = false): StatGroupDef {
  return { groupId, nameEn, nameJaCandidate, affectedStats, statsConfidence: "confirmed", isGoalkeeping };
}

export const PROGRESSION_GROUPS: StatGroupDef[] = [
  group("shooting", "Shooting", "シュート", ["finishing", "setPieceTaking", "curl"]),
  group("passing", "Passing", "パス", ["lowPass", "loftedPass"]),
  group("dribbling", "Dribbling", "ドリブル", ["ballControl", "dribbling", "tightPossession"]),
  group("dexterity", "Dexterity", null, ["offensiveAwareness", "acceleration", "balance"]),
  group("lowerBodyStrength", "Lower Body Strength", null, ["speed", "kickingPower", "stamina"]),
  group("aerialStrength", "Aerial Strength", null, ["heading", "jumping", "physicalContact"]),
  group("defending", "Defending", "ディフェンス", ["defensiveAwareness", "tackling", "aggression", "defensiveEngagement"]),
  group("goalkeeping1", "Goalkeeping 1", null, ["gkAwareness", "jumping"], true),
  group("goalkeeping2", "Goalkeeping 2", null, ["gkParrying", "gkReach"], true),
  group("goalkeeping3", "Goalkeeping 3", null, ["gkCatching", "gkReflexes"], true),
];

/** 2 つのカテゴリの対象になる能力（eFHUB の定義）。 */
export const SHARED_GROUP_STATS: ReadonlySet<string> = new Set(["jumping"]);

export const GROUP_RULE_VERSION = PROGRESSION_RULES_VERSION;

const GROUP_BY_ID = new Map(PROGRESSION_GROUPS.map((g) => [g.groupId, g]));
const GROUP_BY_STAT = new Map<string, string>();
for (const g of PROGRESSION_GROUPS) {
  for (const s of g.affectedStats) if (!GROUP_BY_STAT.has(s)) GROUP_BY_STAT.set(s, g.groupId);
}

export function groupIdForStat(statKey: string): string | undefined {
  return GROUP_BY_STAT.get(statKey);
}
/** その能力を対象にする全てのカテゴリ（Jumping は 2 つ）。 */
export function groupIdsForStat(statKey: string): string[] {
  return PROGRESSION_GROUPS.filter((g) => g.affectedStats.includes(statKey)).map((g) => g.groupId);
}
export function getGroupDef(groupId: string): StatGroupDef | undefined {
  return GROUP_BY_ID.get(groupId);
}
export const PROGRESSION_GROUP_IDS = PROGRESSION_GROUPS.map((g) => g.groupId);

/** 割当が26能力値を覆い、重複が SHARED_GROUP_STATS だけかの自己検証 */
export function validateGroupCoverage(): { ok: boolean; missing: string[]; duplicated: string[] } {
  const seen = new Map<string, number>();
  for (const g of PROGRESSION_GROUPS) {
    for (const s of g.affectedStats) seen.set(s, (seen.get(s) ?? 0) + 1);
  }
  const missing = WORLD_STAT_KEYS.filter((k) => !seen.has(k));
  const duplicated = [...seen.entries()].filter(([k, n]) => n > (SHARED_GROUP_STATS.has(k) ? 2 : 1)).map(([k]) => k);
  const unknown = [...seen.keys()].filter((k) => !getStatDef(k));
  return { ok: missing.length === 0 && duplicated.length === 0 && unknown.length === 0, missing, duplicated };
}
