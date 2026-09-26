import type { SquadDiagnosisShareData, SquadDiagnosisShareCategory, SquadDiagnosisShareFinding } from "./squad-diagnosis-share";
import type { SquadDiagnosisTier } from "./squad-diagnosis";
import type { Locale } from "@/lib/i18n/locale";
import { formatDateTime } from "@/lib/i18n/format";

/** カテゴリID→英語ラベル（表示専用。squad-diagnosis.tsのcategory.labelは変更しない）。 */
export const CATEGORY_LABEL_EN: Record<string, string> = {
  attack: "Attack",
  defense: "Defense",
  aerial: "Aerial",
  speed: "Speed",
  passBuildUp: "Pass & Build-up",
  dribblePossession: "Dribbling & Possession",
  pressResistance: "Press Resistance",
  counterAttack: "Counter-attack",
  squadCompleteness: "Squad Placement Completeness",
};

const IMAGE_TEXT = {
  ja: {
    heading: "スカッド診断（スカッド構成評価）",
    formationPrefix: "フォーメーション: ",
    overallScore: "総合評価",
    perHundred: "/100",
    tierPrefix: "評価 ",
    notRated: "判定対象外",
    ratedCategoriesPrefix: "判定可能カテゴリ: ",
    topStrengthHeading: "代表的な長所",
    topWeaknessHeading: "代表的な弱点",
    none: "該当なし",
    disclaimer: null,
  },
  en: {
    heading: "Squad Diagnosis (Squad Build Evaluation)",
    formationPrefix: "Formation: ",
    overallScore: "Overall Rating",
    perHundred: "/100",
    tierPrefix: "Grade ",
    notRated: "Not rated",
    ratedCategoriesPrefix: "Rated categories: ",
    topStrengthHeading: "Top Strength",
    topWeaknessHeading: "Top Weakness",
    none: "None",
    disclaimer:
      "A build evaluation based on registered data. It does not guarantee match results, national rankings, or win rates.",
  },
} as const satisfies Record<
  Locale,
  {
    heading: string;
    formationPrefix: string;
    overallScore: string;
    perHundred: string;
    tierPrefix: string;
    notRated: string;
    ratedCategoriesPrefix: string;
    topStrengthHeading: string;
    topWeaknessHeading: string;
    none: string;
    /** null（既定のja）のときは`data.disclaimer`（squad-diagnosis-share.tsの既存文言）をそのまま使う。 */
    disclaimer: string | null;
  }
>;

/** カテゴリ起因（categoryIdあり）のfindingは英語ラベルを再構成し、選手名を含む可能性のあるfindingは
 * 安全のため日本語のまま表示する（表示言語が英語でも、選手名を含む自由文を推測で英訳しない）。 */
function findingLabelForImage(finding: SquadDiagnosisShareFinding, locale: Locale): string {
  if (locale === "en" && finding.categoryId) {
    return CATEGORY_LABEL_EN[finding.categoryId] ?? finding.label;
  }
  return finding.label;
}

function categoryLabelForImage(category: SquadDiagnosisShareCategory, locale: Locale): string {
  return locale === "en" ? CATEGORY_LABEL_EN[category.id] ?? category.label : category.label;
}

/**
 * スカッド診断結果のPNG画像化。
 *
 * - 既存プロジェクトに画像生成ライブラリ（html2canvas 等）が存在しないため、新規依存を追加せず
 *   ブラウザー標準の Canvas 2D API だけで完結させる（DOM のスクリーンショットではなく、
 *   安全なデータ（`SquadDiagnosisShareData`）だけを元に **ゼロから描画**するため、ボタン等の操作UI・
 *   画面外の内部情報が写り込む余地が構造的にない）。
 * - 生成した `<canvas>` は DOM へ追加しない（オフスクリーン）。ダウンロード用の一時 `<a>` と
 *   Object URL は使用後に解放する（`browser-download.ts` と同じ後始末方針）。
 * - 同じ `SquadDiagnosisShareData` からは常に同じ内容を描画する（Math.random 不使用）。
 */

// globals.css のダークテーマ配色（CSS変数は canvas から直接参照できないため、同値を明示的に複製する。
// テーマの配色を変更した場合はここも合わせて更新すること）。
const COLORS = {
  bgOuter: "#090c0f",
  surface: "#12171c",
  surface2: "#1a2129",
  surface3: "#232d37",
  border: "#2a343d",
  borderStrong: "#3a4753",
  text: "#eef1f3",
  textDim: "#9aa6b0",
  textMuted: "#616d77",
  accent: "#c7f000",
  accentInk: "#0a0d10",
  success: "#63d14d",
  warning: "#f4c250",
  danger: "#ff5a5a",
  info: "#5cb8e6",
};

function tierColor(tier: SquadDiagnosisTier | null): string {
  switch (tier) {
    case "S":
      return COLORS.success;
    case "A":
      return COLORS.info;
    case "B":
      return COLORS.textDim;
    case "C":
      return COLORS.warning;
    case "D":
      return COLORS.danger;
    default:
      return COLORS.textMuted;
  }
}

