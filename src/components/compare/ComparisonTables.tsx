"use client";

import "@/lib/i18n/dictionaries/ja-ns/abilityEditor";
import "@/lib/i18n/dictionaries/ja-ns/basePercentile";
import "@/lib/i18n/dictionaries/ja-ns/compareCategory";
import "@/lib/i18n/dictionaries/ja-ns/comparisonTables";
import "@/lib/i18n/dictionaries/ja-ns/squadBuildPanel";
import { useState } from "react";
import type { ComparisonPlayerInput, ComparisonResult } from "@/lib/comparison/types";
import { StatBadge } from "@/components/world/StatBadge";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { WORLD_STAT_GROUP_LABELS } from "@/lib/world/stats";
import type { WorldStatGroup } from "@/lib/world/types";
const GROUP_LABEL_KEY = { offense: "groupOffense", defense: "groupDefense", physical: "groupPhysical", gk: "groupGk" } as const;
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { localizeLibText } from "@/lib/progression/lib-text-en";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { Badge } from "@/components/ui/Badge";
import { useWorldBasePercentiles } from "@/lib/percentiles/use-world-base-percentiles";
import { cardBasePercentiles, type CardPercentile } from "@/lib/percentiles/card-percentiles";
import { BUCKET_LABEL_KEY } from "@/components/world/WorldBasePercentilePanel";

