import { getFormation } from "./formations";
import { clampCoord, isPlacementRole } from "./role-inference";
import { mirrorRole } from "./position-snapping";
import type { StoredSquad } from "./types";

/**
 * 配置補助の次候補（F-036）: 複数の先発を選んでの整列・均等配置・選択だけの左右反転。純関数。
 *
 * - 座標形式（`squad-positioning/2026-08-30.v1`）とロール判定規則は変えない。ロールは保存せず、描画時に座標から判定される。
 * - 対象は選手が入っている先発スロットだけ（空きスロット・ベンチは対象外）。存在しない ID・重複は無視する。
 * - 変えるのは x / y（反転では左右ロールの roleOverride も）だけ。選手・ビルド・ブースター・キャプテン・セットプレー・ベンチは不変。
 * - 座標は 0〜100 に収め、小数 1 桁に丸める（保存データを細かい小数で膨らませない）。
 */

export type PlacementAssistAction = "align_row" | "align_column" | "distribute_x" | "distribute_y" | "mirror_selected";

export type PlacementAssistResult =
  | { ok: true; squad: StoredSquad; changed: number }
  | { ok: false; reason: "invalid_squad" | "too_few" | "no_change" };

/** 操作ごとの最少の選択数。 */
export const PLACEMENT_ASSIST_MIN_SELECTION: Record<PlacementAssistAction, number> = {
  align_row: 2,
  align_column: 2,
  distribute_x: 3,
  distribute_y: 3,
  mirror_selected: 1,
};

const round1 = (v: number) => Math.round(clampCoord(v) * 10) / 10;

type Point = { slotId: string; x: number; y: number };

function selectedPoints(squad: StoredSquad, slotIds: readonly string[]): Point[] {
  const fdef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
  const want = new Set(slotIds);
  return squad.slots
    .filter((s) => want.has(s.slotId) && !!s.worldCardId)
    .map((s) => {
      const fs = fdef.get(s.slotId);
      return { slotId: s.slotId, x: clampCoord(s.x ?? fs?.x ?? 50), y: clampCoord(s.y ?? fs?.y ?? 50) };
    });
}

/** 選択中の、選手が入っている先発スロットの ID（ピッチの表示順）。UI の選択状態の正規化に使う。 */
export function selectablePlacementIds(squad: StoredSquad | null, slotIds: readonly string[]): string[] {
  if (!squad || !Array.isArray(squad.slots)) return [];
  const want = new Set(slotIds);
  return squad.slots.filter((s) => want.has(s.slotId) && !!s.worldCardId).map((s) => s.slotId);
}

function computeTargets(action: PlacementAssistAction, pts: Point[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (action === "align_row" || action === "align_column") {
    const key = action === "align_row" ? "y" : "x";
    const avg = pts.reduce((a, p) => a + p[key], 0) / pts.length;
    for (const p of pts) out.set(p.slotId, { x: action === "align_column" ? avg : p.x, y: action === "align_row" ? avg : p.y });
    return out;
  }
  if (action === "distribute_x" || action === "distribute_y") {
    const key = action === "distribute_x" ? "x" : "y";
    // 同じ座標の並びは slotId で決定的に並べる（入力順に依存しない）。
    const sorted = [...pts].sort((a, b) => a[key] - b[key] || a.slotId.localeCompare(b.slotId));
    const lo = sorted[0][key];
    const hi = sorted[sorted.length - 1][key];
    const step = (hi - lo) / (sorted.length - 1);
    sorted.forEach((p, i) => out.set(p.slotId, { x: key === "x" ? lo + step * i : p.x, y: key === "y" ? lo + step * i : p.y }));
    return out;
  }
  for (const p of pts) out.set(p.slotId, { x: 100 - p.x, y: p.y });
  return out;
}

export function applyPlacementAssist(
  squad: StoredSquad,
  slotIds: readonly string[],
  action: PlacementAssistAction,
): PlacementAssistResult {
  if (!squad || !Array.isArray(squad.slots)) return { ok: false, reason: "invalid_squad" };
  const pts = selectedPoints(squad, slotIds);
  if (pts.length < PLACEMENT_ASSIST_MIN_SELECTION[action]) return { ok: false, reason: "too_few" };
  const targets = computeTargets(action, pts);
  let changed = 0;
  const slots = squad.slots.map((s) => {
    const t = targets.get(s.slotId);
    if (!t) return s;
    const pt = pts.find((p) => p.slotId === s.slotId)!;
    const nx = round1(t.x);
    const ny = round1(t.y);
    const mirrorOverride = action === "mirror_selected" && s.roleOverride && isPlacementRole(s.roleOverride);
    const nextOverride = mirrorOverride ? mirrorRole(s.roleOverride!) : (s.roleOverride ?? null);
    const moved = Math.abs(nx - pt.x) > 1e-9 || Math.abs(ny - pt.y) > 1e-9 || nextOverride !== (s.roleOverride ?? null);
    if (!moved) return s;
    changed++;
    return { ...s, x: nx, y: ny, roleOverride: nextOverride };
  });
  if (changed === 0) return { ok: false, reason: "no_change" };
  return { ok: true, squad: { ...squad, slots, updatedAt: new Date().toISOString() }, changed };
}
