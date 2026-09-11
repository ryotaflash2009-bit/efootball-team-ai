"use client";

import { useState, type ReactNode } from "react";
import type { StatBreakdown, BoosterApplicationMode } from "@/lib/progression/types";
import type { WorldStatGroup } from "@/lib/world/types";
import { WORLD_STAT_GROUP_LABELS } from "@/lib/world/stats";
import { statLabelJa } from "@/lib/world/stat-labels";
import { StatBadge } from "@/components/world/StatBadge";

/**
 * 通常表示向けの簡潔な能力値一覧。
 *  - 1行 = 能力名 / 合計増減 / 最終値。色だけに依存せず数値と符号を必ず表示。
 *  - 行をクリック / Enter で内訳（基礎・育成・固定ブースター・Power of Many・監督・標準最終・条件反映後）を展開。
 *  - GK 能力は既定で折りたたみ（GK でない選手でも確認可能）。
 * 詳細な表形式の内訳は別コンポーネント（StatComparison）を「計算根拠」内に残す。
 */
const GROUP_ORDER: WorldStatGroup[] = ["offense", "physical", "defense", "gk"];

function Delta({ value, className = "" }: { value: number; className?: string }) {
  if (value === 0) return <span className={`text-text-dim/50 ${className}`}>±0</span>;
  const positive = value > 0;
  return (
    <span className={`tabular-nums ${positive ? "text-lime-300" : "text-danger"} ${className}`}>
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

function BreakdownRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-text-dim">{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

function StatRow({
  s,
  showConditional,
  showExperimental,
}: {
  s: StatBreakdown;
  showConditional: boolean;
  showExperimental: boolean;
}) {
  const [open, setOpen] = useState(false);
  const conditionalDiffers = showConditional && s.conditionalFinalValue !== s.standardFinalValue;
  const shownFinal = conditionalDiffers ? s.conditionalFinalValue : s.finalValue;
  const totalDelta = shownFinal - s.baseValue;

  return (
    <li className="border-t border-border/50 first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2/40"
      >
        <span className="min-w-0 flex-1 truncate" title={s.nameEn}>{statLabelJa(s.key)}</span>
        <span className="w-10 shrink-0 text-right text-xs">
          <Delta value={totalDelta} />
        </span>
        <span className="shrink-0">
          <StatBadge value={shownFinal} />
        </span>
        {conditionalDiffers ? (
          <span className="shrink-0 text-2xs text-accent" title="条件反映後値">条</span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span aria-hidden="true" className="shrink-0 text-2xs text-text-muted">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div className="bg-surface-2/30 px-3 pb-2.5 pt-1 text-xs">
          <BreakdownRow label="基礎">{s.baseValue}</BreakdownRow>
          <BreakdownRow label="育成">
            <Delta value={s.progressionDelta} />
          </BreakdownRow>
          <BreakdownRow label="固定ブースター">
            <Delta value={s.playerBoosterDelta} />
          </BreakdownRow>
          {s.confirmedB2BoosterDelta !== 0 ? (
            <BreakdownRow label="うち確認済みB2（手動選択）">
              <Delta value={s.confirmedB2BoosterDelta} />
            </BreakdownRow>
          ) : null}
          {showConditional || s.conditionalBoosterDelta !== 0 ? (
            <BreakdownRow label="Power of Many（ユーザー指定）">
              <Delta value={s.conditionalBoosterDelta} className="text-accent" />
            </BreakdownRow>
          ) : null}
          {showExperimental ? (
            <BreakdownRow label="実験的試算">
              <Delta value={s.experimentalPlayerBoosterDelta} className="text-yellow-300/90" />
            </BreakdownRow>
          ) : null}
          <BreakdownRow label="監督">
            <Delta value={s.managerBoosterDelta} />
          </BreakdownRow>
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/50 pt-1">
            <span className="font-semibold text-text-dim">標準最終</span>
            <span className="font-bold tabular-nums">
              {s.standardFinalValue}
              {s.capApplied ? <span className="ml-1 text-[9px] text-yellow-300/80">上限</span> : null}
            </span>
          </div>
          {showConditional ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-accent">条件反映後</span>
              <span className={`font-bold tabular-nums ${conditionalDiffers ? "text-accent" : "text-text-dim"}`}>
                {s.conditionalFinalValue}
                {s.conditionalCapApplied ? <span className="ml-1 text-[9px] text-yellow-300/80">上限</span> : null}
              </span>
            </div>
          ) : null}
          {showExperimental ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-yellow-300/90">試算最終</span>
              <span className="font-bold tabular-nums text-yellow-300">{s.experimentalFinalValue}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function GroupTable({
  label,
  rows,
  showConditional,
  showExperimental,
}: {
  label: string;
  rows: StatBreakdown[];
  showConditional: boolean;
  showExperimental: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <p className="bg-surface-2/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-text-dim">
        {label}
      </p>
      <ul>
        {rows.map((s) => (
          <StatRow key={s.key} s={s} showConditional={showConditional} showExperimental={showExperimental} />
        ))}
      </ul>
    </div>
  );
}

export function CompactStatGrid({
  stats,
  mode = "standard",
  showConditional = false,
  showExperimental = false,
  defaultOpenGk = false,
}: {
  stats: StatBreakdown[];
  mode?: BoosterApplicationMode;
  showConditional?: boolean;
  showExperimental?: boolean;
  /** GK カードのときは GK 能力を初期展開する。 */
  defaultOpenGk?: boolean;
}) {
  const byGroup = new Map<WorldStatGroup, StatBreakdown[]>();
  for (const s of stats) {
    const arr = byGroup.get(s.group) ?? [];
    arr.push(s);
    byGroup.set(s.group, arr);
  }

  return (
    <div className="space-y-3">
      <p className="text-2xs text-text-muted">
        行をタップで内訳（基礎・育成・固定ブースター・Power of Many・監督）を展開。
        <span className="text-accent">「条」</span>= 条件反映後値が標準最終と異なる能力。
        表示中の最終値は{mode === "strict" ? "厳密" : "標準"}モード基準です。
      </p>

      <div className="grid gap-3 xl:grid-cols-2">
        {GROUP_ORDER.filter((g) => g !== "gk").map((g) => {
          const rows = byGroup.get(g);
          if (!rows || rows.length === 0) return null;
          return (
            <GroupTable
              key={g}
              label={WORLD_STAT_GROUP_LABELS[g]}
              rows={rows}
              showConditional={showConditional}
              showExperimental={showExperimental}
            />
          );
        })}
      </div>

      {(byGroup.get("gk")?.length ?? 0) > 0 ? (
        <details open={defaultOpenGk} className="rounded-md border border-border">
          <summary className="cursor-pointer bg-surface-2/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-text-dim">
            {WORLD_STAT_GROUP_LABELS.gk}（GK 能力・折りたたみ）
          </summary>
          <ul>
            {byGroup.get("gk")!.map((s) => (
              <StatRow key={s.key} s={s} showConditional={showConditional} showExperimental={showExperimental} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
