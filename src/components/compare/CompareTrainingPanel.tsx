"use client";

import { useId, useState } from "react";
import type { AutoAllocateProfile, PointsSummary, ProgressionGroup } from "@/lib/progression/types";
import { ProgressionSlider } from "@/components/world/progression/ProgressionSlider";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

function useProfileLabels(): Record<AutoAllocateProfile, string> {
  const t = useT();
  return {
    attack: t("bench", "modeAttack"),
    defense: t("bench", "modeDefense"),
    balance: t("bench", "modeBalance"),
    gk: t("bench", "modeGk"),
  };
}

/**
 * 比較列 / 比較コックピットの中でその選手を直接育成するパネル。
 *  - スライダー・段階コスト・残りポイント・上限・不正配分の制御は既存 engine（group-allocation）が担保。
 *  - `ProgressionSlider` をそのまま再利用（比較専用の育成 UI を作らない）。
 *  - 変更は即時に 26 能力値比較・レーダー・近接プレビューへ反映される（親が state を更新 → buildComparison が再計算）。
 *  - `embedded`: コックピット用に常時展開（折りたたみボタンなし）。
 *  - `onCategoryTouch`: 最後に操作したカテゴリ（groupId）を親へ通知（近接プレビューの対象に使う）。
 */

// 表示ラベルは i18n の bench.mode* に集約。ここは順序と値のみ定義。
const PROFILES: AutoAllocateProfile[] = ["attack", "defense", "balance", "gk"];

export function CompareTrainingPanel({
  name,
  isGk,
  groups,
  points,
  canProgress,
  hasManualAllocation,
  embedded = false,
  onSetLevel,
  onAdjustLevel,
  onAutoProfile,
  onReset,
  onCategoryTouch,
  onOpenSaveDialog,
}: {
  name: string;
  isGk: boolean;
  groups: ProgressionGroup[];
  points: PointsSummary;
  canProgress: boolean;
  hasManualAllocation: boolean;
  embedded?: boolean;
  onSetLevel: (groupId: string, level: number) => void;
  onAdjustLevel: (groupId: string, delta: number) => void;
  onAutoProfile: (profile: AutoAllocateProfile) => void;
  onReset: () => void;
  onCategoryTouch?: (groupId: string) => void;
  /** 「この育成を保存」（比較コックピットのみ）。未指定なら非表示。 */
  onOpenSaveDialog?: () => void;
}) {
  const [open, setOpen] = useState(embedded);
  const [announce, setAnnounce] = useState("");
  const liveId = useId();
  const t = useT();
  const ttp = (k: keyof Dictionary["compareTrainingPanel"]) => t("compareTrainingPanel", k);
  const fillTp = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const profileLabels = useProfileLabels();

  const fieldGroups = groups.filter((g) => !g.groupId.startsWith("goalkeeping"));
  const gkGroups = groups.filter((g) => g.groupId.startsWith("goalkeeping"));
  const gkLevel = gkGroups.reduce((n, g) => n + g.allocatedPoints, 0);
  const shown = embedded || open;

  const setLevel = (groupId: string, level: number) => {
    onSetLevel(groupId, level);
    onCategoryTouch?.(groupId);
  };
  const adjustLevel = (groupId: string, delta: number) => {
    onAdjustLevel(groupId, delta);
    onCategoryTouch?.(groupId);
  };

  const body = (
    <div className={`flex flex-col gap-2 ${embedded ? "" : "mt-1.5"}`}>
      {!canProgress ? (
        <p className="text-[10px] text-text-dim">{ttp("cannotProgressNote")}</p>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {PROFILES.map((p) => (
          <button
            key={p}
            type="button"
            disabled={!canProgress}
            onClick={() => {
              onAutoProfile(p);
              setAnnounce(fillTp(ttp("autoAllocatedAnnounceTemplate"), { name, mode: profileLabels[p] }));
            }}
            className="min-h-[32px] rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] hover:enabled:border-accent disabled:opacity-40"
          >
            {profileLabels[p]}
          </button>
        ))}
        <button
          type="button"
          disabled={!hasManualAllocation && points.usedPoints === 0}
          onClick={() => {
            onReset();
            setAnnounce(fillTp(ttp("resetAnnounceTemplate"), { name }));
          }}
          className="min-h-[32px] rounded border border-border px-1.5 py-0.5 text-[10px] text-danger hover:enabled:opacity-80 disabled:opacity-40"
        >
          {ttp("resetButton")}
        </button>
        {onOpenSaveDialog ? (
          <button
            type="button"
            onClick={onOpenSaveDialog}
            className="min-h-[32px] rounded border border-accent bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:opacity-90"
          >
            {ttp("saveThisBuildButton")}
          </button>
        ) : null}
      </div>

      <p className="text-[10px] text-text-muted">{ttp("autoAllocateNote")}</p>

      <div className="flex items-center justify-between text-[10px] text-text-dim">
        <span>{fillTp(ttp("usedPointsLabel"), { value: String(points.usedPoints) })}</span>
        <span className={points.remainingPoints > 0 ? "text-text" : "text-text-dim/60"}>
          {fillTp(ttp("remainingPointsLabel"), { value: String(points.remainingPoints) })}
        </span>
        <span>{points.overAllocated ? ttp("overAllocatedLabel") : fillTp(ttp("totalPointsLabel"), { value: String(points.totalPoints) })}</span>
      </div>

      <div className="flex flex-col gap-2">
        {fieldGroups.map((g) => (
          <ProgressionSlider key={g.groupId} group={g} disabled={!canProgress} onSet={setLevel} onAdjust={adjustLevel} />
        ))}
      </div>

      {gkGroups.length > 0 ? (
        <details open={isGk} className="rounded border border-border bg-surface-2/20">
          <summary className="flex min-h-[32px] cursor-pointer items-center justify-between gap-2 px-2 py-1 text-[11px] font-semibold">
            <span>{ttp("gkHeading")}</span>
            <span className="shrink-0 text-[9px] font-normal text-text-dim">
              {fillTp(ttp("gkLevelLabelTemplate"), { level: String(gkLevel) })}
              {isGk ? ttp("gkExpandedSuffix") : ttp("gkCollapsedSuffix")}
            </span>
          </summary>
          <div className="flex flex-col gap-2 border-t border-border p-1.5">
            {gkGroups.map((g) => (
              <ProgressionSlider key={g.groupId} group={g} disabled={!canProgress} onSet={setLevel} onAdjust={adjustLevel} />
            ))}
          </div>
        </details>
      ) : null}

      <p className="text-[9px] text-text-muted">{ttp("definitionNote")}</p>
    </div>
  );

  return (
    <div className="rounded border border-border bg-surface-2/30 p-1.5">
      {embedded ? (
        <p className="flex items-center justify-between gap-2 text-[11px] font-semibold">
          <span>
            {fillTp(ttp("embeddedHeadingTemplate"), { name })}
            {hasManualAllocation ? ttp("manualSuffix") : ""}
          </span>
          <span className="shrink-0 font-normal text-text-dim">
            {points.usedPoints} / {points.totalPoints}pt
          </span>
        </p>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold"
        >
          <span>
            {ttp("collapsedHeading")}
            {hasManualAllocation ? ttp("manualSuffix") : ""}
          </span>
          <span className="shrink-0 font-normal text-text-dim">
            {points.usedPoints} / {points.totalPoints}pt {open ? "▲" : "▼"}
          </span>
        </button>
      )}

      <p aria-live="polite" id={liveId} className="sr-only">
        {announce}
      </p>

      {shown ? body : null}
    </div>
  );
}
