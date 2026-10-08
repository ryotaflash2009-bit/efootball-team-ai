import { adjustGroupLevel, maxUsefulLevelForGroup, summarizeGroupPoints } from "./group-allocation";
import { getRuleset } from "./progression-rules";
import { PROGRESSION_GROUP_IDS, getGroupDef, groupIdForStat } from "./stat-groups";
import type { ProgressionCard, StatBreakdown } from "./types";

/**
 * 能力値直接操作・スライド式育成UI の純粋な制御層（UI 状態と計算の橋渡し）。
 *
 * - 能力値 → 育成カテゴリ、カテゴリ → 関連能力値は stat-groups.ts の PROGRESSION_GROUPS だけを使う（複製しない）。
 * - コスト・上限・残りポイントは progression-rules の ruleset と group-allocation.ts の adjustGroupLevel だけを使う。
 *   スライダーの値は「カテゴリレベル」であり、消費ポイントではない（段階コストは非線形）。
 * - 選択中の能力・ドラッグ中のプレビューは UI 状態で、保存しない。保存するのは既存の allocation（ビルド）だけ。
 */

export type AbilityFocusError = "unknown_ability" | "invalid_mapping";

export interface AbilityFocus {
  /** 選択した能力（カテゴリチップから選んだ場合は null）。 */
  primaryStat: string | null;
  groupId: string;
  /** 同じカテゴリで一緒に変わる能力（primary を含む）。 */
  relatedStats: readonly string[];
}

/** 能力値キーから育成カテゴリと関連能力を求める。 */
export function focusForStat(statKey: string): { ok: true; focus: AbilityFocus } | { ok: false; error: AbilityFocusError } {
  const groupId = groupIdForStat(statKey);
  if (!groupId) return { ok: false, error: "unknown_ability" };
  const group = getGroupDef(groupId);
  if (!group || !group.affectedStats.includes(statKey)) return { ok: false, error: "invalid_mapping" };
  return { ok: true, focus: { primaryStat: statKey, groupId, relatedStats: group.affectedStats } };
}

/** カテゴリ（チップ）から選ぶ。 */
export function focusForGroup(groupId: string): { ok: true; focus: AbilityFocus } | { ok: false; error: "unknown_category" } {
  const group = getGroupDef(groupId);
  if (!group) return { ok: false, error: "unknown_category" };
  return { ok: true, focus: { primaryStat: null, groupId, relatedStats: group.affectedStats } };
}

export type AbilityRole = "primary" | "related" | "unrelated" | "none";

export function abilityRole(focus: AbilityFocus | null, statKey: string): AbilityRole {
  if (!focus) return "none";
  if (focus.primaryStat === statKey) return "primary";
  return focus.relatedStats.includes(statKey) ? "related" : "unrelated";
}

export interface GroupSliderModel {
  groupId: string;
  min: 0;
  /** 現在のカテゴリレベル（ビルドの値）。 */
  current: number;
  /** 能力上限(99)から見たこのカテゴリの最大レベル。 */
  absoluteMax: number;
  /** 残りポイントと上限から実際に到達できる最大レベル。 */
  reachableMax: number;
  totalPoints: number;
  usedPoints: number;
  remainingPoints: number;
  /** current → current+1 のコスト（上限なら null）。 */
  nextCost: number | null;
  canIncrease: boolean;
  canDecrease: boolean;
  atCategoryMax: boolean;
  /** ポイント不足で absoluteMax まで届かない。 */
  limitedByPoints: boolean;
}

/** カテゴリレベルを level にしたときの配分（コスト・残りポイント・上限は adjustGroupLevel が丸める）。 */
export function allocationWithGroupLevel(
  allocation: Record<string, number>,
  card: ProgressionCard,
  groupId: string,
  level: number,
  rulesetId?: string | null,
): Record<string, number> {
  if (!Number.isFinite(level)) return { ...allocation };
  const target = Math.max(0, Math.trunc(level));
  return adjustGroupLevel(allocation, card, groupId, target - (allocation[groupId] ?? 0), rulesetId);
}

