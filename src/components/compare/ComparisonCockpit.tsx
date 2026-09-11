"use client";

import { useCallback, useMemo, useState } from "react";
import type { ComparisonPlayerInput, ComparisonResult } from "@/lib/comparison/types";
import type { AutoAllocateProfile, PointsSummary, ProgressionGroup, SavedBuild } from "@/lib/progression/types";
import { buildComparisonRadarData, type RadarMode } from "@/lib/comparison/ability-radar";
import { listBuilds } from "@/lib/progression/build-storage";
import { CompareRadarChart } from "./CompareRadarChart";
import { CompareCategoryPreview } from "./CompareCategoryPreview";
import { CompareTrainingPanel } from "./CompareTrainingPanel";
import { CompareSaveBuildDialog } from "./CompareSaveBuildDialog";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

/**
 * 比較コックピット: 育成スライダー・能力値レーダー・選択カテゴリの近接プレビューを 1 つの表示領域へ集約する。
 * 育成操作と結果確認の大きな上下スクロール往復を解消するのが目的（計算は既存のまま）。
 */

export interface CockpitBuild {
  allocation: Record<string, number>;
  groups: ProgressionGroup[];
  points: PointsSummary;
  canProgress: boolean;
  manualAllocation: boolean;
}

export function ComparisonCockpit({
  players,
  comparison,
  perBuild,
  radarMode,
  onRadarMode,
  showPreBuild,
  onTogglePreBuild,
  activeIndex,
  onActiveIndex,
  activeCategory,
  onActiveCategory,
  onSetLevel,
  onAdjustLevel,
  onAutoProfile,
  onResetTraining,
  onBuildSaved,
  buildsRefreshKey,
}: {
  players: ComparisonPlayerInput[];
  comparison: ComparisonResult;
  perBuild: CockpitBuild[];
  radarMode: RadarMode;
  onRadarMode: (m: RadarMode) => void;
  showPreBuild: boolean;
  onTogglePreBuild: () => void;
  activeIndex: number;
  onActiveIndex: (i: number) => void;
  activeCategory: string;
  onActiveCategory: (groupId: string) => void;
  onSetLevel: (idx: number, groupId: string, level: number) => void;
  onAdjustLevel: (idx: number, groupId: string, delta: number) => void;
  onAutoProfile: (idx: number, profile: AutoAllocateProfile) => void;
  onResetTraining: (idx: number) => void;
  /** 保存成功時（親が保存ビルドセレクタを再読込・状態を更新）。 */
  onBuildSaved: (idx: number, build: SavedBuild) => void;
  /** これが変わると保存ビルド一覧を読み直す。 */
  buildsRefreshKey: number;
}) {
  const [saveDialogFor, setSaveDialogFor] = useState<number | null>(null);
  const t = useT();
  const { locale } = useLocale();
  const tcc = useCallback((k: keyof Dictionary["comparisonCockpit"]) => t("comparisonCockpit", k), [t]);
  const fillCc = useCallback(
    (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s),
    [],
  );
  const nameOf = useCallback(
    (p: ComparisonPlayerInput) =>
      resolvePlayerDisplayName(p.display, locale, fillCc(t("squadBuildPanel", "cardFallbackNameTemplate"), { id: p.display.worldCardId })),
    [t, fillCc, locale],
  );

  const modeOptions = useMemo<RadarMode[]>(() => {
    const opts: RadarMode[] = ["base", "progressed", "standard"];
    if (comparison.hasAnyConditionalSelection) opts.push("conditional");
    if (players.some((p) => p.experimentalModeEnabled || p.applyProvisionalBoosters)) opts.push("experimental");
    return opts;
  }, [players, comparison.hasAnyConditionalSelection]);

  const radarData = useMemo(
    () =>
      buildComparisonRadarData(
        comparison.players.map((cp, i) => ({
          index: i,
          name: nameOf(cp.input),
          cardType: cp.input.display.cardType,
          worldCardId: cp.input.display.worldCardId,
          registeredPosition: cp.input.display.registeredPosition,
          stats: cp.result.stats,
        })),
        modeOptions.includes(radarMode) ? radarMode : "standard",
      ),
    [comparison, radarMode, modeOptions, nameOf],
  );

  const previewSeries = comparison.players.map((cp, i) => {
    const grp = perBuild[i]?.groups.find((g) => g.groupId === activeCategory);
    return {
      index: i,
      name: nameOf(cp.input),
      stats: cp.result.stats,
      groupLevel: grp?.allocatedPoints ?? 0,
      pointsUsed: perBuild[i]?.points.usedPoints ?? 0,
      pointsRemaining: perBuild[i]?.points.remainingPoints ?? 0,
    };
  });

  const hasManagerAny = players.some((p) => p.manager?.internalManagerId != null);
  const twoUp = players.length === 2;

  const trainingPanel = (idx: number) => {
    const pb = perBuild[idx];
    if (!pb) return null;
    const p = players[idx];
    return (
      <CompareTrainingPanel
        embedded
        name={nameOf(p)}
        isGk={p.display.registeredPosition === "GK"}
        groups={pb.groups}
        points={pb.points}
        canProgress={pb.canProgress}
        hasManualAllocation={pb.manualAllocation}
        onSetLevel={(g, l) => onSetLevel(idx, g, l)}
        onAdjustLevel={(g, d) => onAdjustLevel(idx, g, d)}
        onAutoProfile={(pr) => onAutoProfile(idx, pr)}
        onReset={() => onResetTraining(idx)}
        onCategoryTouch={onActiveCategory}
        onOpenSaveDialog={() => setSaveDialogFor(idx)}
      />
    );
  };

  const dialogIdx = saveDialogFor;
  const dialogPb = dialogIdx != null ? perBuild[dialogIdx] : null;
  const dialogPlayer = dialogIdx != null ? comparison.players[dialogIdx] : null;
  // ダイアログを開いている間だけ localStorage を読む（buildsRefreshKey が変わると再取得）。
  void buildsRefreshKey;
  const dialogBuilds = dialogPlayer ? listBuilds(dialogPlayer.input.display.worldCardId) : [];

  const center = (
    <div className="flex flex-col gap-2">
      <CompareRadarChart
        data={radarData}
        mode={modeOptions.includes(radarMode) ? radarMode : "standard"}
        onModeChange={onRadarMode}
        showPreBuild={showPreBuild}
        onTogglePreBuild={onTogglePreBuild}
        activeIndex={Math.min(activeIndex, radarData.series.length - 1)}
        modeOptions={modeOptions}
        hasManagerAny={hasManagerAny}
      />
      <CompareCategoryPreview groupId={activeCategory} mode={radarMode} series={previewSeries} />
      <div className="flex flex-wrap justify-center gap-2 text-2xs">
        <a href="#compare-abilities" className="rounded border border-border px-2 py-0.5 text-accent hover:border-accent">
          {tcc("abilitiesTableLink")}
        </a>
        <a href="#compare-cockpit" className="rounded border border-border px-2 py-0.5 text-text-dim hover:border-accent">
          {tcc("backToTrainingLink")}
        </a>
      </div>
    </div>
  );

  return (
    <section
      id="compare-cockpit"
      aria-label={tcc("ariaLabel")}
      className="scroll-mt-24 rounded-md border border-border bg-surface p-3"
    >
      <p className="mb-2 text-sm font-semibold">
        {tcc("heading")}
        <span className="ml-2 text-2xs font-normal text-text-dim">{tcc("headingHint")}</span>
      </p>

      {!twoUp ? (
        <div
          role="tablist"
          aria-label={tcc("selectPlayerAriaLabel")}
          className="mb-2 flex flex-wrap gap-1.5"
        >
          {players.map((p, i) => (
            <button
              key={p.display.worldCardId}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              onClick={() => onActiveIndex(i)}
              className={`min-h-[36px] rounded border px-2 py-1 text-xs ${
                i === activeIndex
                  ? "border-accent bg-accent-soft font-semibold text-accent"
                  : "border-border text-text-dim hover:border-accent"
              }`}
            >
              {fillCc(tcc("playerTabTemplate"), { index: String(i + 1), name: nameOf(p) })}
              {i === activeIndex ? tcc("activeSuffix") : ""}
            </button>
          ))}
        </div>
      ) : null}

      {twoUp ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(150px,240px)_minmax(0,1fr)_minmax(150px,240px)]">
          <div>{trainingPanel(0)}</div>
          {center}
          <div>{trainingPanel(1)}</div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,340px)_minmax(0,1fr)]">
          <div>{trainingPanel(activeIndex)}</div>
          {center}
        </div>
      )}

      {dialogIdx != null && dialogPb && dialogPlayer ? (
        <CompareSaveBuildDialog
          open
          onClose={() => setSaveDialogFor(null)}
          player={dialogPlayer.input}
          index={dialogIdx}
          allocation={dialogPb.allocation}
          groups={dialogPb.groups}
          pointsUsed={dialogPb.points.usedPoints}
          pointsTotal={dialogPb.points.totalPoints}
          resultStats={dialogPlayer.result.stats}
          calculatedOvr={dialogPlayer.result.rating.estimatedOvr}
          calculationMode={dialogPlayer.result.calculationMode}
          rulesVersion={dialogPlayer.result.rulesVersion}
          existingBuilds={dialogBuilds}
          onSaved={(build) => {
            onBuildSaved(dialogIdx, build);
            setSaveDialogFor(null);
          }}
        />
      ) : null}
    </section>
  );
}
