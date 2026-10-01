import type { SquadDiagnosisShareData, SquadDiagnosisShareFinding } from "./squad-diagnosis-share";
import type { Locale } from "@/lib/i18n/locale";
import {
  COLORS,
  IMAGE_TEXT,
  SQUAD_DIAGNOSIS_IMAGE_HEIGHT,
  SQUAD_DIAGNOSIS_IMAGE_SCALE,
  SQUAD_DIAGNOSIS_IMAGE_WIDTH,
  drawCategoryRow,
  drawSquadDiagnosisImage,
  findingLabelForImage,
  formatGeneratedAt,
  roundRect,
  tierColor,
  wrapText,
} from "./squad-diagnosis-image";

/**
 * F-041b: 共有カードの比率（1:1・9:16・16:9）。既存の 3:4（drawSquadDiagnosisImage）は変えない。
 * - 安全なデータ（SquadDiagnosisShareData）と、表示言語へ訳した称号の文字列だけから描く（ID・URL・Token を描かない）。
 * - 長い名前は幅で折り返し・省略する。出力は論理サイズの SQUAD_DIAGNOSIS_IMAGE_SCALE 倍。
 */
export type SquadCardRatio = "3:4" | "1:1" | "9:16" | "16:9";
export const SQUAD_CARD_RATIOS: readonly SquadCardRatio[] = ["3:4", "1:1", "9:16", "16:9"];
export const SQUAD_CARD_SIZES: Record<SquadCardRatio, { width: number; height: number }> = {
  "3:4": { width: SQUAD_DIAGNOSIS_IMAGE_WIDTH, height: SQUAD_DIAGNOSIS_IMAGE_HEIGHT },
  "1:1": { width: 960, height: 960 },
  "9:16": { width: 720, height: 1280 },
  "16:9": { width: 1280, height: 720 },
};

export interface SquadCardExtras {
  /** F-072 の称号（最大1）とバッジ（最大4）の表示名。 */
  titles?: { primary: string | null; badges: string[] } | null;
}

