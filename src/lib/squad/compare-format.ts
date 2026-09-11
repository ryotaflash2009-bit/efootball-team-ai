/**
 * スカッド比較の表示用の数値整形（純関数のみ・表示専用）。
 *
 *  - 保存された元の値は変更しない。丸めは表示のためだけ。
 *  - -0.0 は 0.0 に正規化。NaN / Infinity は「—」。
 *  - 差分は符号付き。座標・カテゴリ平均は小数第1位。
 */

/** null / 非有限を弾いて数値だけ返す。 */
export function finiteOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 小数第 n 位で丸める。-0 は 0 へ。非有限は null。 */
export function roundTo(v: unknown, digits = 1): number | null {
  const n = finiteOrNull(v);
  if (n == null) return null;
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** 表示用文字列（非有限・null は dash）。 */
export function fmt(v: unknown, digits = 1, dash = "—"): string {
  const r = roundTo(v, digits);
  return r == null ? dash : r.toFixed(digits);
}

/** 整数表示（OVR など）。 */
export function fmtInt(v: unknown, dash = "—"): string {
  const n = finiteOrNull(v);
  return n == null ? dash : String(Math.round(n));
}

/** 符号付きの差分表示（a - b）。0 は "0.0"、正は "+"、負は "-"。非有限は dash。 */
export function fmtDiff(a: unknown, b: unknown, digits = 1, dash = "—"): string {
  const na = finiteOrNull(a);
  const nb = finiteOrNull(b);
  if (na == null || nb == null) return dash;
  const d = roundTo(na - nb, digits)!;
  if (d === 0) return (0).toFixed(digits);
  return (d > 0 ? "+" : "") + d.toFixed(digits);
}

/** 差分の数値（a - b）。丸め済み。どちらか欠損なら null。 */
export function diffValue(a: unknown, b: unknown, digits = 1): number | null {
  const na = finiteOrNull(a);
  const nb = finiteOrNull(b);
  if (na == null || nb == null) return null;
  return roundTo(na - nb, digits);
}

/** 2 つの数値集合の差分方向（"a" = A が大きい / "b" = B が大きい / "equal" / "na"）。 */
export function diffSide(a: unknown, b: unknown, epsilon = 0.05): "a" | "b" | "equal" | "na" {
  const na = finiteOrNull(a);
  const nb = finiteOrNull(b);
  if (na == null || nb == null) return "na";
  if (Math.abs(na - nb) <= epsilon) return "equal";
  return na > nb ? "a" : "b";
}

/** 日付表示（不正はそのまま返す）。 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ja-JP", { hour12: false });
}
