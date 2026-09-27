"use client";

import { useEffect, useMemo, useReducer } from "react";
import type { ProgressionCard, ProgressionResult } from "@/lib/progression/types";
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
import { useT } from "@/lib/i18n/LocaleContext";
import { AbilityDirectList } from "./AbilityDirectList";
import { ProgressionDock } from "./ProgressionDock";

/**
 * 能力値直接操作・スライド式育成UI（能力一覧 + 画面下部の育成パネル）。
 *
 * - ビルドの配分（allocation）は親が持つ唯一の状態。ここは「どの能力を選んでいるか」「ドラッグ中のプレビュー」だけを持つ。
 * - ＋／－・キー操作・スライダーの確定は、親の onSetLevel（= adjustGroupLevel）を通る。プレビューは同じ calculate を使う。
 * - 保存は既存の明示的な保存操作だけ（ここでは保存しない）。
 */
export function AbilityProgressionEditor({
  card,
  allocation,
  result,
  calculate,
  canProgress,
  showConditional,
  onSetLevel,
  onGoToSave,
}: {
  card: ProgressionCard;
  allocation: Record<string, number>;
  result: ProgressionResult;
  calculate: (allocation: Record<string, number>) => ProgressionResult;
  canProgress: boolean;
  showConditional: boolean;
  onSetLevel: (groupId: string, level: number) => void;
  onGoToSave: () => void;
}) {
  const t = useT();
  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE);
  const { focus, baseline, dragLevel, dragBlocked } = state;
  const groupId = focus?.groupId ?? null;

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
      />
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
        onSelectGroup={(g) => dispatch({ type: "selectGroup", groupId: g, allocation })}
        onClear={() => dispatch({ type: "clear" })}
        onStep={(delta) => groupId && model && onSetLevel(groupId, model.current + delta)}
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
      />
    </div>
  );
}
