import type { DiagnosisComparison, ScoreChange, Trend } from "./diagnosis-compare";

/**
 * 改善前後カードのPNG画像（F-043）。表示文字列は呼び出し側が現在の言語で渡す（この関数は翻訳しない）。
 * 内部ID・選手名・スカッド名は描かない（比較結果の点数と種類だけ）。
 */

export const COMPARE_IMAGE_WIDTH = 1080;
export const COMPARE_IMAGE_HEIGHT = 1350;

export interface CompareImageTexts {
  serviceName: string;
  title: string;
  before: string;
  after: string;
  overall: string;
  trend: Record<Trend, string>;
  notRated: string;
  summary: string;
  disclaimer: string;
  categoryLabel: (id: string) => string;
}

const COLORS = {
  bg: "#0a0d10",
  surface: "#141a20",
  text: "#e8edf2",
  dim: "#9aa6b2",
  accent: "#c7f000",
  improved: "#3ecf8e",
  worsened: "#ff6b6b",
  unchanged: "#9aa6b2",
  not_comparable: "#6b7785",
} as const;

function deltaText(c: ScoreChange): string {
  if (c.delta == null) return "—";
  return c.delta > 0 ? `+${c.delta}` : c.delta < 0 ? `−${Math.abs(c.delta)}` : "±0";
}

function scoreText(score: number | null, tier: string | null, notRated: string): string {
  return score == null ? notRated : `${score}${tier ? ` ${tier}` : ""}`;
}

export function drawDiagnosisComparisonImage(canvas: HTMLCanvasElement, cmp: DiagnosisComparison, t: CompareImageTexts): void {
  canvas.width = COMPARE_IMAGE_WIDTH;
  canvas.height = COMPARE_IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const pad = 64;
  const w = COMPARE_IMAGE_WIDTH - pad * 2;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, COMPARE_IMAGE_WIDTH, COMPARE_IMAGE_HEIGHT);
  ctx.textBaseline = "alphabetic";

  let y = pad + 24;
  ctx.fillStyle = COLORS.accent;
  ctx.font = "700 28px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(t.serviceName, pad, y);
  y += 56;
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 48px sans-serif";
  ctx.fillText(t.title, pad, y);
  y += 44;
  ctx.fillStyle = COLORS.dim;
  ctx.font = "400 26px sans-serif";
  ctx.fillText(`${t.before} ${cmp.beforeDate}  →  ${t.after} ${cmp.afterDate}`, pad, y);

  // 総合
  y += 36;
  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(pad, y, w, 150);
  ctx.fillStyle = COLORS.dim;
  ctx.font = "600 28px sans-serif";
  ctx.fillText(t.overall, pad + 28, y + 50);
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 56px sans-serif";
  ctx.fillText(`${scoreText(cmp.overall.before, cmp.overall.beforeTier, t.notRated)}  →  ${scoreText(cmp.overall.after, cmp.overall.afterTier, t.notRated)}`, pad + 28, y + 120);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS[cmp.overall.trend];
  ctx.font = "800 44px sans-serif";
  ctx.fillText(deltaText(cmp.overall), pad + w - 28, y + 70);
  ctx.font = "600 24px sans-serif";
  ctx.fillText(t.trend[cmp.overall.trend], pad + w - 28, y + 112);
  ctx.textAlign = "left";

  // カテゴリ
  y += 186;
  const rowH = 76;
  for (const { id, change } of cmp.categories) {
    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(pad, y, w, rowH - 10);
    ctx.fillStyle = COLORS.text;
    ctx.font = "600 28px sans-serif";
    ctx.fillText(t.categoryLabel(id), pad + 24, y + 44);
    ctx.fillStyle = COLORS.dim;
    ctx.font = "500 26px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${scoreText(change.before, change.beforeTier, t.notRated)} → ${scoreText(change.after, change.afterTier, t.notRated)}`, pad + w - 260, y + 44);
    ctx.fillStyle = COLORS[change.trend];
    ctx.font = "700 28px sans-serif";
    ctx.fillText(`${deltaText(change)} ${t.trend[change.trend]}`, pad + w - 24, y + 44);
    ctx.textAlign = "left";
    y += rowH;
  }

  y += 24;
  ctx.fillStyle = COLORS.dim;
  ctx.font = "500 24px sans-serif";
  ctx.fillText(t.summary, pad, y);
  y += 40;
  ctx.font = "400 20px sans-serif";
  wrap(ctx, t.disclaimer, pad, y, w, 28);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  let line = "";
  let yy = y;
  for (const ch of [...text]) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineHeight;
    } else line = next;
  }
  if (line) ctx.fillText(line, x, yy);
}
