import { getFormation, isFormationId } from "./formations";
import { clampCoord, isPlacementRole } from "./role-inference";
import type { StoredSquad } from "./types";

/**
 * 配置のコピー／貼り付け（F-036 の残り、2026-10-04）。純関数＋sessionStorage の薄い読み書き。
 *
 * - `pastePlacement` は**同じフォーメーションのスカッドの間だけ**（枠の ID が一致するので、対応づけの規則が要らない）。
 *   違うフォーメーションへは `pastePlacementAcrossFormations`（下・NEW-41）が決定的な規則で枠を対応させる。
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

/**
 * 違うフォーメーションの間の配置の写し（NEW-41・2026-10-07）。決定的な規則だけで枠を対応させる（推測しない）。
 * - 対応は同じ役割の区分（GK / DF / MF / FW）の中だけ。区分の中では、両方のフォーメーションの**既定の座標**の
 *   距離の二乗の合計が最小になる組み合わせを選ぶ（同じ値なら枠の ID の順で最初の組み合わせ）。
 * - 写すのは「既定の位置からのずれ」（元の座標 − 元の既定）を、対応する枠の既定に足したもの。
 *   相手のフォーメーションの形を保ったまま、前に出す・幅を取るなどの調整だけを写す。
 * - 配置ロールの上書き（roleOverride）は写さない（ポジションが違うと意味が変わるため）。
 * - 対応の無い枠（区分の人数が違う場合）は今のまま。選手・ビルド・ベンチ・キャプテン等は変えない。
 */
export type SlotMapping = { from: string; to: string }[];

function permutations(n: number, k: number): number[][] {
  // 0..n-1 から k 個を選ぶ順列（辞書順）。区分の枠は最大 5 なので数は小さい。
  const out: number[][] = [];
  const cur: number[] = [];
  const used = new Array(n).fill(false);
  const rec = () => {
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(i);
      rec();
      cur.pop();
      used[i] = false;
    }
  };
  rec();
  return out;
}

export function mapFormationSlots(fromFormationId: string, toFormationId: string): SlotMapping {
  const from = getFormation(fromFormationId).slots;
  const to = getFormation(toFormationId).slots;
  const mapping: SlotMapping = [];
  for (const role of ["GK", "DF", "MF", "FW"] as const) {
    const a = from.filter((s) => s.role === role).sort((p, q) => p.slotId.localeCompare(q.slotId));
    const b = to.filter((s) => s.role === role).sort((p, q) => p.slotId.localeCompare(q.slotId));
    if (!a.length || !b.length) continue;
    // 少ない側の各枠に、多い側の枠を 1 つずつ割り当てる。
    const small = a.length <= b.length ? a : b;
    const large = a.length <= b.length ? b : a;
    let best: number[] | null = null;
    let bestCost = Infinity;
    for (const perm of permutations(large.length, small.length)) {
      let cost = 0;
      perm.forEach((li, si) => {
        cost += (small[si].x - large[li].x) ** 2 + (small[si].y - large[li].y) ** 2;
      });
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = perm;
      }
    }
    best!.forEach((li, si) => {
      const [f, t] = small === a ? [small[si], large[li]] : [large[li], small[si]];
      mapping.push({ from: f.slotId, to: t.slotId });
    });
  }
  return mapping;
}

export type CrossPasteResult =
  | { ok: true; squad: StoredSquad; changed: number; mapped: number; unmatched: number }
  | { ok: false; reason: "invalid_squad" | "invalid_clipboard" | "same_formation" | "no_change" };

export function pastePlacementAcrossFormations(squad: StoredSquad, clip: PlacementClipboard | null): CrossPasteResult {
  if (!squad || !Array.isArray(squad.slots) || !isFormationId(squad.formationId)) return { ok: false, reason: "invalid_squad" };
  const parsed = parsePlacementClipboard(clip);
  if (!parsed) return { ok: false, reason: "invalid_clipboard" };
  if (parsed.formationId === squad.formationId) return { ok: false, reason: "same_formation" };
  const fromDef = new Map(getFormation(parsed.formationId).slots.map((s) => [s.slotId, s]));
  const toDef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
  const src = new Map(parsed.slots.map((s) => [s.slotId, s]));
  const target = new Map<string, { x: number; y: number }>();
  for (const { from, to } of mapFormationSlots(parsed.formationId, squad.formationId)) {
    const c = src.get(from);
    const fd = fromDef.get(from);
    const td = toDef.get(to);
    if (!c || !fd || !td) continue;
    target.set(to, { x: round1(td.x + (c.x - fd.x)), y: round1(td.y + (c.y - fd.y)) });
  }
  let changed = 0;
  const slots = squad.slots.map((s) => {
    const t = target.get(s.slotId);
    if (!t) return s;
    const def = toDef.get(s.slotId)!;
    if ((s.x ?? def.x) === t.x && (s.y ?? def.y) === t.y) return s;
    changed++;
    return { ...s, x: t.x, y: t.y };
  });
  if (changed === 0) return { ok: false, reason: "no_change" };
  return {
    ok: true,
    squad: { ...squad, slots, updatedAt: new Date().toISOString() },
    changed,
    mapped: target.size,
    unmatched: toDef.size - target.size,
  };
}
