"use client";

import "@/lib/i18n/dictionaries/ja-ns/abilityEditor";
import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComparisonPlayerInput, ComparisonResult } from "@/lib/comparison/types";
import type { SavedBuild } from "@/lib/progression/types";
import type { AbilityFocus } from "@/lib/progression/ability-direct-editor";
import { calculateComparisonPlayer } from "@/lib/comparison/build-comparison";
import { listBuilds } from "@/lib/progression/build-storage";
import { saveCurrentBuild } from "@/lib/progression/save-current-build";
import { localizeBuildStorageError } from "@/lib/progression/build-storage-errors";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { AbilityProgressionEditor } from "@/components/world/progression/ability-editor/AbilityProgressionEditor";
import { StatBadge } from "@/components/world/StatBadge";

const NO_ALLOCATION: Record<string, number> = {};

/**
 * 比較画面の「能力から育成」: 1人ずつ編集する明確な編集モード（全画面のシート）。
 *
 * - 編集対象の選手を上部に明示し、変更はその選手の配分だけ（ComparisonBoard の setLevel / adjustLevel = adjustGroupLevel）。
 * - 能力値一覧・下部の育成パネルは World 選手詳細と同じ部品。計算は比較表と同じ calculateComparisonPlayer。
 * - 選んだ能力について、比較中の他の選手の値を並べる（他の選手の配分は変えない）。
 * - 保存は既存の保存契約（saveCurrentBuild）。保存したビルドはその選手の列へ関連付く。
 */
export function CompareAbilityEditSheet({
  players,
  comparison,
  allocations,
  index,
  onIndex,
  onClose,
  onSetLevel,
  onAdjustLevel,
  onBuildSaved,
  onSaveAs,
}: {
  players: ComparisonPlayerInput[];
  comparison: ComparisonResult;
  /** 各選手の現在の配分（ComparisonBoard の perBuild と同じ）。 */
  allocations: Record<string, number>[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onSetLevel: (idx: number, groupId: string, level: number) => void;
  onAdjustLevel: (idx: number, groupId: string, delta: number) => void;
  onBuildSaved: (idx: number, build: SavedBuild) => void;
  /** 名前を付けて保存（既存の保存ダイアログ）。 */
  onSaveAs: (idx: number) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const ref = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<AbilityFocus | null>(null);
  const player = players[index];
  const allocation = allocations[index] ?? NO_ALLOCATION;
  const nameOf = useCallback(
    (p: ComparisonPlayerInput) =>
      resolvePlayerDisplayName(p.display, locale, tp("cardFallbackName").replace("{id}", p.display.worldCardId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, t],
  );

  const calculate = useCallback((alloc: Record<string, number>) => calculateComparisonPlayer(player, alloc), [player]);
  const result = useMemo(() => calculate(allocation), [calculate, allocation]);
  const dirty = Object.keys(allocation).length > 0 && !player.savedBuildName;

  // 開いている間: 背景のスクロールを止め、Escape で閉じる（育成パネルが開いているときは、まずパネルの選択解除に使う）。
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-sheet-close]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-testid=progression-dock]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [onClose]);

  const titleId = "compare-ability-sheet-title";
  const others = comparison.players
    .map((cp, i) => ({ cp, i }))
    .filter(({ i }) => i !== index);
  const focusStat = focus?.primaryStat ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} data-testid="compare-ability-sheet">
      <div className="shrink-0 border-b border-border bg-surface px-3 py-2">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base font-bold">
              {tp("cmpSheetTitle").replace("{name}", nameOf(player))}
            </h2>
            <p className="text-2xs text-text-dim">{tp("cmpSheetSubtitle").replace("{index}", String(index + 1))}</p>
          </div>
          <button
            type="button"
            data-sheet-close
            onClick={onClose}
            className="min-h-[44px] shrink-0 rounded-md border border-border px-3 text-xs font-semibold text-text-dim hover:border-accent hover:text-text"
          >
            {tp("cmpClose")}
          </button>
        </div>
        {players.length > 1 ? (
          <div role="tablist" aria-label={tp("cmpSwitchPlayer")} className="mx-auto mt-1.5 flex max-w-3xl gap-1.5 overflow-x-auto">
            {players.map((p, i) => (
              <button
                key={p.display.worldCardId}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => onIndex(i)}
                className={`min-h-[44px] shrink-0 rounded-md border px-3 text-xs ${
                  i === index ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border text-text-dim hover:border-accent"
                }`}
              >
                {i + 1}. {nameOf(p)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mx-auto mt-1.5 max-w-3xl text-2xs" data-testid="compare-others" aria-live="polite">
          {focusStat ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-text-dim">{tp("cmpOthersHeading").replace("{ability}", abilityName(focusStat, locale))}:</span>
              {others.map(({ cp, i }) => (
                <span key={cp.input.display.worldCardId} className="inline-flex items-center gap-1">
                  <span className="max-w-[9rem] truncate text-text-dim">
                    {i + 1}. {nameOf(cp.input)}
                  </span>
                  <StatBadge value={cp.result.stats.find((s) => s.key === focusStat)?.finalValue ?? null} />
                </span>
              ))}
            </div>
          ) : (
            <span className="text-text-muted">{tp("cmpOthersHint")}</span>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3">
        <div className="mx-auto max-w-3xl">
          <AbilityProgressionEditor
            key={player.display.worldCardId}
            card={player.card}
            allocation={allocation}
            result={result}
            calculate={calculate}
            canProgress={(player.card.maximumLevel ?? 0) > 1}
            showConditional={result.booster.hasConditionalSelection}
            dirty={dirty}
            onSetLevel={(g, l) => onSetLevel(index, g, l)}
            onAdjust={(g, d) => onAdjustLevel(index, g, d)}
            onGoToSave={() => onSaveAs(index)}
            onQuickSave={() => {
              const r = saveCurrentBuild({
                worldCardId: player.display.worldCardId,
                buildName: t("abilityEditor", "quickSaveName").replace("{n}", String(listBuilds(player.display.worldCardId).length + 1)),
                allocation,
                result,
                selectedBooster: null,
                conditionalBoosterSelections: player.selectedConditionalBoosters,
              });
              if (!r.ok) return { ok: false, message: t("abilityEditor", "saveFailed").replace("{reason}", localizeBuildStorageError(r.error, locale)) };
              onBuildSaved(index, r.build);
              return { ok: true, message: t("abilityEditor", "saveSucceeded").replace("{name}", r.build.buildName) };
            }}
            onFocusChange={setFocus}
          />
        </div>
      </div>
    </div>
  );
}
