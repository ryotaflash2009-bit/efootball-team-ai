"use client";

import type { ComparisonRadarData, RadarMode } from "@/lib/comparison/ability-radar";
import { radarPointForAxis } from "@/lib/comparison/ability-radar";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

function useRadarModeLabels(): Record<RadarMode, string> {
  const t = useT();
  return {
    base: t("radarMode", "base"),
    progressed: t("radarMode", "progressed"),
    standard: t("radarMode", "standard"),
    conditional: t("radarMode", "conditional"),
    experimental: t("radarMode", "experimental"),
  };
}

function useRadarAxisLabel() {
  const t = useT();
  return (categoryId: string) => t("radarAxis", categoryId as keyof Dictionary["radarAxis"]) || categoryId;
}

/**
 * 能力値レーダーチャート（アクセシブルな純 SVG・新規 npm なし）。
 *  - 値は `ability-radar.ts` が既存の能力値レイヤーから算出（カテゴリ単純平均）。
 *  - 系列は色だけでなく **線種＋点の形＋凡例テキスト** で区別する。
 *  - グラフだけに情報を閉じ込めない: 直下にカテゴリ値の数値代替表と注記を必ず出す。
 *  - ゲーム公式評価・ポジション別 OVR ではない（注記で明示）。
 */

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 34;
const RINGS = [0.25, 0.5, 0.75, 1];

/** A/B/C/D の見分け（色＋線種＋点の形）。色覚に依存しない。 */
function useSeriesStyle() {
  const t = useT();
  return [
    { color: "var(--color-accent, #a3e635)", dash: "0", marker: "circle", label: t("compareRadarChart", "seriesStyleSolid") },
    { color: "#e0a43b", dash: "6 4", marker: "square", label: t("compareRadarChart", "seriesStyleDashedSquare") },
    { color: "#4aa3ff", dash: "2 4", marker: "triangle", label: t("compareRadarChart", "seriesStyleDottedTriangle") },
    { color: "#d878e0", dash: "8 3 2 3", marker: "diamond", label: t("compareRadarChart", "seriesStyleDashDotDiamond") },
  ] as const;
}

function markerPath(kind: string, x: number, y: number, s = 3.2): string {
  switch (kind) {
    case "square":
      return `M ${x - s} ${y - s} h ${2 * s} v ${2 * s} h ${-2 * s} Z`;
    case "triangle":
      return `M ${x} ${y - s * 1.2} L ${x + s * 1.1} ${y + s} L ${x - s * 1.1} ${y + s} Z`;
    case "diamond":
      return `M ${x} ${y - s * 1.3} L ${x + s * 1.1} ${y} L ${x} ${y + s * 1.3} L ${x - s * 1.1} ${y} Z`;
    default:
      return `M ${x} ${y} m ${-s} 0 a ${s} ${s} 0 1 0 ${2 * s} 0 a ${s} ${s} 0 1 0 ${-2 * s} 0`;
  }
}

