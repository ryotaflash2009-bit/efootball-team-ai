import { getFormation, isFormationId } from "./formations";
import { clampCoord, isPlacementRole } from "./role-inference";
import type { StoredSquad } from "./types";

/**
 * 配置のコピー／貼り付け（F-036 の残り、2026-10-04）。純関数＋sessionStorage の薄い読み書き。
 *
 * - **同じフォーメーションのスカッドの間だけ**（枠の ID が一致するので、対応づけの規則が要らない）。
 *   違うフォーメーションへは貼り付けない（推測で枠を対応させない）。
 * - 写すのは先発の枠の座標（x / y）と配置ロールの手動上書き（roleOverride）だけ。選手・ビルド・ブースター・
 *   キャプテン・セットプレー・ベンチ・監督は写さない。空き枠の座標も写す（配置の形をそのまま再現する）。
 *   選手がいない枠の roleOverride は保存時の正規化と同じく null にする。
 * - 保存先は sessionStorage（このタブの間だけ）。座標だけで、選手や個人の情報を含まない。
 */

export const PLACEMENT_CLIPBOARD_KEY = "efootball-team-ai:squad-placement-clipboard:v1";
export const PLACEMENT_CLIPBOARD_VERSION = "squad-placement-clipboard/2026-10-04.v1";

export type PlacementClipboard = {
  version: typeof PLACEMENT_CLIPBOARD_VERSION;
  formationId: string;
  slots: { slotId: string; x: number; y: number; roleOverride: string | null }[];
};

export type PlacementPasteResult =
  | { ok: true; squad: StoredSquad; changed: number }
  | { ok: false; reason: "invalid_squad" | "invalid_clipboard" | "formation_mismatch" | "no_change" };

const round1 = (v: number) => Math.round(clampCoord(v) * 10) / 10;

export function copyPlacement(squad: StoredSquad): PlacementClipboard | null {
  if (!squad || !Array.isArray(squad.slots) || !isFormationId(squad.formationId)) return null;
  const fdef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
  return {
    version: PLACEMENT_CLIPBOARD_VERSION,
    formationId: squad.formationId,
    slots: squad.slots
      .filter((s) => fdef.has(s.slotId))
      .map((s) => {
        const fs = fdef.get(s.slotId)!;
        return {
          slotId: s.slotId,
          x: round1(s.x ?? fs.x),
          y: round1(s.y ?? fs.y),
          roleOverride: s.roleOverride && isPlacementRole(s.roleOverride) ? s.roleOverride : null,
        };
      }),
  };
}

/** 外から来た値（sessionStorage）を検証する。形が少しでも違えば null（貼り付けない）。 */
export function parsePlacementClipboard(raw: unknown): PlacementClipboard | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (c.version !== PLACEMENT_CLIPBOARD_VERSION || typeof c.formationId !== "string" || !isFormationId(c.formationId)) return null;
  if (!Array.isArray(c.slots)) return null;
  const valid = new Set(getFormation(c.formationId).slots.map((s) => s.slotId));
  const seen = new Set<string>();
  const slots: PlacementClipboard["slots"] = [];
  for (const s of c.slots as unknown[]) {
    if (!s || typeof s !== "object") return null;
    const o = s as Record<string, unknown>;
    const inRange = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
    if (typeof o.slotId !== "string" || !valid.has(o.slotId) || seen.has(o.slotId)) return null;
    if (!inRange(o.x) || !inRange(o.y)) return null;
    const role = o.roleOverride == null ? null : typeof o.roleOverride === "string" && isPlacementRole(o.roleOverride) ? o.roleOverride : undefined;
    if (role === undefined) return null;
    seen.add(o.slotId);
    slots.push({ slotId: o.slotId, x: round1(o.x as number), y: round1(o.y as number), roleOverride: role });
  }
  if (slots.length !== valid.size) return null;
  return { version: PLACEMENT_CLIPBOARD_VERSION, formationId: c.formationId, slots };
}

export function canPastePlacement(squad: StoredSquad | null, clip: PlacementClipboard | null): boolean {
  return !!squad && !!clip && squad.formationId === clip.formationId;
}

export function pastePlacement(squad: StoredSquad, clip: PlacementClipboard | null): PlacementPasteResult {
  if (!squad || !Array.isArray(squad.slots)) return { ok: false, reason: "invalid_squad" };
  const parsed = parsePlacementClipboard(clip);
  if (!parsed) return { ok: false, reason: "invalid_clipboard" };
  if (parsed.formationId !== squad.formationId) return { ok: false, reason: "formation_mismatch" };
  const bySlot = new Map(parsed.slots.map((s) => [s.slotId, s]));
  let changed = 0;
  const slots = squad.slots.map((s) => {
    const c = bySlot.get(s.slotId);
    if (!c) return s;
    const role = s.worldCardId ? c.roleOverride : null;
    if (s.x === c.x && s.y === c.y && (s.roleOverride ?? null) === role) return s;
    changed++;
    return { ...s, x: c.x, y: c.y, roleOverride: role };
  });
  if (changed === 0) return { ok: false, reason: "no_change" };
  return { ok: true, squad: { ...squad, slots, updatedAt: new Date().toISOString() }, changed };
}

/** sessionStorage の読み書き（使えない環境では何もしない）。 */
export function readPlacementClipboard(): PlacementClipboard | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(PLACEMENT_CLIPBOARD_KEY);
    return raw ? parsePlacementClipboard(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writePlacementClipboard(clip: PlacementClipboard): boolean {
  try {
    window.sessionStorage.setItem(PLACEMENT_CLIPBOARD_KEY, JSON.stringify(clip));
    return true;
  } catch {
    return false;
  }
}
