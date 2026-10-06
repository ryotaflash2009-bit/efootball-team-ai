"use client";

import "@/lib/i18n/dictionaries/ja-ns/abilityEditor";
import type { CSSProperties } from "react";
import type { StatBreakdown } from "@/lib/progression/types";
import type { WorldStatGroup } from "@/lib/world/types";
import { abilityRole, type AbilityDiff, type AbilityFocus } from "@/lib/progression/ability-direct-editor";
import { abilityName, categoryColorVar } from "@/lib/progression/ability-editor-labels";
import { groupIdForStat } from "@/lib/progression/stat-groups";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { StatBadge } from "@/components/world/StatBadge";

const GROUP_ORDER: { id: WorldStatGroup; key: keyof Dictionary["abilityEditor"] }[] = [
  { id: "offense", key: "groupOffense" },
  { id: "physical", key: "groupPhysical" },
  { id: "defense", key: "groupDefense" },
];

function Delta({ value, animateKey }: { value: number; animateKey?: string }) {
  if (value === 0) return null;
  return (
    <span
      key={animateKey}
      className={`ability-delta-pop inline-block tabular-nums text-xs font-bold ${value > 0 ? "text-lime-300" : "text-danger"}`}
    >
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

function AbilityRow({
  s,
  focus,
  diff,
  showConditional,
  onSelect,
  onSkipToPanel,
}: {
  s: StatBreakdown;
  focus: AbilityFocus | null;
  diff: AbilityDiff | undefined;
  showConditional: boolean;
  onSelect: (statKey: string) => void;
  onSkipToPanel?: () => void;
}) {
  const t = useT();
  const { locale, displayLocale } = useLocale();
  const role = abilityRole(focus, s.key);
  const groupId = groupIdForStat(s.key) ?? "";
  const style = { "--cat": `var(${categoryColorVar(groupId)})` } as CSSProperties;
  const conditionalDiffers = showConditional && s.conditionalFinalValue !== s.standardFinalValue;
  const shown = conditionalDiffers ? s.conditionalFinalValue : s.finalValue;
  const sessionDelta = diff?.delta ?? 0;
  const describedId = `ability-${s.key}-desc`;
  return (
    <>
    <li className="border-t border-border/40 first:border-t-0">
      <button
        type="button"
        data-role={role}
        data-stat={s.key}
        aria-pressed={role === "primary"}
        aria-describedby={describedId}
        onClick={() => onSelect(s.key)}
        style={style}
        className="ability-row flex min-h-[44px] w-full items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-surface-2/40"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {role === "primary" ? (
            <span className="shrink-0 rounded-sm bg-[rgb(var(--cat))] px-1 text-[9px] font-bold leading-4 text-accent-ink">
              {t("abilityEditor", "selected")}
            </span>
          ) : role === "related" ? (
            <span className="shrink-0 text-[10px] font-bold text-[rgb(var(--cat))]" aria-hidden="true">
              ◆
            </span>
          ) : null}
          <span className={`truncate ${role === "primary" ? "font-bold" : ""}`}>{abilityName(s.key, displayLocale)}</span>
        </span>
        <span id={describedId} className="sr-only">
          {role === "related" ? t("abilityEditor", "related") : role === "none" ? t("abilityEditor", "rowAffordance") : ""}
          {diff && sessionDelta !== 0 ? ` ${diff.before} → ${diff.after}` : ""}
        </span>
        {diff && sessionDelta !== 0 ? (
          <span className="shrink-0 text-2xs tabular-nums text-text-dim" aria-hidden="true">
            {diff.before}→
          </span>
        ) : null}
        <span className="w-8 shrink-0 text-end" aria-hidden="true">
          <Delta value={sessionDelta} animateKey={`${s.key}-${shown}`} />
        </span>
        <StatBadge value={shown} className="ability-badge" />
        {conditionalDiffers ? (
          <span className="w-3 shrink-0 text-2xs text-accent" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="w-3 shrink-0" aria-hidden="true" />
        )}
        {/* 押せることを示す手がかり（hover の無いスマホ向け）。選択中は不要。 */}
        <span className={`w-2 shrink-0 text-sm leading-none ${role === "primary" ? "text-transparent" : "text-text-muted"}`} aria-hidden="true">
          ›
        </span>
      </button>
    </li>
    {role === "primary" && onSkipToPanel ? (
      <li className="list-none">
        <button
          type="button"
          onClick={onSkipToPanel}
          className="sr-only focus:not-sr-only focus:block focus:w-full focus:px-3 focus:py-2 focus:text-start focus:text-xs focus:text-accent"
        >
          {t("abilityEditor", "skipToPanel")}
        </button>
      </li>
    ) : null}
    </>
  );
}

/**
 * 能力値一覧（育成の入口）。行をタップすると、そのカテゴリで一緒に変わる能力が光る。
 * 無関係な能力は少し暗くするだけで、読めて押せる。数値は常に表示し、色だけに頼らない。
 */
export function AbilityDirectList({
  stats,
  diffs,
  focus,
  showConditional,
  defaultOpenGk,
  onSelect,
  onSkipToPanel,
}: {
  stats: StatBreakdown[];
  diffs: Map<string, AbilityDiff>;
  focus: AbilityFocus | null;
  showConditional: boolean;
  defaultOpenGk: boolean;
  onSelect: (statKey: string) => void;
  /** 選択中の行の直後に、キーボード・読み上げ利用者向けの「育成パネルへ移動」を出す。 */
  onSkipToPanel?: () => void;
}) {
  const t = useT();
  const byGroup = new Map<WorldStatGroup, StatBreakdown[]>();
  for (const s of stats) {
    const arr = byGroup.get(s.group) ?? [];
    arr.push(s);
    byGroup.set(s.group, arr);
  }
  const gk = byGroup.get("gk") ?? [];
  const gkFocused = focus != null && gk.some((s) => focus.relatedStats.includes(s.key));
  const row = (s: StatBreakdown) => (
    <AbilityRow key={s.key} s={s} focus={focus} diff={diffs.get(s.key)} showConditional={showConditional} onSelect={onSelect} onSkipToPanel={onSkipToPanel} />
  );

  return (
    <div className="grid gap-3 xl:grid-cols-2" data-testid="ability-direct-list">
      {GROUP_ORDER.map(({ id, key }) => {
        const rows = byGroup.get(id);
        if (!rows || rows.length === 0) return null;
        return (
          <div key={id} className="overflow-hidden rounded-md border border-border bg-surface/60">
            <p className="bg-surface-2/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-text-dim">{t("abilityEditor", key)}</p>
            <ul>{rows.map(row)}</ul>
          </div>
        );
      })}
      {gk.length > 0 ? (
        <details open={defaultOpenGk || gkFocused} className="overflow-hidden rounded-md border border-border bg-surface/60 xl:col-span-2">
          <summary className="flex min-h-[44px] cursor-pointer items-center bg-surface-2/60 px-3 text-xs font-bold uppercase tracking-wide text-text-dim">
            {t("abilityEditor", "gkCollapsed")}
          </summary>
          <ul>{gk.map(row)}</ul>
        </details>
      ) : null}
    </div>
  );
}
