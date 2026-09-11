import { getFormation } from "./formations";
import { MAX_SUBSTITUTES } from "./types";
import { clampCoord, isPlacementRole } from "./role-inference";
import { mirrorRole } from "./position-snapping";
import type { StoredSquad, StoredSlot, StoredSub, SquadBuildMode } from "./types";

/**
 * スカッド内の選手移動・入れ替え（純関数・単一実装）。
 * Game Plan に近い操作: 先発⇔先発 / 先発⇔ベンチ / ベンチ⇔ベンチ / ベンチ並び替え / 枠から外す。
 *
 *  - カードに紐づく設定（buildMode / savedBuildId / boosters / conditionalBoosters）は選手と一緒に移動する。
 *  - キャプテン・セットプレー担当・Link-Up 選択（= スロット参照の役割）は原則「選手に追従」する。
 *    先発から外れた選手の役割は解除し、warnings で通知する。
 *  - 選手を複製・消失させない（常に既存カード集合の並び替え）。
 */

export type SquadLoc =
  | { area: "starter"; slotId: string }
  | { area: "bench"; index: number };

export type SquadMoveErrorCode =
  | "invalid_squad"
  | "invalid_source"
  | "invalid_target"
  | "source_empty"
  | "target_not_found"
  | "same_location"
  | "bench_full";

export type SquadMoveResult =
  | { ok: true; squad: StoredSquad; operation: string; warnings: string[] }
  | { ok: false; errorCode: SquadMoveErrorCode; squad: StoredSquad };

interface CardPayload {
  worldCardId: string;
  buildMode: SquadBuildMode;
  savedBuildId: string | null;
  boosters: StoredSlot["boosters"];
  conditionalBoosters: StoredSlot["conditionalBoosters"];
}

function slotPayload(slot: StoredSlot): CardPayload | null {
  if (!slot.worldCardId) return null;
  return {
    worldCardId: slot.worldCardId,
    buildMode: slot.buildMode,
    savedBuildId: slot.savedBuildId,
    boosters: slot.boosters,
    conditionalBoosters: slot.conditionalBoosters,
  };
}
function subPayload(sub: StoredSub): CardPayload {
  return {
    worldCardId: sub.worldCardId,
    buildMode: sub.buildMode,
    savedBuildId: sub.savedBuildId,
    boosters: sub.boosters,
    conditionalBoosters: sub.conditionalBoosters,
  };
}
/** x / y / roleOverride はスロット（位置）の属性なので、占有者が変わっても保持する。 */
function emptySlot(base: StoredSlot): StoredSlot {
  return {
    slotId: base.slotId,
    worldCardId: null,
    buildMode: "none",
    savedBuildId: null,
    boosters: undefined,
    conditionalBoosters: undefined,
    x: base.x,
    y: base.y,
    roleOverride: base.roleOverride ?? null,
  };
}
function filledSlot(base: StoredSlot, p: CardPayload): StoredSlot {
  return {
    slotId: base.slotId,
    worldCardId: p.worldCardId,
    buildMode: p.buildMode,
    savedBuildId: p.savedBuildId,
    boosters: p.boosters,
    conditionalBoosters: p.conditionalBoosters,
    x: base.x,
    y: base.y,
    roleOverride: base.roleOverride ?? null,
  };
}
function makeSub(subId: string, p: CardPayload): StoredSub {
  return {
    subId,
    worldCardId: p.worldCardId,
    buildMode: p.buildMode,
    savedBuildId: p.savedBuildId,
    boosters: p.boosters,
    conditionalBoosters: p.conditionalBoosters,
  };
}

/**
 * スロット参照の役割（キャプテン / セットプレー / Link-Up）を slotId マップで付け替える。
 * map[oldSlotId] === undefined … そのまま / null … 解除 / 別 slotId … 付け替え。
 */
function remapRoles(
  squad: StoredSquad,
  map: Record<string, string | null>,
): { patch: Pick<StoredSquad, "captainSlotId" | "setPieces" | "linkUp">; clearedRoles: string[] } {
  const cleared: string[] = [];
  const apply = (id: string | null, roleLabel: string): string | null => {
    if (id == null) return null;
    if (!(id in map)) return id;
    const next = map[id];
    if (next == null) cleared.push(roleLabel);
    return next;
  };
  return {
    patch: {
      captainSlotId: apply(squad.captainSlotId, "キャプテン"),
      setPieces: {
        corners: apply(squad.setPieces?.corners ?? null, "左右CK担当"),
        freeKicks: apply(squad.setPieces?.freeKicks ?? null, "FK担当"),
        penalties: apply(squad.setPieces?.penalties ?? null, "PK担当"),
      },
      linkUp: {
        centerPieceSlotId: apply(squad.linkUp?.centerPieceSlotId ?? null, "Link-Up 中心選手"),
        keyManSlotId: apply(squad.linkUp?.keyManSlotId ?? null, "Link-Up キーマン"),
      },
    },
    clearedRoles: [...new Set(cleared)],
  };
}