export function groupSliderModel(
  allocation: Record<string, number>,
  card: ProgressionCard,
  groupId: string,
  rulesetId?: string | null,
): GroupSliderModel {
  const ruleset = getRuleset(rulesetId);
  const current = Math.max(0, Math.trunc(allocation[groupId] ?? 0));
  const absoluteMax = maxUsefulLevelForGroup(card, groupId);
  const reachableMax = Math.max(current, allocationWithGroupLevel(allocation, card, groupId, absoluteMax, rulesetId)[groupId] ?? 0);
  const points = summarizeGroupPoints(allocation, card, rulesetId);
  const nextCost = current < absoluteMax ? ruleset.costForNextLevel(current) : null;
  return {
    groupId,
    min: 0,
    current,
    absoluteMax,
    reachableMax,
    totalPoints: points.totalPoints,
    usedPoints: points.usedPoints,
    remainingPoints: points.remainingPoints,
    nextCost,
    canIncrease: reachableMax > current,
    canDecrease: current > 0,
    atCategoryMax: absoluteMax > 0 && current >= absoluteMax,
    limitedByPoints: reachableMax < absoluteMax,
  };
}

/** from → to のポイント差（正 = 追加で必要、負 = 返却）。 */
export function costBetweenLevels(from: number, to: number, rulesetId?: string | null): number {
  const r = getRuleset(rulesetId);
  return r.cumulativeCost(Math.max(0, Math.trunc(to))) - r.cumulativeCost(Math.max(0, Math.trunc(from)));
}

/** 全カテゴリの配分（チップ表示用）。合計は usedPoints と一致する。 */
export interface AllocationChip {
  groupId: string;
  level: number;
  absoluteMax: number;
  cost: number;
  atMax: boolean;
  isGoalkeeping: boolean;
}

export function allocationChips(
  allocation: Record<string, number>,
  card: ProgressionCard,
  rulesetId?: string | null,
): AllocationChip[] {
  const r = getRuleset(rulesetId);
  return PROGRESSION_GROUP_IDS.map((groupId) => {
    const level = Math.max(0, Math.trunc(allocation[groupId] ?? 0));
    const absoluteMax = maxUsefulLevelForGroup(card, groupId);
    return {
      groupId,
      level,
      absoluteMax,
      cost: r.cumulativeCost(level),
      atMax: absoluteMax > 0 && level >= absoluteMax,
      isGoalkeeping: getGroupDef(groupId)?.isGoalkeeping ?? false,
    };
  });
}

/** 能力ごとの変更前後（最終値・育成分）。 */
export interface AbilityDiff {
  key: string;
  before: number;
  after: number;
  delta: number;
  progressionBefore: number;
  progressionAfter: number;
}