/** ファイル名へ比率を付ける（3:4 は既存のファイル名のまま）。 */
export function withRatioSuffix(filename: string, ratio: SquadCardRatio): string {
  if (ratio === "3:4") return filename;
  const suffix = ratio.replace(":", "x");
  return filename.replace(/\.png$/i, `-${suffix}.png`);
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

function drawTitlePills(ctx: CanvasRenderingContext2D, titles: SquadCardExtras["titles"], x: number, y: number, width: number): number {
  if (!titles || (!titles.primary && titles.badges.length === 0)) return 0;
  const items = [...(titles.primary ? [{ text: titles.primary, primary: true }] : []), ...titles.badges.slice(0, 4).map((text) => ({ text, primary: false }))];
  const h = 30;
  const gap = 8;
  let cx = x;
  let row = 0;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (const it of items) {
    ctx.font = it.primary ? "800 16px sans-serif" : "600 14px sans-serif";
    const label = truncateToWidth(ctx, it.text, width - 24);
    const w = Math.min(width, ctx.measureText(label).width + 24);
    if (cx + w > x + width && cx > x) {
      row++;
      if (row >= 2) break;
      cx = x;
    }
    const cy = y + row * (h + gap);
    ctx.fillStyle = it.primary ? COLORS.accent : COLORS.surface3;
    roundRect(ctx, cx, cy, w, h, 15);
    ctx.fill();
    ctx.fillStyle = it.primary ? COLORS.accentInk : COLORS.text;
    ctx.fillText(label, cx + 12, cy + h / 2);
    cx += w + gap;
  }
  ctx.textBaseline = "alphabetic";
  return (row + 1) * (h + gap);
}

function drawHeader(ctx: CanvasRenderingContext2D, data: SquadDiagnosisShareData, locale: Locale, x: number, y: number, width: number): number {
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.accent;
  ctx.font = "700 16px sans-serif";
  ctx.fillText(data.serviceName, x, y);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "400 13px sans-serif";
  ctx.fillText(formatGeneratedAt(data.generatedAtIso, locale), x + width, y);
  ctx.textAlign = "left";
  return y + 30;
}

function drawIdentity(ctx: CanvasRenderingContext2D, data: SquadDiagnosisShareData, locale: Locale, x: number, y: number, width: number, maxNameLines: number): number {
  const text = IMAGE_TEXT[locale];
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "600 14px sans-serif";
  ctx.fillText(truncateToWidth(ctx, text.heading, width), x, y);
  y += 34;
  ctx.fillStyle = COLORS.text;
  ctx.font = "700 28px sans-serif";
  y = wrapText(ctx, data.squadName, x, y, width, 34, maxNameLines) - 6;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "500 16px sans-serif";
  ctx.fillText(truncateToWidth(ctx, `${text.formationPrefix}${data.formationLabel}`, width), x, y);
  return y + 26;
}

function drawScore(ctx: CanvasRenderingContext2D, data: SquadDiagnosisShareData, locale: Locale, x: number, y: number, width: number): number {
  const text = IMAGE_TEXT[locale];
  ctx.fillStyle = COLORS.surface2;
  roundRect(ctx, x, y, width, 96, 12);
  ctx.fill();
  const top = y + 20;
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "600 14px sans-serif";
  ctx.fillText(text.overallScore, x + 20, top);
  ctx.fillStyle = COLORS.accent;
  ctx.font = "800 48px sans-serif";
  const scoreText = data.overallScore != null ? `${data.overallScore}` : "—";
  ctx.fillText(scoreText, x + 20, top + 46);
  if (data.overallScore != null) {
    const sw = ctx.measureText(scoreText).width;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "500 18px sans-serif";
    ctx.fillText(text.perHundred, x + 26 + sw, top + 46);
  }
  const tierW = 96;
  const tierX = x + width - tierW - 16;
  if (data.overallTier) {
    ctx.fillStyle = tierColor(data.overallTier);
    roundRect(ctx, tierX, top - 4, tierW, 40, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.accentInk;
    ctx.font = "800 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(truncateToWidth(ctx, `${text.tierPrefix}${data.overallTier}`, tierW - 8), tierX + tierW / 2, top + 22);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "600 15px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(text.notRated, x + width - 16, top + 20);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "400 13px sans-serif";
  ctx.fillText(truncateToWidth(ctx, `${text.ratedCategoriesPrefix}${data.ratedCategoryCount} / ${data.totalCategoryCount}`, width - 40), x + 20, y + 84);
  return y + 96 + 16;
}

function drawFinding(ctx: CanvasRenderingContext2D, heading: string, color: string, finding: SquadDiagnosisShareFinding | null, locale: Locale, x: number, y: number, width: number, height: number) {
  ctx.fillStyle = COLORS.surface2;
  roundRect(ctx, x, y, width, height, 10);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  ctx.font = "700 14px sans-serif";
  ctx.fillText(truncateToWidth(ctx, heading, width - 32), x + 16, y + 26);
  if (finding) {
    ctx.fillStyle = COLORS.text;
    ctx.font = "600 16px sans-serif";
    wrapText(ctx, findingLabelForImage(finding, locale), x + 16, y + 52, width - 32, 22, Math.max(1, Math.floor((height - 52) / 22)));
  } else {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "400 14px sans-serif";
    ctx.fillText(IMAGE_TEXT[locale].none, x + 16, y + 52);
  }
}

/**
 * 比率を選べる診断カード。3:4 は既存の描画そのもの（互換のため変えない）。
 * 1:1・16:9 は左右2列（左: 名前・総合・称号・長所/弱点、右: カテゴリ）、9:16 は縦1列。
 */
export function drawSquadDiagnosisCard(canvas: HTMLCanvasElement, data: SquadDiagnosisShareData, locale: Locale, ratio: SquadCardRatio, extras: SquadCardExtras = {}): void {
  if (ratio === "3:4") {
    drawSquadDiagnosisImage(canvas, data, locale);
    return;
  }
  const { width: W, height: H } = SQUAD_CARD_SIZES[ratio];
  const scale = SQUAD_DIAGNOSIS_IMAGE_SCALE;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  const text = IMAGE_TEXT[locale];

  ctx.fillStyle = COLORS.bgOuter;
  ctx.fillRect(0, 0, W, H);
  const pad = 32;
  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, pad / 2, pad / 2, W - pad, H - pad, 16);
  ctx.fill();
  const x0 = pad + 16;
  const inner = W - x0 * 2;
  const y = drawHeader(ctx, data, locale, x0, pad + 16, inner);
  const disclaimerLines = ratio === "16:9" ? 2 : 3;
  const disclaimerTop = H - pad - 8 - disclaimerLines * 18;

  if (ratio === "9:16") {
    let cy = drawIdentity(ctx, data, locale, x0, y + 8, inner, 2);
    cy = drawScore(ctx, data, locale, x0, cy, inner);
    const th = drawTitlePills(ctx, extras.titles, x0, cy, inner);
    cy += th > 0 ? th + 8 : 0;
    for (const c of data.categories) cy += drawCategoryRow(ctx, c, x0, cy, inner, locale) + 4;
    cy += 12;
    const colW = (inner - 16) / 2;
    const fh = Math.min(150, Math.max(110, disclaimerTop - cy - 20));
    drawFinding(ctx, text.topStrengthHeading, COLORS.success, data.topStrength, locale, x0, cy, colW, fh);
    drawFinding(ctx, text.topWeaknessHeading, COLORS.danger, data.topWeakness, locale, x0 + colW + 16, cy, colW, fh);
  } else {
    const gap = 28;
    const leftW = Math.round(inner * (ratio === "16:9" ? 0.46 : 0.48));
    const rightX = x0 + leftW + gap;
    const rightW = inner - leftW - gap;
    let ly = drawIdentity(ctx, data, locale, x0, y + 4, leftW, ratio === "16:9" ? 1 : 2);
    ly = drawScore(ctx, data, locale, x0, ly, leftW);
    const th = drawTitlePills(ctx, extras.titles, x0, ly, leftW);
    ly += th > 0 ? th + 4 : 0;
    const remaining = disclaimerTop - ly - 16;
    if (ratio === "16:9") {
      const colW = (leftW - 12) / 2;
      const fh = Math.max(84, Math.min(200, remaining));
      drawFinding(ctx, text.topStrengthHeading, COLORS.success, data.topStrength, locale, x0, ly, colW, fh);
      drawFinding(ctx, text.topWeaknessHeading, COLORS.danger, data.topWeakness, locale, x0 + colW + 12, ly, colW, fh);
    } else {
      const fh = Math.max(84, Math.min(200, (remaining - 12) / 2));
      drawFinding(ctx, text.topStrengthHeading, COLORS.success, data.topStrength, locale, x0, ly, leftW, fh);
      drawFinding(ctx, text.topWeaknessHeading, COLORS.danger, data.topWeakness, locale, x0, ly + fh + 12, leftW, fh);
    }
    let ry = y + 8;
    // カテゴリの行間は、使える高さに合わせて広げる（下に大きな空白を残さない）。
    const n = Math.max(1, data.categories.length);
    const rowGap = Math.max(6, Math.min(36, (disclaimerTop - 24 - ry - n * 44) / n));
    for (const c of data.categories) ry += drawCategoryRow(ctx, c, rightX, ry, rightW, locale) + rowGap;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "400 13px sans-serif";
  wrapText(ctx, text.disclaimer ?? data.disclaimer, x0, disclaimerTop + 13, inner, 18, disclaimerLines);
}

/** 描画した canvas を PNG の Blob にする（SSR・非対応では null）。使い終わった canvas のメモリを早く手放す。 */
export async function renderCanvasToPngBlob(draw: (canvas: HTMLCanvasElement) => void): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  try {
    if (!canvas.getContext("2d")) return null;
    draw(canvas);
    return await new Promise<Blob | null>((resolve) => {
      if (typeof canvas.toBlob === "function") canvas.toBlob((b) => resolve(b), "image/png");
      else resolve(null);
    });
  } catch {
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
