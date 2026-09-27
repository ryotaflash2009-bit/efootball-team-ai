/**
 * F-071 基礎能力値のパーセンタイル（純関数）。
 *
 * - 値は整数（能力値 0〜100 の範囲）。分布は「値ごとの件数」（最小値から最大値までの配列）で持ち、累積件数は読み込み時に作る。
 * - 同値は中央順位（midrank）で数える: 下側割合 = (より小さい件数 + 同値の件数 / 2) / 母数。
 *   上位割合 = (より大きい件数 + 同値の件数 / 2) / 母数。どちらも 0〜100。
 * - 表示の区分: 上位1%未満 / 上位1% / 上位5% / 上位10% / 上位25% / 上位50% / 中央値未満。
 *   「上位0%」は出さない。母数が小さいときは細かい区分を出さない（下の SMALL_POPULATION 規則）。
 */

export interface ValueCounts {
  /** 最小の値（整数）。 */
  min: number;
  /** min, min+1, … ごとの件数（非負整数）。 */
  counts: number[];
}

export interface CumulativeDistribution {
  n: number;
  min: number;
  max: number;
  counts: number[];
  /** below[i] = 値 (min+i) より小さい件数。 */
  below: number[];
}

const MAX_VALUE = 100;
const MIN_VALUE = 0;

/** 整数の値の列 → 値ごとの件数。範囲外・非整数は例外（生成時に検出する）。 */
export function buildValueCounts(values: readonly number[]): ValueCounts {
  if (values.length === 0) return { min: 0, counts: [] };
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!Number.isInteger(v) || v < MIN_VALUE || v > MAX_VALUE) throw new Error(`value out of range: ${v}`);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const counts = new Array<number>(hi - lo + 1).fill(0);
  for (const v of values) counts[v - lo] += 1;
  return { min: lo, counts };
}

/** 件数の表が正しい形か（整数・非負・範囲内・先頭と末尾が 0 でない）。 */
export function isValidValueCounts(vc: unknown): vc is ValueCounts {
  if (!vc || typeof vc !== "object") return false;
  const { min, counts } = vc as ValueCounts;
  if (!Array.isArray(counts)) return false;
  if (counts.length === 0) return min === 0;
  if (!Number.isInteger(min) || min < MIN_VALUE || min + counts.length - 1 > MAX_VALUE) return false;
  if (!counts.every((c) => Number.isInteger(c) && c >= 0)) return false;
  return counts[0] > 0 && counts[counts.length - 1] > 0;
}

export function toCumulative(vc: ValueCounts): CumulativeDistribution {
  const below: number[] = [];
  let acc = 0;
  for (const c of vc.counts) {
    below.push(acc);
    acc += c;
  }
  return { n: acc, min: vc.min, max: vc.min + vc.counts.length - 1, counts: vc.counts, below };
}

export interface PercentileResult {
  /** 下側割合（midrank・0〜100）。 */
  lowerPercent: number;
  /** 上位割合（midrank・0〜100）。 */
  topPercent: number;
  n: number;
}

/** 値の位置。分布が空・値が整数でないときは null。分布の外の値は端（0 / 100）に寄せる。 */
export function percentileOf(dist: CumulativeDistribution, value: number): PercentileResult | null {
  if (dist.n === 0 || !Number.isInteger(value)) return null;
  let lessThan: number;
  let equal: number;
  if (value < dist.min) {
    lessThan = 0;
    equal = 0;
  } else if (value > dist.max) {
    lessThan = dist.n;
    equal = 0;
  } else {
    const i = value - dist.min;
    lessThan = dist.below[i];
    equal = dist.counts[i];
  }
  const greater = dist.n - lessThan - equal;
  return {
    lowerPercent: ((lessThan + equal / 2) / dist.n) * 100,
    topPercent: ((greater + equal / 2) / dist.n) * 100,
    n: dist.n,
  };
}

export type PercentileBucket = "top_lt1" | "top1" | "top5" | "top10" | "top25" | "top50" | "below_median";

export const PERCENTILE_BUCKETS: readonly PercentileBucket[] = ["top_lt1", "top1", "top5", "top10", "top25", "top50", "below_median"];

/**
 * 小さな母集団の規則（分布が粗いと細かい区分は意味を持たない）:
 * - 母数 < MIN_POPULATION: 表示しない（null）。
 * - 母数 < 1,000: 「上位1%未満」を出さない（1件が 0.1% 以上になるため）。
 * - 母数 < 100: 「上位1%」も出さない（1件が 1% 以上）。最も細かい区分は「上位5%」。
 */
export const MIN_POPULATION = 20;

/**
 * 上位割合 → 区分。整数%へ四捨五入した値で決める（0 になる場合は「上位1%未満」、「上位0%」は出さない）。
 * 例: 0.3% → 上位1%未満、1.2% → 上位1%、4.6% → 上位5%、50.4% → 上位50%、50.6% → 中央値未満。
 */
export function bucketOf(topPercent: number, n: number): PercentileBucket | null {
  if (!Number.isFinite(topPercent) || n < MIN_POPULATION) return null;
  const x = Math.round(topPercent);
  let bucket: PercentileBucket;
  if (x <= 0) bucket = "top_lt1";
  else if (x <= 1) bucket = "top1";
  else if (x <= 5) bucket = "top5";
  else if (x <= 10) bucket = "top10";
  else if (x <= 25) bucket = "top25";
  else if (x <= 50) bucket = "top50";
  else bucket = "below_median";
  if (bucket === "top_lt1" && n < 1000) bucket = "top1";
  if (bucket === "top1" && n < 100) bucket = "top5";
  return bucket;
}
