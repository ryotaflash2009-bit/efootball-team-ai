"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { PointsSummary, ProgressionCard, ProgressionResult } from "@/lib/progression/types";
import {
  INITIAL_EDITOR_STATE,
  abilityDiffs,
  allocationChips,
  allocationWithGroupLevel,
  costBetweenLevels,
  editorReducer,
  groupSliderModel,
  nextCostAtLevel,
} from "@/lib/progression/ability-direct-editor";
import { abilityName, categoryName } from "@/lib/progression/ability-editor-labels";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { AbilityDirectList } from "./AbilityDirectList";
import { ProgressionDock } from "./ProgressionDock";

/**
 * 能力値直接操作・スライド式育成UI（能力一覧 + 画面下部の育成パネル）。
 *
 * - ビルドの配分（allocation）は親が持つ唯一の状態。ここは「どの能力を選んでいるか」「ドラッグ中のプレビュー」だけを持つ。
 * - ＋／－は親の onAdjust（差分・関数型更新 = 連打しても古い値を使わない）、スライダー・キー操作・元に戻すは onSetLevel を通る。
 *   どちらも adjustGroupLevel。プレビューは同じ calculate を使う。
 * - 保存は既存の保存契約だけ（onQuickSave = 保存欄と同じ関数）。
 */