function locEq(a: SquadLoc, b: SquadLoc): boolean {
  if (a.area !== b.area) return false;
  return a.area === "starter" && b.area === "starter"
    ? a.slotId === b.slotId
    : a.area === "bench" && b.area === "bench"
      ? a.index === b.index
      : false;
}

/** 先発 ⇔ ベンチ ⇔ 並び替え の単一エントリ。`makeSubId` はベンチへ新規追加する場合のみ使用。 */
export function applySquadMove(
  squad: StoredSquad,
  from: SquadLoc,
  to: SquadLoc,
  makeSubId: () => string,
): SquadMoveResult {
  if (!squad || !Array.isArray(squad.slots) || !Array.isArray(squad.substitutes)) {
    return { ok: false, errorCode: "invalid_squad", squad };
  }
  if (locEq(from, to)) return { ok: false, errorCode: "same_location", squad };

  const validSlotIds = new Set(getFormation(squad.formationId).slots.map((s) => s.slotId));

  // ---- from を解決 ----
  let fromPayload: CardPayload;
  if (from.area === "starter") {
    if (!validSlotIds.has(from.slotId)) return { ok: false, errorCode: "invalid_source", squad };
    const slot = squad.slots.find((s) => s.slotId === from.slotId);
    if (!slot) return { ok: false, errorCode: "invalid_source", squad };
    const p = slotPayload(slot);
    if (!p) return { ok: false, errorCode: "source_empty", squad };
    fromPayload = p;
  } else {
    if (from.index < 0 || from.index >= squad.substitutes.length) {
      return { ok: false, errorCode: "invalid_source", squad };
    }
    fromPayload = subPayload(squad.substitutes[from.index]);
  }

  // ---- to を解決（bench は index === length で末尾追加を許可） ----
  if (to.area === "starter") {
    if (!validSlotIds.has(to.slotId) || !squad.slots.some((s) => s.slotId === to.slotId)) {
      return { ok: false, errorCode: "target_not_found", squad };
    }
  } else if (to.index < 0 || to.index > squad.substitutes.length) {
    return { ok: false, errorCode: "invalid_target", squad };
  }

  const now = new Date().toISOString();
  const finish = (
    patchFields: Partial<StoredSquad>,
    roleMap: Record<string, string | null>,
    operation: string,
    extraWarnings: string[] = [],
  ): SquadMoveResult => {
    const base: StoredSquad = { ...squad, ...patchFields, updatedAt: now };
    const { patch, clearedRoles } = remapRoles(base, roleMap);
    const warnings = [...extraWarnings];
    if (clearedRoles.length) warnings.push(`先発から外れたため ${clearedRoles.join(" / ")} を解除しました。`);
    return { ok: true, squad: { ...base, ...patch }, operation, warnings };
  };

  // ============ 先発 → 先発 ============
  if (from.area === "starter" && to.area === "starter") {
    const toSlot = squad.slots.find((s) => s.slotId === to.slotId)!;
    const toPayload = slotPayload(toSlot);
    const slots = squad.slots.map((s) => {
      if (s.slotId === from.slotId) return toPayload ? filledSlot(s, toPayload) : emptySlot(s);
      if (s.slotId === to.slotId) return filledSlot(s, fromPayload);
      return s;
    });
    if (toPayload) {
      // 入れ替え: 役割は両選手に追従
      return finish({ slots }, { [from.slotId]: to.slotId, [to.slotId]: from.slotId }, "先発を入れ替えました");
    }
    // 空き枠へ移動: 役割は移動先へ追従
    return finish({ slots }, { [from.slotId]: to.slotId }, "選手を移動しました");
  }

  // ============ 先発 → ベンチ ============
  if (from.area === "starter" && to.area === "bench") {
    if (to.index === squad.substitutes.length) {
      if (squad.substitutes.length >= MAX_SUBSTITUTES) return { ok: false, errorCode: "bench_full", squad };
      const slots = squad.slots.map((s) => (s.slotId === from.slotId ? emptySlot(s) : s));
      const substitutes = [...squad.substitutes, makeSub(makeSubId(), fromPayload)];
      return finish({ slots, substitutes }, { [from.slotId]: null }, "先発をベンチへ移動しました");
    }
    // ベンチの選手と入れ替え（ベンチ選手が先発枠へ・元先発はベンチへ / 元先発は XI から外れる）
    const benchSub = squad.substitutes[to.index];
    const slots = squad.slots.map((s) => (s.slotId === from.slotId ? filledSlot(s, subPayload(benchSub)) : s));
    const substitutes = squad.substitutes.map((sub, i) => (i === to.index ? makeSub(sub.subId, fromPayload) : sub));
    return finish({ slots, substitutes }, { [from.slotId]: null }, "先発とベンチを交代しました");
  }

  // ============ ベンチ → 先発 ============
  if (from.area === "bench" && to.area === "starter") {
    const toSlot = squad.slots.find((s) => s.slotId === to.slotId)!;
    const toPayload = slotPayload(toSlot);
    const slots = squad.slots.map((s) => (s.slotId === to.slotId ? filledSlot(s, fromPayload) : s));
    if (toPayload) {
      // 入れ替え: 元先発はベンチの元の位置へ / 元先発は XI から外れる
      const substitutes = squad.substitutes.map((sub, i) =>
        i === from.index ? makeSub(sub.subId, toPayload) : sub,
      );
      return finish({ slots, substitutes }, { [to.slotId]: null }, "ベンチと先発を交代しました");
    }
    // 空き先発枠へ昇格
    const substitutes = squad.substitutes.filter((_, i) => i !== from.index);
    return finish({ slots, substitutes }, {}, "ベンチ選手を先発へ移動しました");
  }

  // ============ ベンチ → ベンチ（並び替え） ============
  if (from.area === "bench" && to.area === "bench") {
    const arr = [...squad.substitutes];
    const [moved] = arr.splice(from.index, 1);
    arr.splice(Math.min(Math.max(to.index, 0), arr.length), 0, moved);
    return finish({ substitutes: arr }, {}, "ベンチの順番を変更しました");
  }

  return { ok: false, errorCode: "invalid_target", squad };
}

