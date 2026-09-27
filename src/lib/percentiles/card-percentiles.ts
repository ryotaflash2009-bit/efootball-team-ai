import { bucketOf, percentileOf, type CumulativeDistribution, type PercentileBucket } from "./distribution";

/**
 * 1枚のカードの基礎能力値（育成前）→ 選んだ範囲の中での区分。範囲どうしを混ぜない（全能力を同じ範囲で比べる）。
 * 表示中のビルド・育成プレビューの値には使わない（F-071 の規則: 基礎値だけ）。
 */
export type PercentileScopeChoice = "all" | "position" | "role";

export interface CardPercentile {
  bucket: PercentileBucket;
  topPercent: number;
  n: number;
}

/** 範囲の選択 → 成果物の範囲キー。position はカードの登録ポジション、role は GK / フィールドプレイヤー。 */
export function scopeKeyFor(choice: PercentileScopeChoice, registeredPosition: string | null | undefined): string | null {
  if (choice === "all") return "all";
  const pos = typeof registeredPosition === "string" && /^[A-Z]{2,3}$/.test(registeredPosition) ? registeredPosition : null;
  if (!pos) return null;
  if (choice === "position") return `position:${pos}`;
  return pos === "GK" ? "gk" : "field";
}

export function cardBasePercentiles(
  scope: ReadonlyMap<string, CumulativeDistribution> | undefined,
  stats: readonly { key: string; value: number | null | undefined }[],
): Map<string, CardPercentile> {
  const out = new Map<string, CardPercentile>();
  if (!scope) return out;
  for (const s of stats) {
    if (typeof s.value !== "number") continue;
    const dist = scope.get(s.key);
    if (!dist) continue;
    const p = percentileOf(dist, s.value);
    if (!p) continue;
    const bucket = bucketOf(p.topPercent, p.n);
    if (!bucket) continue;
    out.set(s.key, { bucket, topPercent: p.topPercent, n: p.n });
  }
  return out;
}
