/**
 * F-090 Tier（2026-10-14・自前のデータだけ）: 確定した World のカードの「最大 OVR（Lv 最大）」の、登録ポジションの中での順位から決める。
 *
 * - 外部の Tier・投票・メタの評価は使わない（権利の確認が要るため・tier-pack/model.ts の own_data）。
 * - ゲーム内の強さ・使いやすさ・相性の評価ではない（画面で明示する）。同じ最大 OVR は同じ Tier（最初に現れた順位で決める）。
 * - 規則: 上位 1% 以内 = S・3% 以内 = A・6% 以内 = B・10% 以内 = C。それより下は載せない。
 */
export const OWN_TIER_RULES_VERSION = "own-tier/2026-10-14.v1";
export type OwnTierRank = "S" | "A" | "B" | "C";
export const OWN_TIER_THRESHOLDS: readonly { tier: OwnTierRank; maxTopFraction: number }[] = [
  { tier: "S", maxTopFraction: 0.01 },
  { tier: "A", maxTopFraction: 0.03 },
  { tier: "B", maxTopFraction: 0.06 },
  { tier: "C", maxTopFraction: 0.1 },
];
/** 1 つのポジションで載せる最大の件数（World の一覧の 100 件のページを 3 つまで）。 */
export const OWN_TIER_MAX_ENTRIES = 300;
export const OWN_TIER_PAGE_SIZE = 100;
/** 上位 10%（C）までを読むのに要るページ数（最大 3）。 */
export function pagesNeeded(population: number): number {
  const need = Math.min(OWN_TIER_MAX_ENTRIES, Math.ceil(population * OWN_TIER_THRESHOLDS[OWN_TIER_THRESHOLDS.length - 1].maxTopFraction));
  return Math.max(1, Math.ceil(need / OWN_TIER_PAGE_SIZE));
}
/** 母数がこれより少ないポジションは Tier を作らない（割合が粗くなるため）。 */
export const OWN_TIER_MIN_POPULATION = 50;

export interface OwnTierInput {
  worldCardId: string;
  ovrMax: number | null;
}
export interface OwnTierEntry<T extends OwnTierInput> {
  card: T;
  tier: OwnTierRank;
  /** 同じ最大 OVR の中で最初の順位（1 始まり）。 */
  rank: number;
  /** 上位の割合（%・小数 1 桁・四捨五入・0% とは出さず最小 0.1）。 */
  topPercent: number;
}
export type OwnTierResult<T extends OwnTierInput> =
  | { ok: true; population: number; entries: OwnTierEntry<T>[] }
  | { ok: false; reason: "too_few_cards" | "not_sorted" };

/**
 * cards は最大 OVR の降順（World の一覧の ovr_max_desc）で、population はそのポジションの全件数。
 * 最大 OVR が無いカードは除く。並びが降順でなければ作らない（誤った Tier を出さない）。
 */
export function buildOwnTier<T extends OwnTierInput>(cards: readonly T[], population: number): OwnTierResult<T> {
  if (!Number.isFinite(population) || population < OWN_TIER_MIN_POPULATION) return { ok: false, reason: "too_few_cards" };
  const rated = cards.filter((c) => typeof c.ovrMax === "number" && Number.isFinite(c.ovrMax));
  for (let i = 1; i < rated.length; i++) if ((rated[i].ovrMax as number) > (rated[i - 1].ovrMax as number)) return { ok: false, reason: "not_sorted" };
  const entries: OwnTierEntry<T>[] = [];
  let firstRankOfValue = 1;
  for (let i = 0; i < rated.length && entries.length < OWN_TIER_MAX_ENTRIES; i++) {
    if (i === 0 || rated[i].ovrMax !== rated[i - 1].ovrMax) firstRankOfValue = i + 1;
    const fraction = firstRankOfValue / population;
    const tier = OWN_TIER_THRESHOLDS.find((t) => fraction <= t.maxTopFraction)?.tier;
    if (!tier) break;
    entries.push({ card: rated[i], tier, rank: firstRankOfValue, topPercent: Math.max(0.1, Math.round(fraction * 1000) / 10) });
  }
  return { ok: true, population, entries };
}

/** ポジションの表示の順（GK から前へ）。知らないポジションは後ろに名前の順。 */
const POSITION_ORDER = ["GK", "CB", "LB", "RB", "DMF", "CMF", "LMF", "RMF", "AMF", "LWF", "RWF", "SS", "CF"];
export function sortPositions(positions: readonly string[]): string[] {
  return [...new Set(positions.filter((p) => /^[A-Z]{2,3}$/.test(p)))].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a);
    const ib = POSITION_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  });
}
