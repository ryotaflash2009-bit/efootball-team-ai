import type { BuildDiagnosisImageContent, ImageOrientation } from "./build-diagnosis-card-share";

/**
 * 診断結果カードのPNG画像化(Canvas 2D APIのみ・新規依存なし)。
 *
 * - squad-diagnosis-image.ts と同じ方針: DOMのスクリーンショットではなく、安全な文字列だけを
 *   持つ `BuildDiagnosisImageContent` から **ゼロから描画**する。操作UI・非表示要素・内部IDが
 *   写り込む余地が構造的にない。
 * - 生成した`<canvas>`はDOMへ追加しない(オフスクリーン)。フォントはシステムフォント
 *   (`sans-serif`)のみを使用するため、Webフォントの読み込み待機は不要(外部取得も発生しない)。
 * - 同じ`BuildDiagnosisImageContent`・同じ`orientation`からは常に同じ内容を描画する
 *   (Math.random・現在日時分岐なし)。
 */

/** 論理サイズ(px)。squad-diagnosis-image.tsと同様、devicePixelRatioではなく固定倍率を使う。 */
export const BUILD_DIAGNOSIS_IMAGE_SIZES: Record<ImageOrientation, { width: number; height: number; scale: number }> = {
  // 1080x1920(9:16)。1080x1350(4:5)も検討したが、実コンテンツ(目的+成果3件+注意点+改善+長所+比較)を
  // 詰めると文字を過度に縮小しないと収まらないため、縦方向に余裕のある9:16を標準採用する。
  portrait: { width: 540, height: 960, scale: 2 },
  // 1920x1080(16:9)。PC/Discord/X向け。
  landscape: { width: 960, height: 540, scale: 2 },
};

const COLORS = {
  bgOuter: "#090c0f",
  surface: "#12171c",
  surface2: "#1a2129",
  surface3: "#232d37",
  border: "#2a343d",
  text: "#eef1f3",
  textDim: "#9aa6b0",
  textMuted: "#616d77",
  accent: "#c7f000",
  accentInk: "#0a0d10",
  warning: "#f4c250",
  danger: "#ff5a5a",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 文字単位での折り返し(日本語は分かち書き不要・英単語も長すぎる場合はやむを得ず途中で折る)。
 * 最終行を超える分は省略記号で打ち切る。返り値は描画後のyカーソル位置。 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const chars = Array.from(text);
  let line = "";
  let lines = 0;
  let cursorY = y;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      if (lines === maxLines - 1) {
        let truncated = line;
        while (truncated.length > 0 && ctx.measureText(truncated + "…").width > maxWidth) truncated = truncated.slice(0, -1);
        ctx.fillText(truncated + "…", x, cursorY);
        return cursorY + lineHeight;
      }
      ctx.fillText(line, x, cursorY);
      line = chars[i];
      cursorY += lineHeight;
      lines++;
    } else {
      line = test;
    }
  }
  if (line.length > 0) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

function drawBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, ink: string): number {
  ctx.font = "700 13px sans-serif";
  const textWidth = ctx.measureText(text).width;
  const w = textWidth + 20;
  const h = 24;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x + 10, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  content: BuildDiagnosisImageContent;
}

/** 見出し+本文1ブロックを描画し、消費した高さを返す(左揃え・共通スタイル)。 */
function drawLabeledBlock(ctx: CanvasRenderingContext2D, label: string, body: string, x: number, y: number, width: number, maxLines: number): number {
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "700 13px sans-serif";
  ctx.fillText(label, x, y);
  let cursorY = y + 20;
  ctx.fillStyle = COLORS.text;
  ctx.font = "400 15px sans-serif";
  cursorY = wrapText(ctx, body, x, cursorY, width, 20, maxLines);
  return cursorY - y;
}

function drawComparisonBlock(ctx: CanvasRenderingContext2D, content: BuildDiagnosisImageContent, x: number, y: number, width: number): number {
  const c = content.comparison;
  if (!c) return 0;
  let cursorY = y;
  ctx.fillStyle = COLORS.text;
  ctx.font = "700 15px sans-serif";
  cursorY = wrapText(ctx, c.targetName, x, cursorY + 14, width, 20, 1);
  ctx.font = "400 14px sans-serif";
  if (c.notComparableText) {
    ctx.fillStyle = COLORS.textMuted;
    cursorY = wrapText(ctx, c.notComparableText, x, cursorY, width, 19, 2);
    return cursorY - y;
  }
  ctx.fillStyle = COLORS.textDim;
  cursorY = wrapText(ctx, `${c.purposeClosenessLabel}: ${c.purposeClosenessValue}`, x, cursorY, width, 19, 1);
  cursorY = wrapText(ctx, `${c.differentiationLabel}: ${c.differentiationValue}`, x, cursorY, width, 19, 1);
  if (c.majorDiffText) {
    ctx.fillStyle = COLORS.textMuted;
    cursorY = wrapText(ctx, c.majorDiffText, x, cursorY, width, 19, 1);
  }
  return cursorY - y;
}

