import { PERCENTILE_BUCKETS, type PercentileBucket } from "@/lib/percentiles/distribution";
import type { CardPercentile } from "@/lib/percentiles/card-percentiles";
import { PLAYER_TITLE_RULES, type PlayerTitleRuleId } from "./player-titles";

/**
 * F-073「あなたの一番」: My Team の中で、F-072 の各規則（能力のまとまり）で最も上位にいるカード。
 * - 比べるのは F-071 の基礎能力値（育成前）の区分・役割の範囲（フィールドどうし / GK どうし）。
 * - 規則の強さ = 規則の能力のうち最も低い位置（上位割合の最大値）。同じなら worldCardId の文字列順（決定的）。
 * - 中央値未満しかいない規則は出さない（「一番」でも誤解を招くため）。
 */
export const YOUR_BEST_RULES_VERSION = "your-best/2026-09-27.v1";

export interface YourBestCardInput {
  worldCardId: string;
  role: "field" | "gk";
  /** 役割の範囲の区分（cardBasePercentiles(scopes.get("field"|"gk"), …)）。 */
  percentiles: ReadonlyMap<string, CardPercentile>;
}

export interface YourBestEntry {
  ruleId: PlayerTitleRuleId;
  worldCardId: string;
  weakestBucket: PercentileBucket;
  /** 同じ規則で比べたカードの数。 */
  candidates: number;
}

const RANK = new Map(PERCENTILE_BUCKETS.map((b, i) => [b, i]));

export function discoverYourBest(cards: readonly YourBestCardInput[]): YourBestEntry[] {
  const out: YourBestEntry[] = [];
  for (const rule of PLAYER_TITLE_RULES) {
    let best: { id: string; strength: number; weakest: PercentileBucket } | null = null;
    let candidates = 0;
    for (const c of cards) {
      if (c.role !== rule.role) continue;
      let strength = -1;
      let weakest: PercentileBucket = "top_lt1";
      let complete = true;
      for (const key of rule.statKeys) {
        const p = c.percentiles.get(key);
        if (!p) {
          complete = false;
          break;
        }
        if (p.topPercent > strength) strength = p.topPercent;
        if (RANK.get(p.bucket)! > RANK.get(weakest)!) weakest = p.bucket;
      }
      if (!complete) continue;
      candidates += 1;
      if (!best || strength < best.strength || (strength === best.strength && c.worldCardId < best.id)) best = { id: c.worldCardId, strength, weakest };
    }
    if (best && best.weakest !== "below_median") out.push({ ruleId: rule.id, worldCardId: best.id, weakestBucket: best.weakest, candidates });
  }
  return out;
}
