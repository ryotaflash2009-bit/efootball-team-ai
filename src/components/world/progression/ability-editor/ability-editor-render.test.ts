import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { calculateBuild } from "@/lib/progression/engine";
import { MESSI_BIGTIME, NEAR_CAP_CARD } from "@/lib/progression/fixtures";
import {
  abilityDiffs,
  allocationChips,
  allocationWithGroupLevel,
  costBetweenLevels,
  focusForStat,
  groupSliderModel,
  nextCostAtLevel,
} from "@/lib/progression/ability-direct-editor";
import type { ProgressionCard } from "@/lib/progression/types";
import { AbilityDirectList } from "./AbilityDirectList";
import { ProgressionDock } from "./ProgressionDock";
import { AbilityProgressionEditor } from "./AbilityProgressionEditor";

/** 実ブラウザーを使わない DOM 構造の確認（SSR マークアップ）。操作は black-box で確認する。 */

const noop = () => undefined;
const render = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(LocaleProvider, null, el));

function dockMarkup(card: ProgressionCard, before: Record<string, number>, after: Record<string, number>, stat: string, opts: { blocked?: boolean; dirty?: boolean; saveNotice?: { ok: boolean; message: string } | null } = {}) {
  const f = focusForStat(stat);
  if (!f.ok) throw new Error("focus");
  const model = groupSliderModel(after, card, f.focus.groupId);
  const b = calculateBuild({ card, allocation: before });
  const a = calculateBuild({ card, allocation: after });
  const diffs = abilityDiffs(b.stats, a.stats);
  const level = after[f.focus.groupId] ?? 0;
  const baselineLevel = before[f.focus.groupId] ?? 0;
  return render(
    createElement(ProgressionDock, {
      focus: f.focus,
      model,
      level,
      dragging: false,
      blocked: opts.blocked ?? false,
      canProgress: true,
      chips: allocationChips(after, card),
      showGoalkeeping: false,
      remainingPoints: a.points.remainingPoints,
      totalPoints: a.points.totalPoints,
      baselineLevel,
      pointsChange: costBetweenLevels(baselineLevel, level),
      nextCost: nextCostAtLevel(level, model.absoluteMax),
      shortfall: 0,
      primary: a.stats.find((s) => s.key === stat) ?? null,
      relatedDiffs: f.focus.relatedStats.map((k) => diffs.get(k)!),
      dirty: opts.dirty ?? true,
      saveNotice: opts.saveNotice ?? null,
      onQuickSave: noop,
      onSelectGroup: noop,
      onClear: noop,
      onStep: noop,
      onDragStart: noop,
      onDragMove: noop,
      onDragEnd: noop,
      onDragCancel: noop,
      onKeyLevel: noop,
      onRevert: noop,
      onGoToSave: noop,
    }),
  );
}

describe("能力一覧（選択状態の DOM）", () => {
  it("primary は aria-pressed=true と「選択中」、関連は data-role=related、無関係は unrelated（押せる button のまま）", () => {
    const f = focusForStat("tightPossession");
    if (!f.ok) throw new Error();
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    const html = render(createElement(AbilityDirectList, { stats: r.stats, diffs: new Map(), focus: f.focus, showConditional: false, defaultOpenGk: false, onSelect: noop }));
    expect(html).toMatch(/<button type="button" data-role="primary" data-stat="tightPossession" aria-pressed="true"/);
    expect(html).toContain("選択中");
    for (const k of ["ballControl", "dribbling"]) expect(html).toMatch(new RegExp(`data-role="related" data-stat="${k}" aria-pressed="false"`));
    expect(html).toMatch(/data-role="unrelated" data-stat="finishing" aria-pressed="false"/);
    expect((html.match(/<button type="button" data-role=/g) ?? []).length).toBe(26);
  });

  it("未選択では全行 none（暗くしない）", () => {
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    const html = render(createElement(AbilityDirectList, { stats: r.stats, diffs: new Map(), focus: null, showConditional: false, defaultOpenGk: false, onSelect: noop }));
    expect(html).not.toMatch(/data-role="(primary|related|unrelated)"/);
  });
});