function polygon(
  data: ComparisonRadarData,
  values: { axisId: string; value: number | null }[],
): string {
  return data.axes
    .map((a, i) => {
      const v = values.find((p) => p.axisId === a.id)?.value ?? null;
      const pt = radarPointForAxis(CX, CY, R, i, data.axes.length, v, data.displayMax);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(" ");
}

export function CompareRadarChart({
  data,
  mode,
  onModeChange,
  showPreBuild,
  onTogglePreBuild,
  activeIndex,
  modeOptions,
  hasManagerAny,
}: {
  data: ComparisonRadarData;
  mode: RadarMode;
  onModeChange: (m: RadarMode) => void;
  showPreBuild: boolean;
  onTogglePreBuild: () => void;
  /** 「育成前を表示」で細線を出す対象（アクティブ選手）。 */
  activeIndex: number;
  modeOptions: RadarMode[];
  hasManagerAny: boolean;
}) {
  const t = useT();
  const tcr = (k: keyof Dictionary["compareRadarChart"]) => t("compareRadarChart", k);
  const fillCr = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const RADAR_MODE_LABEL = useRadarModeLabels();
  const radarAxisLabel = useRadarAxisLabel();
  const SERIES_STYLE = useSeriesStyle();
  const axisCount = data.axes.length;

  const altLines = data.series
    .map((s) =>
      fillCr(tcr("altLinePersonTemplate"), { index: String(s.index + 1), name: s.name, cardType: s.cardType ?? "?" }) +
      data.axes
        .map((a) => {
          const v = s.points.find((p) => p.axisId === a.id)?.value;
          return `${radarAxisLabel(a.id)} ${v == null ? "—" : v.toFixed(1)}`;
        })
        .join(" / "),
    )
    .join("。 ");

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-2xs">
        <span className="font-semibold text-text-dim">{tcr("graphDisplayLabel")}</span>
        {modeOptions.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onModeChange(m)}
            className={`min-h-[28px] rounded border px-2 py-0.5 ${
              mode === m ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"
            }`}
          >
            {RADAR_MODE_LABEL[m]}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1">
          <input type="checkbox" checked={showPreBuild} onChange={onTogglePreBuild} />
          {fillCr(tcr("showPreBuildTemplate"), {
            target:
              data.series[activeIndex]?.index != null
                ? fillCr(tcr("personOrdinalTemplate"), { n: String(data.series[activeIndex].index + 1) })
                : tcr("showPreBuildFallback"),
          })}
        </label>
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-[320px] motion-safe:transition-none"
        role="img"
        aria-label={fillCr(tcr("chartAriaLabelTemplate"), { mode: RADAR_MODE_LABEL[mode], altLines })}
      >
        {/* グリッド */}
        {RINGS.map((f) => (
          <polygon
            key={f}
            points={data.axes
              .map((_, i) => {
                const pt = radarPointForAxis(CX, CY, R, i, axisCount, data.displayMax * f, data.displayMax);
                return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
              })
              .join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
          />
        ))}
        {/* 軸線 + ラベル */}
        {data.axes.map((a, i) => {
          const end = radarPointForAxis(CX, CY, R, i, axisCount, data.displayMax, data.displayMax);
          const lbl = radarPointForAxis(CX, CY, R + 16, i, axisCount, data.displayMax, data.displayMax);
          return (
            <g key={a.id}>
              <line x1={CX} y1={CY} x2={end.x} y2={end.y} stroke="currentColor" className="text-border" strokeWidth="1" />
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-text-dim text-[8px] font-semibold"
              >
                {radarAxisLabel(a.id)}
              </text>
            </g>
          );
        })}

        {/* 育成前（アクティブ選手・細い灰色） */}
        {showPreBuild && data.series[activeIndex] ? (
          <polygon
            points={polygon(data, data.series[activeIndex].prePoints)}
            fill="none"
            stroke="currentColor"
            className="text-text-muted"
            strokeWidth="1"
            strokeDasharray="1 3"
          />
        ) : null}

        {/* 系列 */}
        {data.series.map((s) => {
          const st = SERIES_STYLE[s.index % SERIES_STYLE.length];
          const pts = polygon(data, s.points);
          return (
            <g key={s.worldCardId + s.index}>
              <polygon
                points={pts}
                fill={st.color}
                fillOpacity={0.08}
                stroke={st.color}
                strokeWidth={s.index === activeIndex ? 2.4 : 1.6}
                strokeDasharray={st.dash}
              />
              {data.axes.map((a, i) => {
                const v = s.points.find((p) => p.axisId === a.id)?.value ?? null;
                const pt = radarPointForAxis(CX, CY, R, i, axisCount, v, data.displayMax);
                return <path key={a.id} d={markerPath(st.marker, pt.x, pt.y)} fill={st.color} />;
              })}
            </g>
          );
        })}
      </svg>

      {/* 凡例（色に依存しない） */}
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-2xs">
        {data.series.map((s) => {
          const st = SERIES_STYLE[s.index % SERIES_STYLE.length];
          return (
            <li key={s.worldCardId + s.index} className="flex items-center gap-1">
              <svg width="22" height="10" aria-hidden="true">
                <line x1="1" y1="5" x2="21" y2="5" stroke={st.color} strokeWidth="2" strokeDasharray={st.dash} />
                <path d={markerPath(st.marker, 11, 5, 2.6)} fill={st.color} />
              </svg>
              <span className={s.index === activeIndex ? "font-semibold text-accent" : "text-text-dim"}>
                {fillCr(tcr("legendPersonTemplate"), { index: String(s.index + 1), name: s.name, cardType: s.cardType ?? "?", styleLabel: st.label })}
              </span>
            </li>
          );
        })}
      </ul>

      {/* 数値代替表（色覚・Canvas に依存しない正確値） */}
      <details className="rounded border border-border bg-surface-2/30 p-1.5 text-2xs">
        <summary className="cursor-pointer font-semibold text-text-dim">
          {fillCr(tcr("categoryValuesSummaryTemplate"), { mode: RADAR_MODE_LABEL[mode] })}
        </summary>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="py-0.5 pr-2 font-medium">{tcr("playerHeader")}</th>
                {data.axes.map((a) => (
                  <th key={a.id} className="py-0.5 pr-2 text-right font-medium" title={a.label}>
                    {radarAxisLabel(a.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.series.map((s) => (
                <tr key={s.worldCardId + s.index} className="border-t border-border/40">
                  <td className="py-0.5 pr-2 text-text-dim">
                    {s.index + 1}. {s.name}
                  </td>
                  {data.axes.map((a) => {
                    const v = s.points.find((p) => p.axisId === a.id)?.value;
                    return (
                      <td key={a.id} className="py-0.5 pr-2 text-right tabular-nums">
                        {v == null ? "—" : v.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <figcaption className="text-[9px] leading-tight text-text-muted">
        {data.notes.map((n, i) => (
          <span key={i} className="block">
            {n}
          </span>
        ))}
        {hasManagerAny ? <span className="block">{tcr("managerNote")}</span> : null}
        {data.warnings.map((w, i) => (
          <span key={`w${i}`} className="block text-warning">
            {w}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
