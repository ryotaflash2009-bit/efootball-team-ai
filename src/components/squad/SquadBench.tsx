"use client";

import type { SquadBuildMode } from "@/lib/squad/types";
import { SQUAD_BUILD_MODES, MAX_SUBSTITUTES } from "@/lib/squad/types";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

// ベンチ行の select は幅が狭いため、意図的に短縮ラベルを使う（他画面の
// buildModeLabelJa の「攻撃重視」等とは別物・stat-labels.ts へは集約しない）。
function useModeLabel(): Record<SquadBuildMode, string> {
  const t = useT();
  const key = (k: keyof Dictionary["bench"]) => t("bench", k);
  return {
    none: key("modeNone"),
    attack: key("modeAttack"),
    defense: key("modeDefense"),
    balance: key("modeBalance"),
    gk: key("modeGk"),
  };
}

/** ベンチ 1 行。index は squad.substitutes と 1:1（未解決カードでもズレない）。 */
export interface BenchRow {
  index: number;
  subId: string;
  worldCardId: string;
  name: string;
  registeredPosition: string | null;
  displayedOvr: number | null;
  buildMode: SquadBuildMode;
  staleBuild: boolean;
  /** この枠に保存されている savedBuildId（StoredSub 由来）。 */
  savedBuildId: string | null;
  /** savedBuildId に対応する保存ビルド名（見つからなければ null）。 */
  savedBuildName: string | null;
  state: "ok" | "loading" | "error";
}

export function SquadBench({
  rows,
  onAdd,
  onRemove,
  onBuildMode,
  onOpenBuildPanel,
  onReorder,
  onBenchClick,
  onBenchEndTarget,
  moveActive = false,
  moveSourceIndex = null,
  onDragStartSub,
  onDropSub,
  onDropEnd,
}: {
  rows: BenchRow[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onBuildMode: (index: number, mode: SquadBuildMode) => void;
  /** 「保存ビルドを選ぶ」パネルを開く。 */
  onOpenBuildPanel: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onBenchClick: (index: number) => void;
  onBenchEndTarget: () => void;
  moveActive?: boolean;
  moveSourceIndex?: number | null;
  onDragStartSub?: (index: number) => void;
  onDropSub?: (index: number) => void;
  onDropEnd?: () => void;
}) {
  const t = useT();
  const MODE_LABEL = useModeLabel();
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {t("bench", "heading")} <span className="text-xs font-normal text-text-dim">{rows.length}/{MAX_SUBSTITUTES}</span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          disabled={rows.length >= MAX_SUBSTITUTES}
          className="rounded border border-border px-2 py-1 text-xs hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("bench", "addButton")}
        </button>
      </div>

      {rows.length === 0 && !moveActive ? (
        <p className="text-xs text-text-dim">{t("bench", "empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const isSource = moveActive && r.index === moveSourceIndex;
            const isTarget = moveActive && r.index !== moveSourceIndex;
            return (
              <li
                key={r.subId}
                className={`rounded border p-2 text-xs ${
                  isSource
                    ? "border-accent bg-accent-soft/40 opacity-70"
                    : isTarget
                      ? "border-accent/60 ring-1 ring-accent/40"
                      : "border-border/60 bg-surface-2/30"
                }`}
                onDragOver={(ev) => {
                  if (onDropSub) ev.preventDefault();
                }}
                onDrop={(ev) => {
                  ev.preventDefault();
                  onDropSub?.(r.index);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    draggable={!!onDragStartSub}
                    onDragStart={() => onDragStartSub?.(r.index)}
                    onClick={() => onBenchClick(r.index)}
                    aria-label={
                      (isTarget ? t("bench", "moveCandidatePrefix") : isSource ? t("bench", "movingPrefix") : "") +
                      `${t("bench", "benchSlotLabel")} ${r.index + 1}: ${r.name}` +
                      (isTarget ? t("bench", "moveSwapSuffix") : t("bench", "moveStartSuffix"))
                    }
                    className="min-w-0 flex-1 truncate text-left hover:text-accent"
                  >
                    <span className="font-semibold">{r.name}</span>
                    <span className="ml-1 text-text-dim">
                      {r.registeredPosition ?? t("bench", "positionUnknown")} · {t("bench", "displayedOvrPrefix")}
                      {r.displayedOvr ?? t("bench", "ovrUnknown")}
                    </span>
                    {r.state === "loading" ? <span className="ml-1 text-text-muted">{t("bench", "loadingLabel")}</span> : null}
                    {r.state === "error" ? <span className="ml-1 text-danger">{t("bench", "errorLabel")}</span> : null}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onReorder(r.index, r.index - 1)}
                      disabled={r.index === 0}
                      aria-label={t("bench", "moveUpAriaTemplate").replace("{name}", r.name)}
                      className="rounded border border-border px-1 leading-none hover:border-accent disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorder(r.index, r.index + 1)}
                      disabled={r.index === rows.length - 1}
                      aria-label={t("bench", "moveDownAriaTemplate").replace("{name}", r.name)}
                      className="rounded border border-border px-1 leading-none hover:border-accent disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => onRemove(r.index)} className="text-danger hover:opacity-80">
                      {t("bench", "removeButton")}
                    </button>
                  </div>
                </div>
                {r.staleBuild ? <p className="mt-0.5 text-yellow-300">{t("bench", "staleBuildLabel")}</p> : null}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <select
                    value={r.buildMode}
                    onChange={(e) => onBuildMode(r.index, e.target.value as SquadBuildMode)}
                    aria-label={t("bench", "buildModeAriaTemplate").replace("{name}", r.name)}
                    className="rounded border border-border bg-surface px-1 py-0.5 text-[11px]"
                  >
                    {SQUAD_BUILD_MODES.map((m) => (
                      <option key={m} value={m}>
                        {MODE_LABEL[m]}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-text-dim">
                    {t("bench", "squadBuildLabelPrefix")}
                    {r.savedBuildId == null ? (
                      <span className="text-text-muted">{t("bench", "buildNotSet")}</span>
                    ) : r.savedBuildName != null ? (
                      <span className="text-accent">{r.savedBuildName}</span>
                    ) : (
                      <span className="text-yellow-300">{t("bench", "buildDeleted")}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenBuildPanel(r.index)}
                    className="rounded border border-border px-2 py-0.5 text-[11px] font-semibold hover:border-accent"
                  >
                    {t("bench", "chooseBuildButton")}
                  </button>
                </div>
              </li>
            );
          })}

          {moveActive && (moveSourceIndex == null || rows.length < MAX_SUBSTITUTES) ? (
            <li
              onDragOver={(ev) => {
                if (onDropEnd) ev.preventDefault();
              }}
              onDrop={(ev) => {
                ev.preventDefault();
                onDropEnd?.();
              }}
            >
              <button
                type="button"
                onClick={onBenchEndTarget}
                aria-label={t("bench", "moveToBenchAria")}
                className="w-full rounded border border-dashed border-accent/60 px-2 py-2 text-center text-2xs text-accent hover:bg-accent/10"
              >
                {t("bench", "moveToBenchButton")}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
