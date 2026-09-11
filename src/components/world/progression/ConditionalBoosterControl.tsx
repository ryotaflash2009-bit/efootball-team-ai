"use client";

import { useId, useState } from "react";
import type { ConditionalBoosterSelection } from "@/lib/progression/types";
import {
  POWER_OF_MANY_TIERS,
  describeConditionalSelection,
  tierForSelection,
  CONDITIONAL_SELECTION_DISCLAIMER,
  CONDITIONAL_UNSELECTED_NOTE,
} from "@/lib/progression/conditional-boosters";
import { statLabelJa } from "@/lib/world/stat-labels";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";

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
  const [open, setOpen] = useState(false);
  const autoId = useId();
  const groupName = `pom-tier-${idPrefix ?? autoId}`;
  const nameEn = nameEnProp ?? "ブースター";
  const currentTier = tierForSelection(selection);
  const maxLevel = level ?? 3;
  const affected = affectedStats.length || 4;
  const statNames = affectedStats.map((k) => statLabelJa(k));

  const currentLabel =
    selection === "none" ? "未指定（能力値へ未適用）" : `ユーザー指定 +${currentTier.level}`;

  return (
    <div
      className={`rounded border ${
        selection === "none" ? "border-warning/30 bg-warning/5" : "border-accent/40 bg-accent-soft/40"
      } ${compact ? "p-1.5" : "p-2"}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`font-semibold ${compact ? "text-2xs" : "text-xs"}`}>
          {nameJa ? `${nameJa}（${nameEn}）` : nameEn}
          {level != null ? ` +${level}` : ""}
        </span>
        <Badge tone="warning" size="xs">
          金色・可変（Game Plan 依存）
        </Badge>
        <span className="text-2xs text-text-dim">World ブースターID {boosterId}</span>
      </div>
      <p className={`mt-0.5 text-text-muted ${compact ? "text-[9px]" : "text-2xs"}`}>
        最大表示 +{maxLevel} / 対象 {affected} 能力（{statNames.slice(0, 4).join(" / ")}
        {affectedStats.length > 4 ? ` ほか${affectedStats.length - 4}` : ""}）。
        {selection === "none" ? CONDITIONAL_UNSELECTED_NOTE : describeConditionalSelection(selection)}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-2xs text-text-dim">
          現在値: <b className={selection === "none" ? "text-warning" : "text-accent"}>{currentLabel}</b>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="rounded border border-border bg-surface-2 px-2 py-0.5 text-2xs hover:border-accent"
        >
          適用段階を指定 ▾
        </button>
        {selection !== "none" ? (
          <button
            type="button"
            onClick={() => onChange("none")}
            className="rounded border border-border px-2 py-0.5 text-2xs text-text-dim hover:border-danger hover:text-danger"
          >
            選択を解除
          </button>
        ) : null}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`${nameEn}（金色・可変）の適用段階を指定`} size="sm">
        <fieldset>
          <legend className="text-xs text-text-dim">
            KONAMI 公式「The Power of Many」= Game Plan に登録した対象リーグの選手数で効果量が変化します（金色ブースター）。
            自分の Game Plan を見て相当する段階を選んでください。{nameEn} の対象 {affected} 能力へだけ反映します。
          </legend>
          <ul className="mt-2 flex flex-col gap-1.5">
            {POWER_OF_MANY_TIERS.map((t) => (
              <li key={t.selection}>
                <label className="flex cursor-pointer items-start gap-2 rounded border border-border/60 bg-surface-2/40 px-2 py-1.5 text-xs hover:border-accent">
                  <input
                    type="radio"
                    name={groupName}
                    value={t.selection}
                    checked={selection === t.selection}
                    onChange={() => {
                      onChange(t.selection);
                      setOpen(false);
                    }}
                    className="mt-0.5 accent-[color:var(--color-accent)]"
                  />
                  <span>
                    <span className="font-semibold text-text">
                      {t.selection === "none" ? "適用なし（+0）" : `対象 ${affected} 能力 +${t.level}`}
                    </span>
                    <span className="block text-2xs text-text-muted">
                      {t.playerRangeLabel}
                      {t.selection === "none" ? "" : "（ユーザー指定・アプリの自動判定ではありません）"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <p className="mt-3 rounded border border-info/30 bg-info/10 px-2 py-1 text-2xs text-info">
          {CONDITIONAL_SELECTION_DISCLAIMER}
        </p>
        <p className="mt-1 text-2xs text-text-muted">
          指定しても「標準最終値」は変わりません（この金色ブースターは標準へ自動適用していません）。「条件反映後値」にのみ反映し、比較の順位・チームの通常集計には含めません。
          対象能力: {statNames.join(" / ")}。
        </p>
      </Modal>
    </div>
  );
}