function drawHeader(d: DrawContext, x: number, y: number, width: number): number {
  const { ctx, content } = d;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.accent;
  ctx.font = "700 16px sans-serif";
  ctx.fillText(content.serviceName, x, y);
  ctx.font = "700 13px sans-serif";
  const badgeWidth = ctx.measureText(content.modeLabel).width + 20;
  drawBadge(ctx, content.modeLabel, x + width - badgeWidth, y - 17, COLORS.surface3, COLORS.text);
  return 28;
}

function drawIdentity(d: DrawContext, x: number, y: number, width: number): number {
  const { ctx, content } = d;
  let cursorY = y;
  ctx.fillStyle = COLORS.text;
  ctx.font = "700 22px sans-serif";
  if (content.playerName) {
    cursorY = wrapText(ctx, content.playerName, x, cursorY + 22, width, 26, 2);
  }
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "500 15px sans-serif";
  cursorY = wrapText(ctx, content.buildName, x, cursorY, width, 20, 2);
  if (content.positionsText) {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "400 13px sans-serif";
    cursorY = wrapText(ctx, content.positionsText, x, cursorY, width, 18, 1);
  }
  return cursorY - y;
}

function drawGoalAndAlignment(d: DrawContext, x: number, y: number, width: number): number {
  const { ctx, content } = d;
  let cursorY = y;
  ctx.fillStyle = COLORS.text;
  ctx.font = "700 17px sans-serif";
  cursorY = wrapText(ctx, content.primaryGoalLabel, x, cursorY + 17, width, 22, 1);
  if (content.subGoalLabels.length > 0) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "400 13px sans-serif";
    cursorY = wrapText(ctx, content.subGoalLabels.join(" / "), x, cursorY, width, 18, 2);
  }
  cursorY += 6;
  drawBadge(ctx, content.alignmentLabel, x, cursorY - 16, COLORS.surface3, COLORS.text);
  cursorY += 14;
  return cursorY - y;
}

function drawAchievements(d: DrawContext, x: number, y: number, width: number): number {
  const { ctx, content } = d;
  let cursorY = y;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "700 13px sans-serif";
  cursorY += 13;
  if (content.achievementItems.length > 0) {
    ctx.fillStyle = COLORS.text;
    ctx.font = "500 15px sans-serif";
    for (const item of content.achievementItems) {
      cursorY += 22;
      ctx.fillStyle = COLORS.accent;
      ctx.font = "700 15px sans-serif";
      const valueWidth = ctx.measureText(item.valueText).width;
      ctx.fillText(item.valueText, x + width - valueWidth, cursorY);
      ctx.fillStyle = COLORS.text;
      ctx.font = "500 15px sans-serif";
      wrapText(ctx, item.label, x, cursorY, width - valueWidth - 10, 18, 1);
    }
  } else if (content.noAchievementsText) {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "400 14px sans-serif";
    cursorY = wrapText(ctx, content.noAchievementsText, x, cursorY + 18, width, 19, 2) - 4;
  }
  return cursorY - y;
}

function drawFooter(d: DrawContext, x: number, y: number, width: number): number {
  const { ctx, content } = d;
  let cursorY = y;
  if (content.disclaimerTexts.length > 0) {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "400 12px sans-serif";
    for (const t of content.disclaimerTexts.slice(0, 2)) {
      cursorY = wrapText(ctx, t, x, cursorY + 16, width, 16, 2);
    }
  }
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "400 12px sans-serif";
  cursorY = wrapText(ctx, content.footerText, x, cursorY + 16, width, 16, 2);
  return cursorY - y;
}

function drawPortrait(ctx: CanvasRenderingContext2D, content: BuildDiagnosisImageContent) {
  const { width: W, height: H } = BUILD_DIAGNOSIS_IMAGE_SIZES.portrait;
  const pad = 28;
  const x = pad;
  const width = W - pad * 2;
  const d: DrawContext = { ctx, content };

  ctx.fillStyle = COLORS.bgOuter;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, pad / 2, pad / 2, W - pad, H - pad, 18);
  ctx.fill();

  let y = pad + 20;
  y += drawHeader(d, x, y, width) + 6;
  y += drawIdentity(d, x, y, width) + 10;

  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  y += 18;

  y += drawGoalAndAlignment(d, x, y, width) + 8;

  ctx.fillStyle = COLORS.text;
  ctx.font = "600 16px sans-serif";
  y = wrapText(ctx, content.headlineText, x, y + 16, width, 21, 3) + 8;

  y += drawAchievements(d, x, y, width) + 14;

  y += drawLabeledBlock(ctx, content.concernLabel, content.concernText, x, y, width, 3) + 14;
  y += drawLabeledBlock(ctx, content.improvementLabel, content.improvementText, x, y, width, 3) + 14;
  if (content.preserveLabel && content.preserveText) {
    y += drawLabeledBlock(ctx, content.preserveLabel, content.preserveText, x, y, width, 2) + 14;
  }
  if (content.comparison) {
    y += drawComparisonBlock(ctx, content, x, y, width) + 10;
  }

  drawFooter(d, x, H - pad - 56, width);
}