describe("育成パネル（ARIA・数値・状態）", () => {
  it("スライダーの ARIA 値、必要ポイント、残り、関連能力のプレビュー、44px の＋／－", () => {
    const after = allocationWithGroupLevel({}, MESSI_BIGTIME, "dribbling", 8);
    const html = dockMarkup(MESSI_BIGTIME, {}, after, "tightPossession");
    expect(html).toMatch(/role="slider"[^>]*aria-valuemin="0"[^>]*aria-valuemax="13"[^>]*aria-valuenow="8"/);
    expect(html).toContain('aria-valuetext="ドリブル レベル 8（最大到達 13、残り 51pt）"');
    expect(html).toContain("必要ポイント");
    expect(html).toContain('必要ポイント: <span class="font-semibold text-text">11pt</span>');
    expect(html).toContain('ボールキープ 86→<span class="text-text">94</span>');
    expect(html).toContain('aria-label="ドリブル のレベルを1上げる"');
    expect(html).toContain('aria-label="ドリブル のレベルを1下げる"');
    expect((html.match(/h-11 w-11/g) ?? []).length).toBe(2);
    expect(html).toMatch(/data-testid="dock-done" class="min-h-\[44px\]/);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="ドリブル レベル 8"/);
  });

  it("下げた場合は返却ポイントを表示する", () => {
    const before = allocationWithGroupLevel({}, MESSI_BIGTIME, "dribbling", 8);
    const after = allocationWithGroupLevel({}, MESSI_BIGTIME, "dribbling", 5);
    const html = dockMarkup(MESSI_BIGTIME, before, after, "dribbling");
    expect(html).toContain("返却ポイント");
    expect(html).toContain('返却ポイント: <span class="font-semibold text-lime-300">6pt</span>');
  });

  it("ポイント不足: ＋は disabled、理由を表示、到達不能区間を描く", () => {
    const after = allocationWithGroupLevel({}, MESSI_BIGTIME, "defending", 57);
    const html = dockMarkup(MESSI_BIGTIME, {}, after, "tackling");
    expect(html).toMatch(/aria-label="ディフェンス のレベルを1上げる"[^>]*disabled=""/);
    expect(html).toContain("ポイントが不足しています");
    expect(html).toContain("cat-slider-blocked");
    const blocked = dockMarkup(MESSI_BIGTIME, {}, after, "tackling", { blocked: true });
    expect(blocked).toContain("この位置まで上げるにはポイントが不足しています");
  });

  it("カテゴリ上限: MAX 表示と「このカテゴリは最大です」", () => {
    const after = allocationWithGroupLevel({}, NEAR_CAP_CARD, "dribbling", 9);
    const html = dockMarkup(NEAR_CAP_CARD, {}, after, "dribbling");
    expect(html).toContain("このカテゴリは最大です");
    expect(html).toContain("MAX");
  });
});

describe("人間工学の改善（保存状態・完了・戻す・手がかり）", () => {
  it("未保存を文字で示し、1タップ保存（保存）と名前を付けて保存がある。保存済みなら保存は無効", () => {
    const after = allocationWithGroupLevel({}, MESSI_BIGTIME, "dribbling", 3);
    const dirtyHtml = dockMarkup(MESSI_BIGTIME, {}, after, "tightPossession", { dirty: true });
    expect(dirtyHtml).toMatch(/data-testid="save-state" data-dirty="true"[^>]*>● 未保存</);
    expect(dirtyHtml).toMatch(/data-testid="quick-save"[^>]*>保存</);
    expect(dirtyHtml).toContain("名前を付けて保存");
    const savedHtml = dockMarkup(MESSI_BIGTIME, {}, after, "tightPossession", { dirty: false });
    expect(savedHtml).toMatch(/data-dirty="false"[^>]*>保存済み</);
    expect(savedHtml).toMatch(/data-testid="quick-save"[^>]*disabled=""/);
  });

  it("保存結果は成功・失敗を記号と文字で区別する（色だけに頼らない）", () => {
    const after = allocationWithGroupLevel({}, MESSI_BIGTIME, "dribbling", 3);
    expect(dockMarkup(MESSI_BIGTIME, {}, after, "dribbling", { saveNotice: { ok: true, message: "保存しました: ビルド 1" } })).toContain("✓ 保存しました: ビルド 1");
    expect(dockMarkup(MESSI_BIGTIME, {}, after, "dribbling", { saveNotice: { ok: false, message: "保存できません: x" } })).toContain("⚠ 保存できません: x");
  });

  it("閉じるボタンは「完了」（変更は残る）と説明し、「↺ 戻す」はカテゴリだけを戻すと説明する", () => {
    const after = allocationWithGroupLevel({}, MESSI_BIGTIME, "dribbling", 3);
    const html = dockMarkup(MESSI_BIGTIME, {}, after, "dribbling");
    expect(html).toMatch(/aria-label="完了（パネルを閉じます（変更はそのまま残ります））"/);
    expect(html).toMatch(/data-testid="dock-revert"[^>]*>↺ 戻す</);
    expect(html).toContain("このカテゴリを選択した時点のレベルへ戻します");
  });

  it("未選択の行に押せる手がかり（›・読み上げ「タップして育成」）、選択中の直後に「育成パネルへ移動」", () => {
    const f = focusForStat("tightPossession");
    if (!f.ok) throw new Error();
    const r = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    const idle = render(createElement(AbilityDirectList, { stats: r.stats, diffs: new Map(), focus: null, showConditional: false, defaultOpenGk: false, onSelect: noop }));
    expect(idle).toContain("タップして育成");
    expect((idle.match(/›/g) ?? []).length).toBe(26);
    const sel = render(createElement(AbilityDirectList, { stats: r.stats, diffs: new Map(), focus: f.focus, showConditional: false, defaultOpenGk: false, onSelect: noop, onSkipToPanel: noop }));
    expect(sel).toContain("育成パネルへ移動");
    expect(sel.indexOf('data-stat="tightPossession"')).toBeLessThan(sel.indexOf("育成パネルへ移動"));
  });
});

describe("エディター全体（初期表示）", () => {
  it("未選択では細いバー（ヒント・残りポイント・配分チップ）だけを出す", () => {
    const calc = (alloc: Record<string, number>) => calculateBuild({ card: MESSI_BIGTIME, allocation: alloc });
    const html = render(
      createElement(AbilityProgressionEditor, {
        card: MESSI_BIGTIME,
        allocation: {},
        result: calc({}),
        calculate: calc,
        canProgress: true,
        showConditional: false,
        dirty: false,
        onSetLevel: noop,
        onAdjust: noop,
        onGoToSave: noop,
        onQuickSave: () => ({ ok: true, message: "" }),
      }),
    );
    expect(html).toContain("能力値をタップして育成");
    expect(html).toContain('data-testid="remaining-points"');
    expect(html).not.toContain('data-testid="progression-dock"');
    expect((html.match(/data-group="/g) ?? []).length).toBe(7); // GK 以外の7カテゴリ
  });
});