export function abilityDiffs(before: readonly StatBreakdown[], after: readonly StatBreakdown[]): Map<string, AbilityDiff> {
  const b = new Map(before.map((s) => [s.key, s]));
  const out = new Map<string, AbilityDiff>();
  for (const s of after) {
    const p = b.get(s.key);
    if (!p) continue;
    out.set(s.key, {
      key: s.key,
      before: p.finalValue,
      after: s.finalValue,
      delta: s.finalValue - p.finalValue,
      progressionBefore: p.progressionDelta,
      progressionAfter: s.progressionDelta,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// UI 状態（＋／－・スライダー・チップで共有する1つの reducer）
// ---------------------------------------------------------------------------

export interface EditorState {
  focus: AbilityFocus | null;
  /** 選択した時点の配分（変更前の基準。保存しない）。 */
  baseline: Record<string, number> | null;
  /** ドラッグ中のレベル（null = ドラッグしていない）。 */
  dragLevel: number | null;
  /** ドラッグ開始時のレベル（キャンセル時に戻す）。 */
  dragOrigin: number | null;
  /** ドラッグで到達不能な位置まで引いた（ポイント不足の表示用）。 */
  dragBlocked: boolean;
}

export const INITIAL_EDITOR_STATE: EditorState = { focus: null, baseline: null, dragLevel: null, dragOrigin: null, dragBlocked: false };

export type EditorAction =
  | { type: "selectStat"; statKey: string; allocation: Record<string, number> }
  | { type: "selectGroup"; groupId: string; allocation: Record<string, number> }
  | { type: "clear" }
  | { type: "dragStart"; level: number }
  | { type: "dragMove"; requested: number; model: GroupSliderModel }
  | { type: "dragEnd" }
  | { type: "dragCancel" };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "selectStat": {
      if (state.focus?.primaryStat === action.statKey) return INITIAL_EDITOR_STATE; // 同じ能力を再タップで解除
      const f = focusForStat(action.statKey);
      if (!f.ok) return INITIAL_EDITOR_STATE;
      const keepBaseline = state.focus?.groupId === f.focus.groupId && state.baseline;
      return { ...INITIAL_EDITOR_STATE, focus: f.focus, baseline: keepBaseline ? state.baseline : { ...action.allocation } };
    }
    case "selectGroup": {
      const f = focusForGroup(action.groupId);
      if (!f.ok) return state;
      if (state.focus?.groupId === action.groupId && state.focus.primaryStat == null) return INITIAL_EDITOR_STATE;
      const keepBaseline = state.focus?.groupId === action.groupId && state.baseline;
      return { ...INITIAL_EDITOR_STATE, focus: f.focus, baseline: keepBaseline ? state.baseline : { ...action.allocation } };
    }
    case "clear":
      return INITIAL_EDITOR_STATE;
    case "dragStart":
      if (!state.focus) return state;
      return { ...state, dragLevel: action.level, dragOrigin: action.level, dragBlocked: false };
    case "dragMove": {
      if (!state.focus || state.dragLevel == null) return state;
      const requested = Math.max(0, Math.round(action.requested));
      const level = Math.min(requested, action.model.reachableMax);
      const blocked = requested > action.model.reachableMax && action.model.reachableMax < action.model.absoluteMax;
      if (level === state.dragLevel && blocked === state.dragBlocked) return state;
      return { ...state, dragLevel: level, dragBlocked: blocked };
    }
    case "dragEnd":
    case "dragCancel":
      return { ...state, dragLevel: null, dragOrigin: null, dragBlocked: false };
    default:
      return state;
  }
}

/** スライダー位置（0〜1）→ カテゴリレベル（整数に snap）。 */
export function levelFromRatio(ratio: number, absoluteMax: number): number {
  if (!Number.isFinite(ratio) || absoluteMax <= 0) return 0;
  return Math.round(Math.min(1, Math.max(0, ratio)) * absoluteMax);
}

/** Page Up / Page Down の段数（現行のコストが 4 段階ごとに変わるため、その区切りに合わせる）。 */
export const PAGE_STEP = 4;

/** 到達可能上限より先（斜線の範囲）の理由と、上限まで届くのに足りないポイント。 */
export function unreachableInfo(model: GroupSliderModel, rulesetId?: string | null): { limitedByPoints: boolean; shortfall: number } {
  if (!model.limitedByPoints) return { limitedByPoints: false, shortfall: 0 };
  const need = costBetweenLevels(model.current, model.absoluteMax, rulesetId);
  return { limitedByPoints: true, shortfall: Math.max(0, need - Math.max(0, model.remainingPoints)) };
}

/** キー操作 → 目標レベル（null = このキーは扱わない）。 */
export function levelForKey(key: string, model: GroupSliderModel): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(model.current + 1, model.reachableMax);
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(model.current - 1, 0);
    case "PageUp":
      return Math.min(model.current + PAGE_STEP, model.reachableMax);
    case "PageDown":
      return Math.max(model.current - PAGE_STEP, 0);
    case "Home":
      return 0;
    case "End":
      return model.reachableMax;
    default:
      return null;
  }
}

/** 表示中レベルから次の1段階のコスト（カテゴリ上限なら null）。ドラッグ中のプレビューにも使う。 */
export function nextCostAtLevel(level: number, absoluteMax: number, rulesetId?: string | null): number | null {
  const lv = Math.max(0, Math.trunc(level));
  return lv < absoluteMax ? getRuleset(rulesetId).costForNextLevel(lv) : null;
}
