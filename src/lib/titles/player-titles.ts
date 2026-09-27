import { PERCENTILE_BUCKETS, type PercentileBucket } from "@/lib/percentiles/distribution";
import type { CardPercentile } from "@/lib/percentiles/card-percentiles";

/**
 * F-072 選手の称号・バッジ（ルールベース・決定的・版つき・説明できる）。
 *
 * - 入力は F-071 の基礎能力値（育成前）の区分だけ。範囲は「役割」（フィールドプレイヤーどうし / GK どうし）。
 * - 閾値は分布から決まる区分を使う: 称号 = 規則の全能力が「上位5%」以内、バッジ = 全能力が「上位10%」以内。
 * - 称号は最大1つ、バッジは最大4つ（称号と同じ規則は除く）。条件を満たさなければ出さない（ランダム・抽選の要素はない）。
 * - 規則の強さ = 規則の能力のうち最も低い位置（上位割合の最大値）。同じなら規則の定義順。
 */
export const PLAYER_TITLE_RULES_VERSION = "player-titles/2026-09-27.v1";

export type PlayerTitleRuleId =
  | "pace"
  | "finishing"
  | "dribbling"
  | "passing"
  | "setPieces"
  | "aerial"
  | "ballWinning"
  | "physicality"
  | "stamina"
  | "shotStopping"
  | "handling"
  | "gkAwareness";

interface PlayerTitleRule {
  id: PlayerTitleRuleId;
  role: "field" | "gk";
  statKeys: string[];
}

export const PLAYER_TITLE_RULES: readonly PlayerTitleRule[] = [
  { id: "pace", role: "field", statKeys: ["speed", "acceleration"] },
  { id: "finishing", role: "field", statKeys: ["finishing", "offensiveAwareness"] },
  { id: "dribbling", role: "field", statKeys: ["dribbling", "ballControl", "tightPossession"] },
  { id: "passing", role: "field", statKeys: ["lowPass", "loftedPass"] },
  { id: "setPieces", role: "field", statKeys: ["setPieceTaking", "curl"] },
  { id: "aerial", role: "field", statKeys: ["heading", "jumping"] },
  { id: "ballWinning", role: "field", statKeys: ["tackling", "defensiveEngagement", "defensiveAwareness"] },
  { id: "physicality", role: "field", statKeys: ["physicalContact", "balance"] },
  { id: "stamina", role: "field", statKeys: ["stamina"] },
  { id: "shotStopping", role: "gk", statKeys: ["gkReflexes", "gkParrying"] },
  { id: "handling", role: "gk", statKeys: ["gkCatching", "gkReach"] },
  { id: "gkAwareness", role: "gk", statKeys: ["gkAwareness"] },
];

const RANK = new Map(PERCENTILE_BUCKETS.map((b, i) => [b, i]));
const TITLE_MAX_BUCKET: PercentileBucket = "top5";
const BADGE_MAX_BUCKET: PercentileBucket = "top10";
export const MAX_PLAYER_BADGES = 4;

export interface PlayerTitleEvidence {
  statKey: string;
  bucket: PercentileBucket;
}

export interface PlayerTitle {
  ruleId: PlayerTitleRuleId;
  /** 規則の中で最も低い区分（説明用）。 */
  weakestBucket: PercentileBucket;
  evidence: PlayerTitleEvidence[];
}

export interface PlayerTitleResult {
  rulesVersion: string;
  role: "field" | "gk";
  primary: PlayerTitle | null;
  badges: PlayerTitle[];
}

function within(bucket: PercentileBucket, max: PercentileBucket): boolean {
  return RANK.get(bucket)! <= RANK.get(max)!;
}

/**
 * percentiles は「役割」範囲（field / gk）の区分であること（呼び出し側が scopeKeyFor("role", …) で作る）。
 */
export function evaluatePlayerTitles(role: "field" | "gk", percentiles: ReadonlyMap<string, CardPercentile>): PlayerTitleResult {
  const qualified: (PlayerTitle & { strength: number; order: number })[] = [];
  PLAYER_TITLE_RULES.forEach((rule, order) => {
    if (rule.role !== role) return;
    const evidence: PlayerTitleEvidence[] = [];
    let strength = -1;
    let weakest: PercentileBucket = "top_lt1";
    for (const key of rule.statKeys) {
      const p = percentiles.get(key);
      if (!p) return; // 値が無い能力を含む規則は判定しない
      evidence.push({ statKey: key, bucket: p.bucket });
      if (p.topPercent > strength) strength = p.topPercent;
      if (RANK.get(p.bucket)! > RANK.get(weakest)!) weakest = p.bucket;
    }
    if (!within(weakest, BADGE_MAX_BUCKET)) return;
    qualified.push({ ruleId: rule.id, weakestBucket: weakest, evidence, strength, order });
  });
  qualified.sort((a, b) => a.strength - b.strength || a.order - b.order);
  const strip = ({ ruleId, weakestBucket, evidence }: PlayerTitle) => ({ ruleId, weakestBucket, evidence });
  const primaryFull = qualified.find((q) => within(q.weakestBucket, TITLE_MAX_BUCKET)) ?? null;
  const badges = qualified.filter((q) => q !== primaryFull).slice(0, MAX_PLAYER_BADGES).map(strip);
  return { rulesVersion: PLAYER_TITLE_RULES_VERSION, role, primary: primaryFull ? strip(primaryFull) : null, badges };
}
