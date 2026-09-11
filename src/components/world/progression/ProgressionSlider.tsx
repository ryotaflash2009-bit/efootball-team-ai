"use client";

import type { ProgressionGroup } from "@/lib/progression/types";
import { groupLabelJa, statListJa } from "@/lib/world/stat-labels";

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
  const groupName = groupLabelJa(group.groupId);
  const statNames = statListJa(group.affectedStats);
  const sliderMax = Math.max(group.allocatedPoints, group.maximumAllocation, 1);
  const nextCostLabel = group.nextLevelCost == null ? "上限" : `次の+1: ${group.nextLevelCost}pt`;
  const valueText = group.atMax
    ? `${groupName} レベル ${group.allocatedPoints}（上限到達）・消費 ${group.consumedProgressionPoints}pt`
    : `${groupName} レベル ${group.allocatedPoints}・次の+1に ${group.nextLevelCost ?? "—"}pt・消費 ${group.consumedProgressionPoints}pt`;
  const rangeDisabled = disabled || group.maximumAllocation <= 0;

  return (
    <div className="rounded-md border border-border bg-surface-2/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold">
          {groupName}
          {group.statsConfidence === "confirmed" ? (
            <span className="ml-1 align-top text-[9px] text-lime-300/80">確認済</span>
          ) : (
            <span className="ml-1 align-top text-[9px] text-yellow-300/80">対象能力は検証中</span>
          )}
        </p>
        <span className="shrink-0 text-sm font-bold tabular-nums text-accent">Lv {group.allocatedPoints}</span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-text-dim" title={statNames}>
        対象: {statNames}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={`${groupName} のレベルを下げる`}
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
          aria-label={`${groupName} の育成レベル`}
          aria-valuetext={valueText}
          onChange={(e) => onSet(group.groupId, Number(e.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
        />

        <button
          type="button"
          aria-label={`${groupName} のレベルを上げる`}
          disabled={disabled || !group.canAddLevel}
          onClick={() => onAdjust(group.groupId, 1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border text-xl leading-none text-text transition-colors disabled:cursor-not-allowed disabled:text-text-dim/40 hover:enabled:border-accent"
        >
          ＋
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-text-dim">
        <span>消費: {group.consumedProgressionPoints}pt</span>
        <span className={group.canAddLevel ? "text-text" : "text-text-dim/60"}>{nextCostLabel}</span>
        <span>{group.atMax ? "上限到達" : `上限 Lv${group.maximumAllocation}`}</span>
      </div>
    </div>
  );
}