function useShortName() {
  const t = useT();
  const { locale } = useLocale();
  return (p: ComparisonPlayerInput) =>
    resolvePlayerDisplayName(p.display, locale, t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", p.display.worldCardId));
}

/** 育成/選手B/監督 のデルタを小さく表示 */
function DeltaBits({
  prog,
  pB,
  mB,
  cB = 0,
}: {
  prog: number;
  pB: number;
  mB: number;
  cB?: number;
}) {
  const t = useT();
  const tct = (k: keyof Dictionary["comparisonTables"]) => t("comparisonTables", k);
  const parts: string[] = [];
  if (prog) parts.push(`${tct("deltaProgressionPrefix")}${prog > 0 ? "+" : ""}${prog}`);
  if (pB) parts.push(`${tct("deltaPlayerBoosterPrefix")}${pB > 0 ? "+" : ""}${pB}`);
  if (cB) parts.push(`${tct("deltaConditionalPrefix")}${cB > 0 ? "+" : ""}${cB}`);
  if (mB) parts.push(`${tct("deltaManagerBoosterPrefix")}${mB > 0 ? "+" : ""}${mB}`);
  if (parts.length === 0) return null;
  return <span className="ms-1 text-[9px] text-lime-300/80">{parts.join(" ")}</span>;
}

export function ComparisonTables({
  comparison,
  players,
}: {
  comparison: ComparisonResult;
  players: ComparisonPlayerInput[];
}) {
  const t = useT();
  const tct = (k: keyof Dictionary["comparisonTables"]) => t("comparisonTables", k);
  const fillCt = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const { locale } = useLocale();
  const shortName = useShortName();
  const categoryLabel = (id: string) => t("compareCategory", id as keyof Dictionary["compareCategory"]);
  const n = players.length;
  const [conditionalView, setConditionalView] = useState(false);
  // F-071: 基礎能力値（育成前）のパーセンタイル。全選手を同じ範囲（全 World カード）で比べる。
  const [showPercentile, setShowPercentile] = useState(false);
  const percentileData = useWorldBasePercentiles(showPercentile);
  const percentiles: (Map<string, CardPercentile> | null)[] = players.map((p) => {
    if (!showPercentile || percentileData.state !== "ready") return null;
    const missing = new Set(p.card.missingBaseStatKeys ?? []);
    const stats = Object.entries(p.card.baseStats)
      .filter(([k]) => !missing.has(k))
      .map(([key, value]) => ({ key, value }));
    return cardBasePercentiles(percentileData.scopes.get("all"), stats);
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (g: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const groups = Array.from(new Set(comparison.stats.map((s) => s.group)));

  return (
    <div className="flex flex-col gap-5">
      {/* 規則メタ */}
      <div className="rounded-md border border-border bg-surface-2/40 p-2 text-[11px] text-text-dim">
        {tct("rulesLabel")}
        {comparison.rulesVersion} ／ {tct("estimatedOvrLabel")}
        {comparison.estimatedOvrByPlayer.map((v, i) => `${shortName(players[i])} ${v ?? "—"}`).join(" / ")}
        <p className="mt-1 text-info">
          {tct("boosterModePrefix")}
          <b>{tct("boosterModeStandard")}</b>
          {tct("boosterModeNoteSuffix")}
        </p>
        <ul className="mt-1 list-disc ps-4">
          {comparison.warnings.map((w, i) => (
            <li key={i}>{localizeLibText(w, locale)}</li>
          ))}
        </ul>
      </div>

      {/* 基本情報 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">{tct("basicInfoHeading")}</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="bg-surface-2/50 text-start [:where(&)_th]:text-start text-xs">
                <th className="sticky left-0 z-10 bg-surface-2/50 px-3 py-2 font-medium">{tct("itemHeader")}</th>
                {players.map((p, i) => (
                  <th key={i} className="px-2 py-2 text-center font-medium">
                    {shortName(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.basicInfo.map((row) => (
                <tr key={row.label} className="border-t border-border/60">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-text-dim">{localizeLibText(row.label, locale)}</td>
                  {row.perPlayer.map((v, i) => (
                    <td key={i} className="px-2 py-1.5 text-center">
                      {v ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[10px] text-text-dim/70">
          {tct("positionMatchLabel")}
          {comparison.positionMatch ? tct("yes") : tct("no")}
        </p>
      </section>

      {/* カテゴリ（単純合計/平均） */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          {tct("categoryHeading")} <span className="text-[10px] font-normal text-text-dim">{tct("categoryHeadingHint")}</span>
        </h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="bg-surface-2/50 text-start [:where(&)_th]:text-start text-xs">
                <th className="sticky left-0 z-10 bg-surface-2/50 px-3 py-2 font-medium">{tct("categoryHeader")}</th>
                {players.map((p, i) => (
                  <th key={i} className="px-2 py-2 text-center font-medium">
                    {shortName(p)}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium">{tct("diffHeader")}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.categories.map((c) => {
                const max = Math.max(...c.totalByPlayer);
                return (
                  <tr key={c.category} className="border-t border-border/60">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-text-dim">{categoryLabel(c.categoryId)}</td>
                    {c.totalByPlayer.map((tv, i) => (
                      <td key={i} className={`px-2 py-1.5 text-center tabular-nums ${tv === max && c.spread > 0 ? "font-bold text-accent" : ""}`}>
                        {tv}
                        <span className="ms-1 text-[10px] text-text-dim">{fillCt(tct("avgTemplate"), { value: String(c.avgByPlayer[i]) })}</span>
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center tabular-nums text-text-dim">{c.spread}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-border bg-surface-2/30">
                <td className="sticky left-0 z-10 bg-surface-2/30 px-3 py-1.5 font-semibold">{tct("totalRowLabel")}</td>
                {comparison.totalStatByPlayer.map((tv, i) => {
                  const max = Math.max(...comparison.totalStatByPlayer);
                  return (
                    <td key={i} className={`px-2 py-1.5 text-center font-bold tabular-nums ${tv === max ? "text-accent" : ""}`}>
                      {tv}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center tabular-nums text-text-dim">
                  {Math.max(...comparison.totalStatByPlayer) - Math.min(...comparison.totalStatByPlayer)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 26能力値 */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{tct("abilitiesHeading")}</h2>
          {comparison.hasAnyConditionalSelection ? (
            <label className="flex min-h-[24px] cursor-pointer items-center gap-1.5 text-[11px] text-accent">
              <input
                type="checkbox"
                checked={conditionalView}
                onChange={(e) => setConditionalView(e.target.checked)}
                className="accent-[color:var(--color-accent)]"
              />
              {tct("conditionalToggleLabel")}
            </label>
          ) : null}
          <label className="flex min-h-[24px] cursor-pointer items-center gap-1.5 text-[11px] text-text-dim">
            <input
              type="checkbox"
              checked={showPercentile}
              onChange={(e) => setShowPercentile(e.target.checked)}
              className="accent-[color:var(--color-accent)]"
              data-testid="compare-percentile-toggle"
            />
            {t("basePercentile", "compareToggle")}
          </label>
        </div>
        {showPercentile ? (
          <div className="mb-1 rounded border border-border bg-surface-2/40 px-2 py-1 text-[10px] text-text-dim" data-testid="compare-percentile-note">
            <p>{t("basePercentile", "explanation")}</p>
            <p>{t("basePercentile", "compareScopeNote")} {t("basePercentile", "notBuildNotice")}</p>
            {percentileData.state === "unavailable" ? <p className="text-warning">{t("basePercentile", "fallback")}</p> : null}
          </div>
        ) : null}
        {conditionalView ? (
          <p className="mb-1 rounded border border-accent/30 bg-accent-soft/40 px-2 py-1 text-[10px] text-accent">
            {tct("conditionalNote")}
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-surface-2/50 text-start [:where(&)_th]:text-start text-xs">
                <th className="sticky left-0 z-10 bg-surface-2/50 px-3 py-2 font-medium">{tct("abilityHeader")}</th>
                {players.map((p, i) => (
                  <th key={i} className="px-2 py-2 text-center font-medium">
                    {shortName(p)}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium">{tct("diffHeader")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupBlock
                  key={g}
                  group={g}
                  collapsed={collapsed.has(g)}
                  onToggle={() => toggle(g)}
                  n={n}
                  conditionalView={conditionalView}
                  rows={comparison.stats.filter((s) => s.group === g)}
                  percentiles={percentiles}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[10px] text-text-dim/70">
          {tct("legendPrefix")}
          {tct("legendProgression")}
          {tct("legendPlayerBooster")}
          <b>{tct("legendStandardMode")}</b>
          {tct("legendPlayerBoosterDetailSuffix")}
          {tct("legendConditional")}
          {tct("legendManagerBooster")}
          {tct("legendSuffix")}
          <span className="text-accent">{tct("legendHighestColor")}</span>
          {tct("legendDisplaySuffix")}
        </p>
      </section>

      {/* スキル */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">{tct("skillsHeading")}</h2>
        <SkillBlock title={tct("playerSkillsTitle")} cmp={comparison.playerSkills} players={players} />
        <div className="mt-3">
          <SkillBlock title={tct("aiStylesTitle")} cmp={comparison.aiStyles} players={players} />
        </div>
      </section>
    </div>
  );
}

function GroupBlock({
  group,
  collapsed,
  onToggle,
  n,
  conditionalView,
  rows,
  percentiles,
}: {
  group: string;
  collapsed: boolean;
  onToggle: () => void;
  n: number;
  conditionalView: boolean;
  rows: ComparisonResult["stats"];
  /** F-071: 選手ごとの基礎能力値の区分（表示しないときは null）。 */
  percentiles: (Map<string, CardPercentile> | null)[];
}) {
  const t = useT();
  const { locale } = useLocale();
  // 比較結果の group は日本語ラベル（集計キー）。表示だけ言語に合わせる。
  const groupId = (Object.entries(WORLD_STAT_GROUP_LABELS).find(([, v]) => v === group)?.[0] ?? null) as WorldStatGroup | null;
  const groupLabel = groupId ? t("abilityEditor", GROUP_LABEL_KEY[groupId]) : group;
  return (
    <>
      <tr className="border-t border-border bg-surface-2/40">
        <td colSpan={n + 2} className="px-3 py-1">
          <button type="button" onClick={onToggle} className="text-xs font-bold uppercase tracking-wide text-text-dim">
            {collapsed ? "▶" : "▼"} {groupLabel}
          </button>
        </td>
      </tr>
      {collapsed
        ? null
        : rows.map((s) => {
            const vals = s.perPlayer.map((b) => (conditionalView ? b.conditionalFinalValue : b.finalValue));
            const max = Math.max(...vals);
            const min = Math.min(...vals);
            return (
              <tr key={s.key} className="border-t border-border/50">
                <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-text" title={s.nameEn}>
                  {abilityName(s.key, locale)}
                </td>
                {s.perPlayer.map((b, i) => (
                  <td key={i} className="px-2 py-1.5 text-center">
                    <span className={vals[i] === max && max !== min ? "rounded bg-accent/15 px-1" : ""}>
                      <StatBadge value={vals[i]} />
                    </span>
                    <DeltaBits
                      prog={b.progressionDelta}
                      pB={b.playerBoosterDelta}
                      mB={b.managerBoosterDelta}
                      cB={conditionalView ? b.conditionalBoosterDelta : 0}
                    />
                    {percentiles[i]?.get(s.key) ? (
                      <span className="mt-0.5 block" data-bucket={percentiles[i]!.get(s.key)!.bucket}>
                        <Badge tone="outline" size="xs">
                          {t("basePercentile", BUCKET_LABEL_KEY[percentiles[i]!.get(s.key)!.bucket])}
                        </Badge>
                      </span>
                    ) : null}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center tabular-nums text-text-dim">{max - min}</td>
              </tr>
            );
          })}
    </>
  );
}

function SkillBlock({
  title,
  cmp,
  players,
}: {
  title: string;
  cmp: ComparisonResult["playerSkills"];
  players: ComparisonPlayerInput[];
}) {
  const t = useT();
  const tct = (k: keyof Dictionary["comparisonTables"]) => t("comparisonTables", k);
  const fillCt = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const shortName = useShortName();
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">{title}</p>
        <p className="text-[11px] text-text-dim">
          {tct("countLabel")}
          {cmp.countByPlayer.map((c, i) => `${shortName(players[i])} ${c}`).join(" / ")}
        </p>
      </div>

      <p className="mt-2 text-xs text-text-dim">{fillCt(tct("sharedByAllTemplate"), { count: String(cmp.shared.length) })}</p>
      <p className="mt-0.5 flex flex-wrap gap-1">
        {cmp.shared.length > 0 ? (
          cmp.shared.map((s) => (
            <span key={s} className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[11px] text-lime-300">
              {s}
            </span>
          ))
        ) : (
          <span className="text-xs text-text-dim">{tct("noneLabel")}</span>
        )}
      </p>

      {cmp.partial.length > 0 ? (
        <>
          <p className="mt-2 text-xs text-text-dim">{tct("partialTitle")}</p>
          <p className="mt-0.5 flex flex-wrap gap-1">
            {cmp.partial.map((p) => (
              <span key={p.skill} className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px]">
                {p.skill}
                <span className="ms-1 text-text-dim">
                  {p.playerIdx.map((i) => shortName(players[i]).slice(0, 4)).join(",")}
                </span>
              </span>
            ))}
          </p>
        </>
      ) : null}

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {cmp.uniqueByPlayer.map((skills, i) => (
          <div key={i}>
            <p className="text-xs text-text-dim">
              {fillCt(tct("uniqueToPlayerTemplate"), { name: shortName(players[i]), count: String(skills.length) })}
            </p>
            <p className="mt-0.5 flex flex-wrap gap-1">
              {skills.length > 0 ? (
                skills.map((s) => (
                  <span key={s} className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-dim">{tct("noneLabel")}</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
