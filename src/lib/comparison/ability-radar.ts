import { COMPARE_CATEGORIES } from "./categories";
import type { StatBreakdown } from "@/lib/progression/types";

/**
 * 能力値レーダーチャートの値算出（純関数）。
 *
 *  - 軸は既存の比較カテゴリ（`COMPARE_CATEGORIES`・7 分類）を再利用。GK 軸はどれかが GK カードのときだけ。
 *  - 各軸の値は「対象能力値の単純平均」。**レーダー専用の独自重みは作らない。**
 *  - ゲーム公式の総合値・ポジション別 OVR・AI 評価ではない（呼び出し側で必ず注記する）。
 *  - 描画用の座標だけを返し、SVG は別（コンポーネントに算式を書かない）。
 */

export type RadarMode = "base" | "progressed" | "standard" | "conditional" | "experimental";

export const RADAR_MODE_LABEL: Record<RadarMode, string> = {
  base: "基礎",
  progressed: "育成後",
  standard: "標準",
  conditional: "条件反映後",
  experimental: "実験",
};

/** 表示モードに応じた 1 能力値の値（既存の StatBreakdown レイヤーからのみ選択）。 */
export function statValueForMode(s: StatBreakdown, mode: RadarMode): number {
  switch (mode) {
    case "base":
      return s.baseValue;
    case "progressed":
      return s.baseValue + s.progressionDelta;
    case "standard":
      return s.standardFinalValue;
    case "conditional":
      return s.conditionalFinalValue;
    case "experimental":
      return s.experimentalFinalValue;
  }
}

export interface RadarAxis {
  id: string;
  label: string;
  shortLabel: string;
  statKeys: string[];
}

const SHORT_LABEL: Record<string, string> = {
  attack: "SHT",
  pass: "PAS",
  dribble: "DRI",
  defense: "DEF",
  physical: "PHY",
  speed: "SPD",
  gk: "GK",
};

export function buildAbilityRadarAxes(includeGk: boolean): RadarAxis[] {
  return COMPARE_CATEGORIES.filter((c) => includeGk || c.id !== "gk").map((c) => ({
    id: c.id,
    label: c.label,
    shortLabel: SHORT_LABEL[c.id] ?? c.label,
    statKeys: c.statKeys,
  }));
}

/** カテゴリ（対象能力値集合）の単純平均（小数第1位）。1 つも取得できなければ null。 */
export function calculateAbilityCategoryAverage(
  stats: StatBreakdown[],
  statKeys: string[],
  mode: RadarMode,
): number | null {
  const byKey = new Map(stats.map((s) => [s.key, s]));
  const vals: number[] = [];
  for (const k of statKeys) {
    const s = byKey.get(k);
    if (!s) continue;
    const v = statValueForMode(s, mode);
    if (Number.isFinite(v)) vals.push(v);
  }
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const r = Math.round(avg * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

export interface RadarSeriesPoint {
  axisId: string;
  /** 単純平均（null = 取得できず・描画は 0 として扱い、代替表では「—」）。 */
  value: number | null;
}

export interface RadarPlayerSeries {
  index: number;
  name: string;
  cardType: string | null;
  worldCardId: string;
  points: RadarSeriesPoint[];
  /** 育成前（基礎値）のカテゴリ平均（「育成前を表示」用）。 */
  prePoints: RadarSeriesPoint[];
}

export interface RadarPlayerInput {
  index: number;
  name: string;
  cardType: string | null;
  worldCardId: string;
  registeredPosition: string | null;
  stats: StatBreakdown[];
}

export interface ComparisonRadarData {
  mode: RadarMode;
  axes: RadarAxis[];
  series: RadarPlayerSeries[];
  /** 目盛りの表示上限（既定 99・実験値等が超えたら丸め上げ・99 へ切り捨てて見せない）。 */
  displayMax: number;
  anyOver99: boolean;
  notes: string[];
  warnings: string[];
}

export function buildComparisonRadarData(
  players: RadarPlayerInput[],
  mode: RadarMode,
): ComparisonRadarData {
  const includeGk = players.some((p) => p.registeredPosition === "GK");
  const axes = buildAbilityRadarAxes(includeGk);

  const series: RadarPlayerSeries[] = players.map((p) => ({
    index: p.index,
    name: p.name,
    cardType: p.cardType,
    worldCardId: p.worldCardId,
    points: axes.map((a) => ({ axisId: a.id, value: calculateAbilityCategoryAverage(p.stats, a.statKeys, mode) })),
    prePoints: axes.map((a) => ({
      axisId: a.id,
      value: calculateAbilityCategoryAverage(p.stats, a.statKeys, "base"),
    })),
  }));

  let maxV = 99;
  for (const s of series) {
    for (const pt of [...s.points, ...s.prePoints]) {
      if (pt.value != null && Number.isFinite(pt.value) && pt.value > maxV) maxV = pt.value;
    }
  }
  const anyOver99 = maxV > 99;
  const displayMax = anyOver99 ? Math.ceil(maxV / 10) * 10 : 99;

  const warnings: string[] = [];
  if (series.some((s) => s.points.some((pt) => pt.value == null))) {
    warnings.push("一部カテゴリの能力値を取得できませんでした（該当軸は代替表で「—」・グラフは 0 として描画）。");
  }
  if (anyOver99) {
    warnings.push(`能力値が 99 を超える系列があります（目盛り上限を ${displayMax} に拡張して描画・正確値は代替表と 26 能力値表を参照）。`);
  }

  return {
    mode,
    axes,
    series,
    displayMax,
    anyOver99,
    notes: [
      `能力値グラフは、現在選択している能力値モード（${RADAR_MODE_LABEL[mode]}）のカテゴリ単純平均を表示しています。`,
      "ゲーム公式の総合値、ポジション別 OVR、AI 評価ではありません。",
      "正確な各能力値は下の 26 能力値表で確認できます。",
    ],
    warnings,
  };
}

/**
 * レーダー頂点の SVG 座標。axisIndex は 0 始まり・上方向（12 時）から時計回り。
 * value は displayMax でクランプして描画（正確値は分離して代替表へ）。
 */
export function radarPointForAxis(
  cx: number,
  cy: number,
  r: number,
  axisIndex: number,
  axisCount: number,
  value: number | null,
  displayMax: number,
): { x: number; y: number } {
  const safeMax = displayMax > 0 ? displayMax : 99;
  const clamped = value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(safeMax, value));
  const frac = clamped / safeMax;
  const angle = -Math.PI / 2 + (axisIndex / Math.max(1, axisCount)) * Math.PI * 2;
  return { x: cx + Math.cos(angle) * r * frac, y: cy + Math.sin(angle) * r * frac };
}