function drawLandscape(ctx: CanvasRenderingContext2D, content: BuildDiagnosisImageContent) {
  const { width: W, height: H } = BUILD_DIAGNOSIS_IMAGE_SIZES.landscape;
  const pad = 26;
  const d: DrawContext = { ctx, content };

  ctx.fillStyle = COLORS.bgOuter;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, pad / 2, pad / 2, W - pad, H - pad, 18);
  ctx.fill();

  const contentX = pad + 16;
  const contentWidth = W - (pad + 16) * 2;
  let headerY = pad + 18;
  headerY += drawHeader(d, contentX, headerY, contentWidth);

  const colGap = 24;
  const leftWidth = Math.round((contentWidth - colGap) * 0.52);
  const rightWidth = contentWidth - colGap - leftWidth;
  const rightX = contentX + leftWidth + colGap;
  const top = headerY + 12;

  // 左列: 選手・目的・適合状態・見出し・成果
  let ly = top;
  ly += drawIdentity(d, contentX, ly, leftWidth) + 8;
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(contentX, ly);
  ctx.lineTo(contentX + leftWidth, ly);
  ctx.stroke();
  ly += 14;
  ly += drawGoalAndAlignment(d, contentX, ly, leftWidth) + 8;
  ctx.fillStyle = COLORS.text;
  ctx.font = "600 15px sans-serif";
  ly = wrapText(ctx, content.headlineText, contentX, ly + 15, leftWidth, 20, 3) + 8;
  ly += drawAchievements(d, contentX, ly, leftWidth);

  // 右列: 注意点・改善・維持・比較・制限
  let ry = top;
  ry += drawLabeledBlock(ctx, content.concernLabel, content.concernText, rightX, ry, rightWidth, 3) + 12;
  ry += drawLabeledBlock(ctx, content.improvementLabel, content.improvementText, rightX, ry, rightWidth, 3) + 12;
  if (content.preserveLabel && content.preserveText) {
    ry += drawLabeledBlock(ctx, content.preserveLabel, content.preserveText, rightX, ry, rightWidth, 2) + 12;
  }
  if (content.comparison) {
    ry += drawComparisonBlock(ctx, content, rightX, ry, rightWidth) + 8;
  }

  drawFooter(d, contentX, H - pad - 44, contentWidth);
}

/** `content`から画像専用の固定サイズPNGを描画する(DOMスクリーンショットではなくゼロから描画)。 */
export function drawBuildDiagnosisCardImage(canvas: HTMLCanvasElement, content: BuildDiagnosisImageContent, orientation: ImageOrientation): void {
  const size = BUILD_DIAGNOSIS_IMAGE_SIZES[orientation];
  canvas.width = size.width * size.scale;
  canvas.height = size.height * size.scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(size.scale, size.scale);
  if (orientation === "portrait") drawPortrait(ctx, content);
  else drawLandscape(ctx, content);
}

export type SaveBuildDiagnosisImageResult = { ok: true } | { ok: false; reason: "ssr" | "unsupported" | "error" };

/** `content`を描画したPNGを`filename`としてユーザー端末へ保存する(squad-diagnosis-image.tsと同じ方式)。 */
export async function saveBuildDiagnosisCardImageAsPng(
  content: BuildDiagnosisImageContent,
  filename: string,
  orientation: ImageOrientation,
): Promise<SaveBuildDiagnosisImageResult> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { ok: false, reason: "ssr" };
  }
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, reason: "unsupported" };
    drawBuildDiagnosisCardImage(canvas, content, orientation);

    const blob = await new Promise<Blob | null>((resolve) => {
      if (typeof canvas!.toBlob === "function") {
        canvas!.toBlob((b) => resolve(b), "image/png");
      } else {
        resolve(null);
      }
    });
    if (blob) return downloadBlob(blob, filename);

    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl || dataUrl === "data:,") return { ok: false, reason: "unsupported" };
    return downloadDataUrl(dataUrl, filename);
  } catch {
    return { ok: false, reason: "error" };
  } finally {
    canvas = null;
  }
}

function downloadBlob(blob: Blob, filename: string): SaveBuildDiagnosisImageResult {
  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;
  try {
    url = URL.createObjectURL(blob);
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  } finally {
    if (anchor && anchor.parentNode) anchor.parentNode.removeChild(anchor);
    if (url) {
      const toRevoke = url;
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(toRevoke);
        } catch {
          /* noop */
        }
      }, 10_000);
    }
  }
}

function downloadDataUrl(dataUrl: string, filename: string): SaveBuildDiagnosisImageResult {
  let anchor: HTMLAnchorElement | null = null;
  try {
    anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  } finally {
    if (anchor && anchor.parentNode) anchor.parentNode.removeChild(anchor);
  }
}
