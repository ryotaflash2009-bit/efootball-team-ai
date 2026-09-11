"use client";

import type { ProgressionGroup } from "@/lib/progression/types";
import { getStatDef } from "@/lib/world/stats";

/**
 * 能力値グループ1行（v2）: 名前 / カテゴリレベル / +・− / 次段階コスト / 消費ポイント / 対象能力値 / 上限。
 * プラスを押す前に「次の1段階に必要なポイント」を表示する。
 */
export function GroupRow({
  group,
  disabled,
  onAdjust,
}: {
  group: ProgressionGroup;
  disabled?: boolean;
  onAdjust: (groupId: string, delta: number) => void;
}) {
  const statNames = group.affectedStats.map((k) => getStatDef(k)?.nameEn ?? k).join(" / ");
  const nextCostLabel =
    group.nextLevelCost == null
      ? "上限"
      : `次の+1: ${group.nextLevelCost}pt`;

  return (
    <div className="rounded-md border border-border bg-surface-2/30 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {group.nameEn}
            {group.statsConfidence === "confirmed" ? (
              <span className="ml-1 align-top text-[9px] text-lime-300/80">確認済</span>
            ) : (
              <span className="ml-1 align-top text-[9px] text-yellow-300/80">対象能力は検証中</span>
            )}
          </p>
          <p className="truncate text-[10px] text-text-dim" title={statNames}>
            対象: {statNames}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={`${group.nameEn} のレベルを下げる`}
            disabled={disabled || group.allocatedPoints <= 0}
            onClick={() => onAdjust(group.groupId, -1)}
            className="h-8 w-8 rounded-md border border-border text-lg leading-none text-text disabled:cursor-not-allowed disabled:text-text-dim/40 hover:enabled:border-accent"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-bold tabular-nums">{group.allocatedPoints}</span>
          <button
            type="button"
            aria-label={`${group.nameEn} のレベルを上げる`}
            disabled={disabled || !group.canAddLevel}
            onClick={() => onAdjust(group.groupId, 1)}
            className="h-8 w-8 rounded-md border border-border text-lg leading-none text-text disabled:cursor-not-allowed disabled:text-text-dim/40 hover:enabled:border-accent"
          >
            +
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-text-dim">
        <span>消費: {group.consumedProgressionPoints}pt</span>
        <span className={group.canAddLevel ? "text-text" : "text-text-dim/60"}>{nextCostLabel}</span>
        <span>{group.atMax ? "上限到達" : `上限 Lv${group.maximumAllocation}`}</span>
      </div>
    </div>
  );
}
