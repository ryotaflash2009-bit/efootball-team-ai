/**
 * 共有の画像（canvas）の文字が描けるかの確認（2026-10-06・多言語）。
 *
 * canvas は「その文字のフォントが無い」ことを知らせないため、文字ごとの描画の結果を、割り当ての無い文字（U+E000・U+FFFF。
 * どの環境でも「□」等の代わりの形になる）の描画と比べる。同じ形なら、その文字は描けない（文字化けの画像になる）。
 * ASCII は確認しない（どの環境でも描ける）。結果は「フォント + 文字」ごとに覚える。
 * 画像の保存（saveDrawnCanvasAsPng 等）は、描けない文字があれば画像を作らずに失敗を返す（font_unavailable）。
 */

const cache = new Map<string, boolean>();
const SIZE = 24;

function bitmap(ctx: CanvasRenderingContext2D, font: string, ch: string): string {
  ctx.clearRect(0, 0, SIZE * 2, SIZE * 2);
  ctx.font = font.replace(/\d+px/, `${SIZE}px`);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000";
  ctx.fillText(ch, 2, 2);
  const d = ctx.getImageData(0, 0, SIZE * 2, SIZE * 2).data;
  let h = 0;
  for (let i = 3; i < d.length; i += 4) h = (Math.imul(h, 31) + d[i]) | 0;
  return `${Math.round(ctx.measureText(ch).width * 10)}:${h}`;
}

/**
 * `texts` のうち、`font` で描けない文字（重複なし）。ブラウザー以外・canvas が使えない環境では空（確認できない）。
 */
export function unsupportedGlyphs(texts: readonly string[], font = "400 16px sans-serif"): string[] {
  if (typeof document === "undefined") return [];
  const canvas = document.createElement("canvas");
  canvas.width = SIZE * 2;
  canvas.height = SIZE * 2;
  const ctx = canvas.getContext?.("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null | undefined;
  // 測れない環境（getImageData・measureText が無い等）では止めない（確認できないことを理由に画像を拒否しない）
  if (!ctx || typeof ctx.getImageData !== "function" || typeof ctx.measureText !== "function" || typeof ctx.fillText !== "function") return [];
  let tofu: Set<string>;
  try {
    tofu = new Set([bitmap(ctx, font, "\uE000"), bitmap(ctx, font, "\uFFFF")]);
  } catch {
    return [];
  }
  const missing = new Set<string>();
  for (const t of texts) {
    for (const ch of Array.from(t)) {
      if (ch.charCodeAt(0) < 0x80 || /\s/.test(ch)) continue;
      const key = `${font}|${ch}`;
      let ok = cache.get(key);
      if (ok === undefined) {
        try {
          ok = !tofu.has(bitmap(ctx, font, ch));
        } catch {
          ok = true;
        }
        cache.set(key, ok);
      }
      if (!ok) missing.add(ch);
    }
  }
  return [...missing];
}

/**
 * 描画の間に fillText へ渡された文字と font を記録する（保存の前の確認用）。戻り値の stop で記録をやめる。
 */
export function recordCanvasText(ctx: CanvasRenderingContext2D): { entries: { text: string; font: string }[]; stop: () => void } {
  const entries: { text: string; font: string }[] = [];
  if (typeof ctx.fillText !== "function") return { entries, stop: () => undefined };
  const original = ctx.fillText.bind(ctx);
  ctx.fillText = ((text: string, x: number, y: number, maxWidth?: number) => {
    entries.push({ text: String(text), font: ctx.font });
    return maxWidth === undefined ? original(text, x, y) : original(text, x, y, maxWidth);
  }) as CanvasRenderingContext2D["fillText"];
  return { entries, stop: () => (ctx.fillText = original) };
}

/** 記録した文字の中に描けない文字があれば、その文字（重複なし）。 */
export function missingGlyphsIn(entries: readonly { text: string; font: string }[]): string[] {
  const byFont = new Map<string, string[]>();
  for (const e of entries) byFont.set(e.font, [...(byFont.get(e.font) ?? []), e.text]);
  const out = new Set<string>();
  for (const [font, texts] of byFont) for (const ch of unsupportedGlyphs(texts, font)) out.add(ch);
  return [...out];
}