export function AbilityProgressionEditor({
  card,
  allocation,
  result,
  calculate,
  canProgress,
  showConditional,
  dirty,
  onSetLevel,
  onAdjust,
  onGoToSave,
  onQuickSave,
  onPreviewPoints,
}: {
  card: ProgressionCard;
  allocation: Record<string, number>;
  result: ProgressionResult;
  calculate: (allocation: Record<string, number>) => ProgressionResult;
  canProgress: boolean;
  showConditional: boolean;
  /** 保存済み（読み込んだ）配分と違う（未保存の変更がある）。 */
  dirty: boolean;
  onSetLevel: (groupId: string, level: number) => void;
  onAdjust: (groupId: string, delta: number) => void;
  onGoToSave: () => void;
  onQuickSave: () => { ok: boolean; message: string };
  /** ドラッグ中のプレビューのポイント（ドラッグしていなければ null）。上部バーの表示を揃えるため。 */
  onPreviewPoints?: (points: PointsSummary | null) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE);
  const { focus, baseline, dragLevel, dragBlocked } = state;
  const groupId = focus?.groupId ?? null;
  const [saveNotice, setSaveNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const model = useMemo(() => (groupId ? groupSliderModel(allocation, card, groupId) : null), [allocation, card, groupId]);

  const baselineResult = useMemo(() => (baseline ? calculate(baseline) : null), [baseline, calculate]);
  const previewAllocation = useMemo(
    () => (groupId && dragLevel != null ? allocationWithGroupLevel(allocation, card, groupId, dragLevel) : null),
    [allocation, card, groupId, dragLevel],
  );
  const previewResult = useMemo(() => (previewAllocation ? calculate(previewAllocation) : null), [previewAllocation, calculate]);
  const shown = previewResult ?? result;
  const diffs = useMemo(() => abilityDiffs((baselineResult ?? result).stats, shown.stats), [baselineResult, result, shown]);
  const chips = useMemo(() => allocationChips(previewAllocation ?? allocation, card), [previewAllocation, allocation, card]);

  const level = groupId ? (previewAllocation ?? allocation)[groupId] ?? 0 : 0;
  const baselineLevel = groupId && baseline ? baseline[groupId] ?? 0 : level;

  useEffect(() => {
    onPreviewPoints?.(previewResult ? previewResult.points : null);
  }, [previewResult, onPreviewPoints]);

  // 変更したら保存結果の表示を消す（保存前と保存後を混同しない）。
  const committedKey = JSON.stringify(allocation);
  const lastSavedKey = useRef<string | null>(null);
  useEffect(() => {
    if (saveNotice && lastSavedKey.current !== committedKey) setSaveNotice(null);
  }, [committedKey, saveNotice]);

  // 確定したレベルだけを読み上げる（ドラッグ中は読み上げない・400ms まとめる）。
  const committedLevel = groupId ? allocation[groupId] ?? 0 : null;
  const remainingCommitted = result.points.remainingPoints;
  useEffect(() => {
    if (!groupId || committedLevel == null || dragLevel != null) return;
    const id = window.setTimeout(() => {
      setAnnouncement(
        t("abilityEditor", "announceLevel")
          .replace("{category}", categoryName(groupId, locale))
          .replace("{level}", String(committedLevel))
          .replace("{remaining}", String(remainingCommitted)),
      );
    }, 400);
    return () => window.clearTimeout(id);
  }, [groupId, committedLevel, dragLevel, remainingCommitted, locale, t]);

  // 能力を選んだとき: 読み上げ、選んだ行がパネルの下に隠れるならパネルの上まで送る。
  const primaryStat = focus?.primaryStat ?? null;
  useEffect(() => {
    if (!primaryStat || !groupId) return;
    setAnnouncement(
      t("abilityEditor", "announceSelected")
        .replace("{ability}", abilityName(primaryStat, locale))
        .replace("{category}", categoryName(groupId, locale)),
    );
    const id = window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-stat="${primaryStat}"]`);
      const dock = document.querySelector<HTMLElement>("[data-testid=progression-dock]");
      if (!row || !dock) return;
      // パネルは開くときに最大 12px 下から入るため、その分を見込む。
      const overlap = row.getBoundingClientRect().bottom - (dock.getBoundingClientRect().top - 12) + 12;
      if (overlap > 0) {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        window.scrollBy({ top: overlap, behavior: reduce ? "auto" : "smooth" });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [primaryStat, groupId, locale, t]);

  // Escape で選択を解除（入力中の要素は除く）。
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      dispatch({ type: "clear" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  const relatedDiffs = focus
    ? focus.relatedStats.map((k) => diffs.get(k)).filter((d): d is NonNullable<typeof d> => d != null)
    : [];
  const primary = focus?.primaryStat ? shown.stats.find((s) => s.key === focus.primaryStat) ?? null : null;

  return (
    <div className="flex flex-col" data-testid="ability-progression-editor">
      <p className="mb-2 text-2xs text-text-muted">{t("abilityEditor", "sectionHint")}</p>
      <AbilityDirectList
        stats={shown.stats}
        diffs={diffs}
        focus={focus}
        showConditional={showConditional}
        defaultOpenGk={card.registeredPosition === "GK"}
        onSelect={(statKey) => dispatch({ type: "selectStat", statKey, allocation })}
        onSkipToPanel={() => document.querySelector<HTMLElement>("[data-testid=category-slider]")?.focus()}
      />
      <p className="sr-only" aria-live="polite" data-testid="editor-announcement">
        {announcement}
      </p>
      <ProgressionDock
        focus={focus}
        model={model}
        level={level}
        dragging={dragLevel != null}
        blocked={dragBlocked}
        canProgress={canProgress}
        chips={chips}
        showGoalkeeping={card.registeredPosition === "GK"}
        remainingPoints={shown.points.remainingPoints}
        totalPoints={shown.points.totalPoints}
        baselineLevel={baselineLevel}
        pointsChange={costBetweenLevels(baselineLevel, level)}
        nextCost={model ? nextCostAtLevel(level, model.absoluteMax) : null}
        primary={primary}
        relatedDiffs={relatedDiffs}
        dirty={dirty}
        saveNotice={saveNotice}
        onSelectGroup={(g) => dispatch({ type: "selectGroup", groupId: g, allocation })}
        onClear={() => dispatch({ type: "clear" })}
        onStep={(delta) => groupId && onAdjust(groupId, delta)}
        onDragStart={(lv) => dispatch({ type: "dragStart", level: lv })}
        onDragMove={(requested) => model && dispatch({ type: "dragMove", requested, model })}
        onDragEnd={(requested) => {
          // 到達可能上限で止める（adjustGroupLevel も同じ上限で丸める）。
          if (groupId && model) {
            const target = Math.max(0, Math.min(requested, model.reachableMax));
            if (target !== model.current) onSetLevel(groupId, target);
          }
          dispatch({ type: "dragEnd" });
        }}
        onDragCancel={() => dispatch({ type: "dragCancel" })}
        onKeyLevel={(lv) => groupId && onSetLevel(groupId, lv)}
        onRevert={() => groupId && onSetLevel(groupId, baselineLevel)}
        onGoToSave={onGoToSave}
        onQuickSave={() => {
          const r = onQuickSave();
          lastSavedKey.current = committedKey;
          setSaveNotice(r);
        }}
      />
    </div>
  );
}
