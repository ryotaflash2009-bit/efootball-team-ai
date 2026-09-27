"use client";

import type { CSSProperties } from "react";
import type { StatBreakdown } from "@/lib/progression/types";
import type { AbilityDiff, AbilityFocus, AllocationChip, GroupSliderModel } from "@/lib/progression/ability-direct-editor";
import { abilityName, categoryColorVar, categoryName } from "@/lib/progression/ability-editor-labels";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { AllocationChips } from "./AllocationChips";
import { CategorySlider } from "./CategorySlider";

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * 画面下部の育成パネル（能力を選ぶと開く）。本文の最後に sticky で置くため、本文を隠さず、
 * 最後の能力まで必ずスクロールできる。未選択時は残りポイントと配分チップだけの細いバーになる。
 */
export function ProgressionDock({
  focus,
  model,
  level,
  dragging,
  blocked,
  canProgress,
  chips,
  showGoalkeeping,
  remainingPoints,
  totalPoints,
  baselineLevel,
  pointsChange,
  nextCost,
  primary,
  relatedDiffs,
  onSelectGroup,
  onClear,
  onStep,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onKeyLevel,
  onRevert,
  onGoToSave,
}: {
  focus: AbilityFocus | null;
  model: GroupSliderModel | null;
  level: number;
  dragging: boolean;
  blocked: boolean;
  canProgress: boolean;
  chips: AllocationChip[];
  showGoalkeeping: boolean;
  /** 表示中（ドラッグ中はプレビュー）の残りポイント。 */
  remainingPoints: number;
  totalPoints: number;
  baselineLevel: number;
  /** 選択時点のレベル → 表示中レベルのポイント差（正 = 必要、負 = 返却）。 */
  pointsChange: number;
  /** 表示中レベルから次の1段階のコスト（上限なら null）。 */
  nextCost: number | null;
  primary: StatBreakdown | null;
  relatedDiffs: AbilityDiff[];
  onSelectGroup: (groupId: string) => void;
  onClear: () => void;
  onStep: (delta: 1 | -1) => void;
  onDragStart: (level: number) => void;
  onDragMove: (requested: number) => void;
  onDragEnd: (requestedLevel: number) => void;
  onDragCancel: () => void;
  onKeyLevel: (level: number) => void;
  onRevert: () => void;
  onGoToSave: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tx = (k: Parameters<typeof t<"abilityEditor">>[1]) => t("abilityEditor", k);
  const groupId = focus?.groupId ?? null;
  const style = { "--cat": `var(${categoryColorVar(groupId ?? "")})` } as CSSProperties;
  const lowPoints = remainingPoints <= 2;
  const pointsPill = (
    <span
      className={`inline-flex items-baseline gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums ${
        remainingPoints < 0 ? "border-danger text-danger" : lowPoints ? "border-warning/60 text-warning" : "border-border text-text"
      }`}
      data-testid="remaining-points"
    >
      <span className="text-text-dim">{tx("remainingShort")}</span>
      <span className="text-sm font-bold">{remainingPoints}</span>
      <span className="text-text-dim">/ {totalPoints}{tx("pointsUnit")}</span>
    </span>
  );

  if (!focus || !model || !groupId) {
    return (
      <div className="progression-dock sticky bottom-0 z-20 -mx-1 mt-3 rounded-t-lg border border-border px-2 pt-2" style={style}>
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs font-semibold text-text-dim">{canProgress ? tx("tapHint") : tx("cannotProgress")}</p>
          {pointsPill}
        </div>
        <AllocationChips chips={chips} selectedGroupId={null} showGoalkeeping={showGoalkeeping} onSelect={onSelectGroup} />
      </div>
    );
  }

  const catName = categoryName(groupId, locale);
  const change = level - baselineLevel;
  const disabledPlus = !canProgress || !model.canIncrease;
  const plusReason = model.atCategoryMax ? tx("categoryAtMax") : model.limitedByPoints && !model.canIncrease ? tx("notEnoughPoints") : null;
  const minusReason = !model.canDecrease ? tx("atMinimum") : null;
  const valueText = tx("sliderValueText")
    .replace("{category}", catName)
    .replace("{level}", String(level))
    .replace("{reachable}", String(model.reachableMax))
    .replace("{remaining}", String(remainingPoints));
  const statusId = `dock-status-${groupId}`;
  const title = primary ? abilityName(primary.key, locale) : catName;

  return (
    <section
      aria-label={tx("panelRegionLabel")}
      className="progression-dock progression-dock-open sticky bottom-0 z-20 -mx-1 mt-3 rounded-t-lg border border-[rgb(var(--cat)/0.55)] px-2 pt-2"
      style={style}
      data-testid="progression-dock"
    >
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--cat))] [@media(max-height:520px)]:hidden">
            {primary ? tx("trainThisAbility") : tx("editingProgression")}
          </p>
          <h3 className="truncate text-base font-bold leading-tight">{title}</h3>
          <p className="text-2xs text-text-dim [@media(max-height:520px)]:hidden">
            {tx("progressionCategory")}: <span className="font-semibold text-text">{catName}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {pointsPill}
          <button
            type="button"
            onClick={onClear}
            aria-label={tx("clearSelection")}
            className="grid h-11 w-11 place-items-center rounded-md border border-border text-lg text-text-dim hover:border-accent hover:text-text"
          >
            ×
          </button>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1 text-xs tabular-nums">
        <span>
          <span className="text-text-dim">{catName} {tx("levelPrefix")} </span>
          <span className="font-semibold">{baselineLevel}</span>
          <span className="text-text-dim"> → </span>
          <span className="text-sm font-bold text-[rgb(var(--cat))]" data-testid="dock-level">{level}</span>
          {change !== 0 ? <span className={`ml-1 font-bold ${change > 0 ? "text-lime-300" : "text-danger"}`}>{signed(change)}</span> : null}
        </span>
        {pointsChange !== 0 ? (
          <span className="text-text-dim" data-testid="dock-points-change">
            {pointsChange > 0 ? tx("requiredPoints") : tx("refundPoints")}:{" "}
            <span className={pointsChange > 0 ? "font-semibold text-text" : "font-semibold text-lime-300"}>
              {Math.abs(pointsChange)}
              {tx("pointsUnit")}
            </span>
          </span>
        ) : null}
        <span className="text-text-dim">
          {tx("nextUpgrade")}: <span className="text-text">{nextCost == null ? tx("maxBadge") : `${nextCost}${tx("pointsUnit")}`}</span>
        </span>
        <span className="text-text-dim">
          {tx("maximumReachable")}: <span className="text-text">{tx("levelPrefix")} {model.reachableMax}</span>
          {model.atCategoryMax ? <span className="ml-1 font-bold text-[rgb(var(--cat))]">{tx("maxBadge")}</span> : null}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={tx("decreaseLabel").replace("{category}", catName)}
          aria-describedby={minusReason ? statusId : undefined}
          disabled={!canProgress || !model.canDecrease}
          onClick={() => onStep(-1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border bg-surface text-xl leading-none transition-transform active:scale-95 disabled:cursor-not-allowed disabled:text-text-dim/40 hover:enabled:border-[rgb(var(--cat))]"
        >
          −
        </button>
        <CategorySlider
          model={model}
          level={level}
          dragging={dragging}
          blocked={blocked}
          disabled={!canProgress}
          label={tx("sliderLabel").replace("{category}", catName)}
          valueText={valueText}
          describedBy={statusId}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          onKeyLevel={onKeyLevel}
        />
        <button
          type="button"
          aria-label={tx("increaseLabel").replace("{category}", catName)}
          aria-describedby={plusReason ? statusId : undefined}
          disabled={disabledPlus}
          onClick={() => onStep(1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[rgb(var(--cat)/0.6)] bg-[rgb(var(--cat)/0.15)] text-xl leading-none transition-transform active:scale-95 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-text-dim/40"
        >
          ＋
        </button>
      </div>

      <div className={`flex items-center gap-1 px-1 ${blocked || plusReason ? "" : "[@media(max-height:520px)]:hidden"}`}>
        <p id={statusId} className="min-w-0 flex-1 text-2xs" role="status" aria-live="polite">
          {blocked ? (
            <span className="font-semibold text-danger">⚠ {tx("notEnoughToReach")}</span>
          ) : plusReason ? (
            <span className={model.atCategoryMax ? "font-semibold text-[rgb(var(--cat))]" : "font-semibold text-warning"}>
              {model.atCategoryMax ? "★" : "⚠"} {plusReason}
            </span>
          ) : minusReason && level === 0 ? (
            <span className="sr-only">{minusReason}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onRevert}
          disabled={change === 0}
          title={tx("resetCategoryHint")}
          className="min-h-[44px] shrink-0 rounded-md px-2 text-xs text-text-dim hover:enabled:text-text disabled:opacity-40"
        >
          {tx("resetCategory")}
        </button>
        <button
          type="button"
          onClick={onGoToSave}
          className="min-h-[44px] shrink-0 rounded-md border border-accent/60 bg-accent/10 px-4 text-xs font-semibold text-accent hover:bg-accent/20"
        >
          {tx("goToSave")}
        </button>
      </div>

      {relatedDiffs.length > 0 ? (
        <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 px-1 text-2xs tabular-nums [@media(max-height:520px)]:hidden" aria-label={tx("relatedAbilities")}>
          {relatedDiffs.map((d) => (
            <li key={d.key} className={d.key === primary?.key ? "font-bold text-text" : "text-text-dim"}>
              {abilityName(d.key, locale)} {d.before}→<span className="text-text">{d.after}</span>
              {d.delta !== 0 ? <span className={`ml-0.5 ${d.delta > 0 ? "text-lime-300" : "text-danger"}`}>{signed(d.delta)}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {primary ? (
        <details className="mt-1 px-1 text-2xs [@media(max-height:520px)]:hidden">
          <summary className="cursor-pointer text-text-dim">{tx("breakdownToggle")}</summary>
          <dl className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 tabular-nums sm:grid-cols-6">
            <div><dt className="text-text-muted">{tx("breakdownBase")}</dt><dd>{primary.baseValue}</dd></div>
            <div><dt className="text-text-muted">{tx("breakdownProgression")}</dt><dd>{signed(primary.progressionDelta)}</dd></div>
            <div><dt className="text-text-muted">{tx("breakdownBooster")}</dt><dd>{signed(primary.playerBoosterDelta)}</dd></div>
            <div><dt className="text-text-muted">{tx("breakdownManager")}</dt><dd>{signed(primary.managerBoosterDelta)}</dd></div>
            <div><dt className="text-text-muted">{tx("breakdownOther")}</dt><dd>{signed(primary.otherDelta)}</dd></div>
            <div><dt className="text-text-muted">{tx("breakdownFinal")}</dt><dd className="font-bold">{primary.finalValue}</dd></div>
          </dl>
        </details>
      ) : null}

      <AllocationChips chips={chips} selectedGroupId={groupId} showGoalkeeping={showGoalkeeping} onSelect={onSelectGroup} />

    </section>
  );
}
