"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import { useId, useState } from "react";
import type { ConditionalBoosterSelection } from "@/lib/progression/types";
import {
  POWER_OF_MANY_TIERS,
  describeConditionalSelection,
  tierForSelection,
  CONDITIONAL_SELECTION_DISCLAIMER,
  CONDITIONAL_UNSELECTED_NOTE,
} from "@/lib/progression/conditional-boosters";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { localizeLibText } from "@/lib/progression/lib-text-en";

/**
 * Power of Many 方式ブースター（金色・Game Plan 依存）の**手動段階指定**コントロール。
 * 育成 / 比較 / スカッドで共通利用。タップ / キーボードで開き、+0/+1/+2/+3 を選ぶ。
 * その効果名の対象能力へだけ反映（Ball Protection=4能力 / Total Package=26能力）。
 * アプリが自動判定したようには表示しない（必ず「ユーザー指定」と明記）。
 */
export function ConditionalBoosterControl({
  boosterId,
  nameEn: nameEnProp,
  nameJa,
  level,
  affectedStats,
  selection,
  onChange,
  compact = false,
  idPrefix,
}: {
  boosterId: number;
  nameEn: string | null;
  nameJa: string | null;
  level: number | null;
  affectedStats: string[];
  selection: ConditionalBoosterSelection;
  onChange: (next: ConditionalBoosterSelection) => void;
  /** 比較 / スカッドの狭い列向けの詰めた表示。 */
  compact?: boolean;
  idPrefix?: string;
}) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const autoId = useId();
  const groupName = `pom-tier-${idPrefix ?? autoId}`;
  const nameEn = nameEnProp ?? tp("boostFallbackName");
  const currentTier = tierForSelection(selection);
  const maxLevel = level ?? 3;
  const affected = affectedStats.length || 4;
  const statNames = affectedStats.map((k) => abilityName(k, locale));

  const currentLabel =
    selection === "none"
      ? tp("boostUnsetNotApplied")
      : tp("boostUserSet").replace("{level}", String(currentTier.level));

  return (
    <div
      className={`rounded border ${
        selection === "none" ? "border-warning/30 bg-warning/5" : "border-accent/40 bg-accent-soft/40"
      } ${compact ? "p-1.5" : "p-2"}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`font-semibold ${compact ? "text-2xs" : "text-xs"}`}>
          {locale === "ja" && nameJa ? tp("boostNameWithEn").replace("{ja}", nameJa).replace("{en}", nameEn) : nameEn}
          {level != null ? ` +${level}` : ""}
        </span>
        <Badge tone="warning" size="xs">
          {tp("boostGoldVariable")}
        </Badge>
        <span className="text-2xs text-text-dim">{tp("boostWorldId").replace("{id}", String(boosterId))}</span>
      </div>
      <p className={`mt-0.5 text-text-muted ${compact ? "text-[9px]" : "text-2xs"}`}>
        {tp("boostMaxSummary")
          .replace("{max}", String(maxLevel))
          .replace("{count}", String(affected))
          .replace("{names}", statNames.slice(0, 4).join(" / "))
          .replace(
            "{more}",
            affectedStats.length > 4 ? tp("boostMoreStats").replace("{n}", String(affectedStats.length - 4)) : "",
          )}
        {localizeLibText(selection === "none" ? CONDITIONAL_UNSELECTED_NOTE : describeConditionalSelection(selection), locale)}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-2xs text-text-dim">
          {tp("boostCurrentValue")}
          <b className={selection === "none" ? "text-warning" : "text-accent"}>{currentLabel}</b>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="rounded border border-border bg-surface-2 px-2 py-0.5 text-2xs hover:border-accent"
        >
          {tp("boostSetTier")}
        </button>
        {selection !== "none" ? (
          <button
            type="button"
            onClick={() => onChange("none")}
            className="rounded border border-border px-2 py-0.5 text-2xs text-text-dim hover:border-danger hover:text-danger"
          >
            {tp("boostClearSelection")}
          </button>
        ) : null}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={tp("boostPomDialogTitle").replace("{name}", nameEn)} size="sm">
        <fieldset>
          <legend className="text-xs text-text-dim">
            {tp("boostPomLegend").replace("{name}", nameEn).replace("{count}", String(affected))}
          </legend>
          <ul className="mt-2 flex flex-col gap-1.5">
            {POWER_OF_MANY_TIERS.map((tier) => (
              <li key={tier.selection}>
                <label className="flex cursor-pointer items-start gap-2 rounded border border-border/60 bg-surface-2/40 px-2 py-1.5 text-xs hover:border-accent">
                  <input
                    type="radio"
                    name={groupName}
                    value={tier.selection}
                    checked={selection === tier.selection}
                    onChange={() => {
                      onChange(tier.selection);
                      setOpen(false);
                    }}
                    className="mt-0.5 accent-[color:var(--color-accent)]"
                  />
                  <span>
                    <span className="font-semibold text-text">
                      {tier.selection === "none"
                        ? tp("boostTierNone")
                        : tp("boostTierTargets").replace("{count}", String(affected)).replace("{level}", String(tier.level))}
                    </span>
                    <span className="block text-2xs text-text-muted">
                      {localizeLibText(tier.playerRangeLabel, locale)}
                      {tier.selection === "none" ? "" : tp("boostTierUserNote")}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="mt-3 rounded border border-info/30 bg-info/10 px-2 py-1 text-2xs text-info">
          {localizeLibText(CONDITIONAL_SELECTION_DISCLAIMER, locale)}
        </p>
        <p className="mt-1 text-2xs text-text-muted">
          {tp("boostPomFootnote").replace("{names}", statNames.join(" / "))}
        </p>
      </Modal>
    </div>
  );
}
