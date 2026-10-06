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

/**
 * 「あなたの一番」の追加の項目（2026-10-07・v2）。My Team のカードの公式のデータ（OVR・登録ポジション・カード種別）だけから決める。
 * - 決定的: 同じ値は worldCardId の文字列の昇順（小さい方）。比べるカードが 2 枚未満の項目は出さない。
 * - 計算しない項目（データが無い）: 監督との相性・多用途さ（副ポジションのデータなし）・控えの最強（スカッドが必要）・
 *   育成で最も伸びたビルド（ビルドの履歴が必要）。
 */
export const YOUR_BEST_EXTRAS_VERSION = "your-best-extras/2026-10-07.v1";

export interface YourBestExtraCardInput {
  worldCardId: string;
  ovrBase: number | null;
  ovrMax: number | null;
  registeredPosition: string | null;
  cardType: string | null;
}

export type YourBestExtraId = "highestRated" | "largestGrowth" | "rarestPosition" | "rarestCardType";

export interface YourBestExtraEntry {
  id: YourBestExtraId;
  worldCardId: string;
  /** 表示の値（OVR・伸びしろ・人数）。 */
  value: number;
  /** ポジション・カード種別の項目だけ: その値。 */
  label: string | null;
  candidates: number;
}

function pickMax<T extends { worldCardId: string }>(items: readonly T[], value: (x: T) => number | null): { item: T; value: number } | null {
  let best: { item: T; value: number } | null = null;
  for (const x of items) {
    const v = value(x);
    if (v === null || !Number.isFinite(v)) continue;
    if (!best || v > best.value || (v === best.value && x.worldCardId < best.item.worldCardId)) best = { item: x, value: v };
  }
  return best;
}

function rarest(cards: readonly YourBestExtraCardInput[], key: (c: YourBestExtraCardInput) => string | null): { label: string; count: number; worldCardId: string } | null {
  const groups = new Map<string, string[]>();
  for (const c of cards) {
    const k = key(c);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), c.worldCardId]);
  }
  if (groups.size < 2) return null; // 全員同じなら「珍しい」は無い
  let best: { label: string; count: number; worldCardId: string } | null = null;
  for (const [label, ids] of groups) {
    const first = [...ids].sort()[0];
    if (!best || ids.length < best.count || (ids.length === best.count && label < best.label)) best = { label, count: ids.length, worldCardId: first };
  }
  return best;
}

export function discoverYourBestExtras(cards: readonly YourBestExtraCardInput[]): YourBestExtraEntry[] {
  if (cards.length < 2) return [];
  const out: YourBestExtraEntry[] = [];
  const withOvr = cards.filter((c) => typeof c.ovrMax === "number");
  const top = pickMax(withOvr, (c) => c.ovrMax);
  if (top && withOvr.length >= 2) out.push({ id: "highestRated", worldCardId: top.item.worldCardId, value: top.value, label: null, candidates: withOvr.length });
  const withGrowth = cards.filter((c) => typeof c.ovrMax === "number" && typeof c.ovrBase === "number");
  const growth = pickMax(withGrowth, (c) => (c.ovrMax as number) - (c.ovrBase as number));
  if (growth && growth.value > 0 && withGrowth.length >= 2) out.push({ id: "largestGrowth", worldCardId: growth.item.worldCardId, value: growth.value, label: null, candidates: withGrowth.length });
  const pos = rarest(cards, (c) => c.registeredPosition);
  if (pos) out.push({ id: "rarestPosition", worldCardId: pos.worldCardId, value: pos.count, label: pos.label, candidates: cards.length });
  const type = rarest(cards, (c) => c.cardType);
  if (type) out.push({ id: "rarestCardType", worldCardId: type.worldCardId, value: type.count, label: type.label, candidates: cards.length });
  return out;
}