/** 論理サイズ（px）。過剰に高解像度にしないため devicePixelRatio ではなく固定の倍率でスケールする。 */
export const SQUAD_DIAGNOSIS_IMAGE_WIDTH = 720;
export const SQUAD_DIAGNOSIS_IMAGE_HEIGHT = 960;
/** 最終PNGの解像度倍率（1440x1920 相当・SNS共有カードとして一般的な範囲に収める）。 */
export const SQUAD_DIAGNOSIS_IMAGE_SCALE = 2;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split("");
  let line = "";
  let lines = 0;
  let cursorY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i];
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      if (lines === maxLines - 1) {
        // 最終行は省略記号で打ち切る（レイアウト破綻を避ける）。
        let truncated = line;
        while (truncated.length > 0 && ctx.measureText(truncated + "…").width > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + "…", x, cursorY);
        return cursorY + lineHeight;
      }
      ctx.fillText(line, x, cursorY);
      line = words[i];
      cursorY += lineHeight;
      lines++;
    } else {
      line = test;
    }
  }
  if (line.length > 0) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

function drawCategoryRow(
  ctx: CanvasRenderingContext2D,
  c: SquadDiagnosisShareCategory,
  x: number,
  y: number,
  width: number,
  locale: Locale,
) {
  const rowHeight = 44;
  const text = IMAGE_TEXT[locale];
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  ctx.font = "600 20px sans-serif";
  ctx.fillText(categoryLabelForImage(c, locale), x, y + rowHeight / 2 - 8);

  const barX = x;
  const barY = y + rowHeight / 2 + 8;
  const barWidth = width - 120;
  const barHeight = 10;
  ctx.fillStyle = COLORS.surface3;
  roundRect(ctx, barX, barY, barWidth, barHeight, 5);
  ctx.fill();

  if (c.score != null) {
    const fillWidth = Math.max(6, (barWidth * c.score) / 100);
    ctx.fillStyle = tierColor(c.tier);
    roundRect(ctx, barX, barY, fillWidth, barHeight, 5);
    ctx.fill();

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 20px sans-serif";
    ctx.fillText(`${c.score}`, x + width - 46, y + rowHeight / 2 - 8);
    ctx.font = "700 14px sans-serif";
    ctx.fillStyle = tierColor(c.tier);
    ctx.fillText(c.tier ?? "-", x + width, y + rowHeight / 2 - 8);
  } else {
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "600 15px sans-serif";
    ctx.fillText(text.notRated, x + width, y + rowHeight / 2 - 8);
  }
  ctx.textAlign = "left";
  return rowHeight;
}

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

/** Intl標準APIで作成日時を表示言語に応じて整形する（能力値・スコア等の内部保存形式は変更しない）。 */
function formatGeneratedAt(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const formatted = formatDateTime(d, locale);
  return locale === "en" ? `Created ${formatted}` : `${formatted} 作成`;
}

/** `data` から診断結果カードを描画する（ゼロから描画・DOMスクリーンショットではない）。
 * `locale` 省略時は`"ja"`（既存呼び出し・既存テストと完全互換）。 */
