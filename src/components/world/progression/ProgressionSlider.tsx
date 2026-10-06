"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import type { ProgressionGroup } from "@/lib/progression/types";
import { abilityName, categoryName } from "@/lib/progression/ability-editor-labels";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";

/**
 * 能力値グループ1行（v2・スライダー中心）。
 *  - つまみのドラッグ / トラッククリック / 左右矢印 / Home / End はネイティブ range が処理。
 *  - − / ＋ ボタンで1段階調整（既存の adjustGroupLevel と同期）。
 *  - スライダーで直接動かしても段階コストと残りポイントを尊重し、到達可能な最大で止まる。
 * ポイント不足の制御・上限・段階コストは engine（group-allocation）側で担保する。
 */
export function ProgressionSlider({
  group,
  disabled,
  onSet,
  onAdjust,
}: {
  group: ProgressionGroup;
  disabled?: boolean;
  /** スライダーで指定レベルへ（コスト・残ポイントは呼び出し側が engine で丸める）。 */
  onSet: (groupId: string, level: number) => void;
  /** − / ＋ で1段階。 */
  onAdjust: (groupId: string, delta: number) => void;
}) {
  const t = useT();
  const { locale, displayLocale } = useLocale();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const groupName = categoryName(group.groupId, displayLocale);
  const statNames = group.affectedStats.map((k) => abilityName(k, displayLocale)).join(" / ");
  const sliderMax = Math.max(group.allocatedPoints, group.maximumAllocation, 1);
  const nextCostLabel = group.nextLevelCost == null ? tp("sliderCap") : tp("sliderNextCost").replace("{cost}", String(group.nextLevelCost));
  const valueText = group.atMax
    ? tp("sliderValueTextMax").replace("{group}", groupName).replace("{level}", String(group.allocatedPoints)).replace("{used}", String(group.consumedProgressionPoints))
    : tp("sliderValueText").replace("{group}", groupName).replace("{level}", String(group.allocatedPoints)).replace("{next}", String(group.nextLevelCost ?? "—")).replace("{used}", String(group.consumedProgressionPoints));
  const rangeDisabled = disabled || group.maximumAllocation <= 0;

  return (
    <div className="rounded-md border border-border bg-surface-2/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold">
          {groupName}
          {group.statsConfidence === "confirmed" ? (
            <span className="ms-1 align-top text-[9px] text-lime-300/80">{tp("confirmedTag")}</span>
          ) : (
            <span className="ms-1 align-top text-[9px] text-yellow-300/80">{tp("targetsUnverifiedTag")}</span>
          )}
        </p>
        <span className="shrink-0 text-sm font-bold tabular-nums text-accent">Lv {group.allocatedPoints}</span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-text-dim" title={statNames}>
        {tp("targetsLabel").replace("{stats}", statNames)}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={tp("sliderDecrease").replace("{group}", groupName)}
          disabled={disabled || group.allocatedPoints <= 0}
          onClick={() => onAdjust(group.groupId, -1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border text-xl leading-none text-text transition-colors disabled:cursor-not-allowed disabled:text-text-dim/40 hover:enabled:border-accent"
        >
          −
        </button>

        <input
          type="range"
          min={0}
          max={sliderMax}
          step={1}
          value={group.allocatedPoints}
          disabled={rangeDisabled}
          aria-label={tp("sliderAria").replace("{group}", groupName)}
          aria-valuetext={valueText}
          onChange={(e) => onSet(group.groupId, Number(e.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
        />

        <button
          type="button"
          aria-label={tp("sliderIncrease").replace("{group}", groupName)}
          disabled={disabled || !group.canAddLevel}
          onClick={() => onAdjust(group.groupId, 1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border text-xl leading-none text-text transition-colors disabled:cursor-not-allowed disabled:text-text-dim/40 hover:enabled:border-accent"
        >
          ＋
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-text-dim">
        <span>{tp("consumedLabel").replace("{used}", String(group.consumedProgressionPoints))}</span>
        <span className={group.canAddLevel ? "text-text" : "text-text-dim/60"}>{nextCostLabel}</span>
        <span>{group.atMax ? tp("capReached") : tp("capLevel").replace("{level}", String(group.maximumAllocation))}</span>
      </div>
    </div>
  );
}
