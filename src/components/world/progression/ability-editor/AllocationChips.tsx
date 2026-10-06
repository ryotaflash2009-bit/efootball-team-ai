"use client";

import "@/lib/i18n/dictionaries/ja-ns/abilityEditor";
import { useEffect, useRef, type CSSProperties } from "react";
import type { AllocationChip } from "@/lib/progression/ability-direct-editor";
import { categoryColorVar, categoryName } from "@/lib/progression/ability-editor-labels";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";

/**
 * 全カテゴリの配分（常に表示）。タップでそのカテゴリを選ぶ。選択中のチップは横スクロールで自動的に見える位置へ。
 * GK カテゴリは GK カード、または配分がある場合だけ表示する（配分がある限り合計と一致させるため必ず出す）。
 */
export function AllocationChips({
  chips,
  selectedGroupId,
  showGoalkeeping,
  onSelect,
}: {
  chips: AllocationChip[];
  selectedGroupId: string | null;
  showGoalkeeping: boolean;
  onSelect: (groupId: string) => void;
}) {
  const t = useT();
  const { locale, displayLocale } = useLocale();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const visible = chips.filter((c) => !c.isGoalkeeping || showGoalkeeping || c.level > 0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !selectedGroupId) return;
    const el = scroller.querySelector<HTMLElement>(`[data-group="${selectedGroupId}"]`);
    if (!el) return;
    const left = el.offsetLeft - scroller.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < scroller.scrollLeft || right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({ left: Math.max(0, left - 16), behavior: "auto" });
    }
  }, [selectedGroupId]);

  return (
    <div
      ref={scrollerRef}
      role="group"
      aria-label={t("abilityEditor", "chipsRegionLabel")}
      className="chip-scroller -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1"
    >
      {visible.map((c) => {
        const name = categoryName(c.groupId, displayLocale);
        const active = c.groupId === selectedGroupId;
        const style = { "--cat": `var(${categoryColorVar(c.groupId)})` } as CSSProperties;
        return (
          <button
            key={c.groupId}
            type="button"
            data-group={c.groupId}
            aria-pressed={active}
            aria-label={t("abilityEditor", "chipLabel").replace("{category}", name).replace("{level}", String(c.level))}
            onClick={() => onSelect(c.groupId)}
            style={style}
            className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-[background-color,box-shadow] duration-150 ${
              active
                ? "border-[rgb(var(--cat))] bg-[rgb(var(--cat)/0.22)] text-text shadow-[0_0_12px_-2px_rgb(var(--cat)/0.7)]"
                : c.level > 0
                  ? "border-[rgb(var(--cat)/0.5)] bg-surface-2 text-text"
                  : "border-border bg-surface text-text-dim"
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--cat))]" aria-hidden="true" />
            <span className="whitespace-nowrap">{name}</span>
            <span className="font-bold tabular-nums">{c.level}</span>
            {c.atMax ? <span className="text-[9px] font-bold text-[rgb(var(--cat))]">{t("abilityEditor", "maxBadge")}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