export function drawSquadDiagnosisImage(canvas: HTMLCanvasElement, data: SquadDiagnosisShareData, locale: Locale = "ja"): void {
  const text = IMAGE_TEXT[locale];
  const W = SQUAD_DIAGNOSIS_IMAGE_WIDTH;
  const H = SQUAD_DIAGNOSIS_IMAGE_HEIGHT;
  const scale = SQUAD_DIAGNOSIS_IMAGE_SCALE;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  // 背景（透明にしない・読みにくくならないよう常に不透明な単色）。
  ctx.fillStyle = COLORS.bgOuter;
  ctx.fillRect(0, 0, W, H);
  const pad = 32;
  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, pad / 2, pad / 2, W - pad, H - pad, 16);
  ctx.fill();

  let y = pad + 16;
  const x = pad + 16;
  const contentWidth = W - (pad + 16) * 2;

  // ヘッダー: サービス名 + 作成日時
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.accent;
  ctx.font = "700 16px sans-serif";
  ctx.fillText(data.serviceName, x, y);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "400 13px sans-serif";
  ctx.fillText(formatGeneratedAt(data.generatedAtIso, locale), x + contentWidth, y);
  ctx.textAlign = "left";
  y += 30;

  // タイトル
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "600 14px sans-serif";
  ctx.fillText(text.heading, x, y);
  y += 34;

  // チーム名（長い場合は折り返し・最大2行）
  ctx.fillStyle = COLORS.text;
  ctx.font = "700 30px sans-serif";
  y = wrapText(ctx, data.squadName, x, y, contentWidth, 36, 2) - 6;

  // フォーメーション
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "500 16px sans-serif";
  ctx.fillText(`${text.formationPrefix}${data.formationLabel}`, x, y);
  y += 30;

  // 総合評価
  ctx.fillStyle = COLORS.surface2;
  roundRect(ctx, x, y, contentWidth, 96, 12);
  ctx.fill();
  const scoreBoxY = y + 20;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "600 14px sans-serif";
  ctx.fillText(text.overallScore, x + 20, scoreBoxY);
  ctx.fillStyle = COLORS.accent;
  ctx.font = "800 48px sans-serif";
  const scoreText = data.overallScore != null ? `${data.overallScore}` : "—";
  ctx.fillText(scoreText, x + 20, scoreBoxY + 46);
  const scoreTextWidth = ctx.measureText(scoreText).width;
  if (data.overallScore != null) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "500 18px sans-serif";
    ctx.fillText(text.perHundred, x + 26 + scoreTextWidth, scoreBoxY + 46);
  }
  if (data.overallTier) {
    const tierX = x + contentWidth - 150;
    ctx.fillStyle = tierColor(data.overallTier);
    roundRect(ctx, tierX, scoreBoxY - 4, 90, 40, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.accentInk;
    ctx.font = "800 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${text.tierPrefix}${data.overallTier}`, tierX + 45, scoreBoxY + 22);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "600 16px sans-serif";
    ctx.fillText(text.notRated, x + contentWidth - 150, scoreBoxY + 20);
  }
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "400 13px sans-serif";
  ctx.fillText(`${text.ratedCategoriesPrefix}${data.ratedCategoryCount} / ${data.totalCategoryCount}`, x + 20, y + 84);
  y += 96 + 20;

  // カテゴリ一覧
  for (const c of data.categories) {
    y += drawCategoryRow(ctx, c, x, y, contentWidth, locale);
  }
  y += 8;

  // 長所・弱点
  const colWidth = (contentWidth - 16) / 2;
  const findingTop = y;
  const findingHeight = 120;
  ctx.fillStyle = COLORS.surface2;
  roundRect(ctx, x, findingTop, colWidth, findingHeight, 10);
  ctx.fill();
  roundRect(ctx, x + colWidth + 16, findingTop, colWidth, findingHeight, 10);
  ctx.fill();

  ctx.fillStyle = COLORS.success;
  ctx.font = "700 14px sans-serif";
  ctx.fillText(text.topStrengthHeading, x + 16, findingTop + 26);
  ctx.fillStyle = COLORS.danger;
  ctx.fillText(text.topWeaknessHeading, x + colWidth + 32, findingTop + 26);

  ctx.fillStyle = COLORS.text;
  ctx.font = "600 16px sans-serif";
  if (data.topStrength) {
    wrapText(ctx, findingLabelForImage(data.topStrength, locale), x + 16, findingTop + 52, colWidth - 32, 22, 3);
  } else {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "400 14px sans-serif";
    ctx.fillText(text.none, x + 16, findingTop + 52);
  }
  ctx.fillStyle = COLORS.text;
  ctx.font = "600 16px sans-serif";
  if (data.topWeakness) {
    wrapText(ctx, findingLabelForImage(data.topWeakness, locale), x + colWidth + 32, findingTop + 52, colWidth - 32, 22, 3);
  } else {
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "400 14px sans-serif";
    ctx.fillText(text.none, x + colWidth + 32, findingTop + 52);
  }
  y = findingTop + findingHeight + 20;

  // 免責文言（英語は固定の短い英訳を使用。ja側は既存のdata.disclaimerをそのまま使う＝無変更）。
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "400 13px sans-serif";
  wrapText(ctx, text.disclaimer ?? data.disclaimer, x, y, contentWidth, 18, 3);
}

export type SaveSquadDiagnosisImageResult =
  | { ok: true }
  | { ok: false; reason: "ssr" | "unsupported" | "error" };

/**
 * `data` を描画したPNG画像を、`filename` としてユーザー端末へ保存する。
 * SSR・非対応ブラウザー・例外時も画面をクラッシュさせず、失敗理由付きで返す。
 * `locale` 省略時は`"ja"`（既存呼び出し・既存テストと完全互換）。
 */
export async function saveSquadDiagnosisImageAsPng(
  data: SquadDiagnosisShareData,
  filename: string,
  locale: Locale = "ja",
): Promise<SaveSquadDiagnosisImageResult> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { ok: false, reason: "ssr" };
  }

  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement("canvas"); // DOM には追加しない（オフスクリーン）
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, reason: "unsupported" };
    drawSquadDiagnosisImage(canvas, data, locale);

    const blob = await new Promise<Blob | null>((resolve) => {
      if (typeof canvas!.toBlob === "function") {
        canvas!.toBlob((b) => resolve(b), "image/png");
      } else {
        resolve(null);
      }
    });

    if (blob) {
      return await downloadBlob(blob, filename);
    }

    // toBlob 非対応環境向けの最終手段: dataURL 経由（それでも失敗すれば error を返す）。
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl || dataUrl === "data:,") return { ok: false, reason: "unsupported" };
    return downloadDataUrl(dataUrl, filename);
  } catch {
    return { ok: false, reason: "error" };
  } finally {
    canvas = null;
  }
}

function downloadBlob(blob: Blob, filename: string): SaveSquadDiagnosisImageResult {
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

function downloadDataUrl(dataUrl: string, filename: string): SaveSquadDiagnosisImageResult {
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