/** ベンチ内の並び替え（index → index）。 */
export function reorderBench(squad: StoredSquad, from: number, to: number): SquadMoveResult {
  return applySquadMove(squad, { area: "bench", index: from }, { area: "bench", index: to }, () => "sub_x");
}

/**
 * 先発配置だけを左右反転（x → 100-x・y は維持）。
 *  - 左右ロールの roleOverride は反対側へ変換（中央ロールは維持）。inferredRole は座標から自動再計算される。
 *  - slotId / worldCardId / savedBuildId / boosters / conditionalBoosters / buildMode /
 *    managerId / captainSlotId / setPieces / linkUp / ベンチ は変更しない。
 */
export function mirrorSquadPositions(squad: StoredSquad): SquadMoveResult {
  if (!squad || !Array.isArray(squad.slots)) {
    return { ok: false, errorCode: "invalid_squad", squad };
  }
  const fdef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
  const slots = squad.slots.map((s) => {
    const fs = fdef.get(s.slotId);
    const curX = clampCoord(s.x ?? fs?.x ?? 50);
    const curY = clampCoord(s.y ?? fs?.y ?? 50);
    const nextOverride =
      s.roleOverride && isPlacementRole(s.roleOverride) ? mirrorRole(s.roleOverride) : (s.roleOverride ?? null);
    return { ...s, x: 100 - curX, y: curY, roleOverride: nextOverride };
  });
  return {
    ok: true,
    squad: { ...squad, slots, updatedAt: new Date().toISOString() },
    operation: "配置を左右反転しました",
    warnings: [],
  };
}

/** 選手をスカッド配置から外す（お気に入り / My Team / 保存ビルド / 比較には触れない）。 */
export function removeSquadPlayer(squad: StoredSquad, loc: SquadLoc): SquadMoveResult {
  if (!squad || !Array.isArray(squad.slots) || !Array.isArray(squad.substitutes)) {
    return { ok: false, errorCode: "invalid_squad", squad };
  }
  const now = new Date().toISOString();
  if (loc.area === "starter") {
    const slot = squad.slots.find((s) => s.slotId === loc.slotId);
    if (!slot) return { ok: false, errorCode: "invalid_source", squad };
    if (!slot.worldCardId) return { ok: false, errorCode: "source_empty", squad };
    const base: StoredSquad = {
      ...squad,
      slots: squad.slots.map((s) => (s.slotId === loc.slotId ? emptySlot(s) : s)),
      updatedAt: now,
    };
    const { patch, clearedRoles } = remapRoles(base, { [loc.slotId]: null });
    const warnings = clearedRoles.length ? [`${clearedRoles.join(" / ")} を解除しました。`] : [];
    return { ok: true, squad: { ...base, ...patch }, operation: "先発から外しました", warnings };
  }
  if (loc.index < 0 || loc.index >= squad.substitutes.length) {
    return { ok: false, errorCode: "invalid_source", squad };
  }
  return {
    ok: true,
    squad: {
      ...squad,
      substitutes: squad.substitutes.filter((_, i) => i !== loc.index),
      updatedAt: now,
    },
    operation: "ベンチから外しました",
    warnings: [],
  };
}
