"use client";

import type { StatBreakdown } from "@/lib/progression/types";
import { statLabelJa, groupLabelJa } from "@/lib/world/stat-labels";
import { statValueForMode, type RadarMode } from "@/lib/comparison/ability-radar";
import { getGroupDef } from "@/lib/progression/stat-groups";
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

/**
 * 選択中の育成カテゴリで変化する能力値を、育成スライダーの近くにコンパクト表示する。
 *  - 対象能力は `stat-groups.ts`（既存定義）を単一の真実源として使う。
 *  - 値は既存 `calculateBuild` の結果（StatBreakdown）から。fixed booster / Power of Many /
 *    監督補正 / 育成値を混同しない（列で分離）。
 *  - 育成前（基礎値）→ 現在（選択モードの値）→ 差 を並べ、他の比較選手との差も出す。
 */

export interface CategoryPreviewSeries {
  index: number;
  name: string;
  stats: StatBreakdown[];
  groupLevel: number;
  pointsUsed: number;
  pointsRemaining: number;
}

function fmt1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toFixed(r % 1 === 0 ? 0 : 1);
}
function signed(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "±0";
  return (r > 0 ? "+" : "") + fmt1(r);
}

export function CompareCategoryPreview({
  groupId,
  mode,
  series,
}: {
  groupId: string;
  mode: RadarMode;
  series: CategoryPreviewSeries[];
}) {
  const t = useT();
  const tcp = (k: keyof Dictionary["compareCategoryPreview"]) => t("compareCategoryPreview", k);
  const fillCp = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const RADAR_MODE_LABEL = useRadarModeLabels();
  const g = getGroupDef(groupId);
  if (!g) return null;
  const label = groupLabelJa(groupId);

  return (
    <div className="rounded border border-border bg-surface-2/30 p-2 text-2xs">
      <p className="mb-1 font-semibold">
        {fillCp(tcp("headingTemplate"), { label, mode: RADAR_MODE_LABEL[mode] })}
        <span className="ml-1 font-normal text-text-muted">{tcp("headingHint")}</span>
      </p>

      <div className="flex flex-col gap-1.5">
        {g.affectedStats.map((k) => {
          const nameJa = statLabelJa(k);
          return (
            <div key={k}>
              <p className="text-text-dim">{nameJa}</p>
              <div className="mt-0.5 grid gap-x-2 gap-y-0.5" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0,1fr))` }}>
                {series.map((s) => {
                  const st = s.stats.find((x) => x.key === k);
                  if (!st) {
                    return (
                      <span key={s.index} className="text-text-muted">
                        {fillCp(tcp("noInfoTemplate"), { index: String(s.index + 1) })}
                      </span>
                    );
                  }
                  const before = st.baseValue;
                  const now = statValueForMode(st, mode);
                  const diff = now - before;
                  return (
                    <span
                      key={s.index}
                      className="tabular-nums"
                      aria-label={fillCp(tcp("valueAriaLabelTemplate"), {
                        index: String(s.index + 1),
                        name: nameJa,
                        before: fmt1(before),
                        now: fmt1(now),
                        diff: signed(diff),
                      })}
                    >
                      <span className="text-text-muted">{fillCp(tcp("personPrefixTemplate"), { index: String(s.index + 1) })}</span>
                      {fmt1(before)} → <b className="text-text">{fmt1(now)}</b>{" "}
                      <span className={diff > 0 ? "text-accent" : diff < 0 ? "text-danger" : "text-text-muted"}>
                        ({signed(diff)})
                      </span>
                    </span>
                  );
                })}
              </div>
              {series.length === 2 ? (
                <p className="mt-0.5 text-text-muted">
                  {tcp("diffLabelTemplate")}
                  {(() => {
                    const a = series[0].stats.find((x) => x.key === k);
                    const b = series[1].stats.find((x) => x.key === k);
                    if (!a || !b) return "—";
                    return signed(statValueForMode(a, mode) - statValueForMode(b, mode));
                  })()}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-text-muted">
        {series.map((s) => (
          <span key={s.index}>
            {fillCp(tcp("statusLineTemplate"), {
              index: String(s.index + 1),
              label,
              level: String(s.groupLevel),
              used: String(s.pointsUsed),
              remaining: String(s.pointsRemaining),
            })}
          </span>
        ))}
      </div>

      <p className="mt-1 text-[9px] text-text-muted">{tcp("footnote")}</p>
    </div>
  );
}
