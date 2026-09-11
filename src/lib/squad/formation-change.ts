import { getFormation } from "./formations";
import { roleOfPosition } from "./position";
import { newSubId } from "./squad-storage";
import { MAX_SUBSTITUTES } from "./types";
import type { SlotRole, StoredSlot, StoredSquad, StoredSub } from "./types";

/**
 * フォーメーション変更時の選手の引き継ぎ。
 * 「同ポジション完全一致 → 同 role → 残り」の順で貪欲に新スロットへ割り当て、
 * あふれた選手はベンチへ退避（ベンチ満杯なら外す）。育成ビルド・監督設定は保持。
 */
export function changeFormation(squad: StoredSquad, newFormationId: string): {
  squad: StoredSquad;
  movedToBench: string[];
  dropped: string[];
} {
  const target = getFormation(newFormationId);
  const source = getFormation(squad.formationId);
  const sourcePos = new Map(source.slots.map((s) => [s.slotId, s.position]));

  type Held = {
    worldCardId: string;
    buildMode: StoredSlot["buildMode"];
    savedBuildId: string | null;
    boosters: StoredSlot["boosters"];
    fromPosition: string | null;
  };
  const remaining: Held[] = squad.slots
    .filter((s): s is StoredSlot & { worldCardId: string } => !!s.worldCardId)
    .map((s) => ({
      worldCardId: s.worldCardId,
      buildMode: s.buildMode,
      savedBuildId: s.savedBuildId,
      boosters: s.boosters,
      fromPosition: sourcePos.get(s.slotId) ?? null,
    }));

  const newSlots: StoredSlot[] = target.slots.map((fs) => ({
    slotId: fs.slotId,
    worldCardId: null,
    buildMode: "none",
    savedBuildId: null,
  }));
  const bySlotId = new Map(newSlots.map((s) => [s.slotId, s]));

  const place = (held: Held, slot: StoredSlot) => {
    slot.worldCardId = held.worldCardId;
    slot.buildMode = held.buildMode;
    slot.savedBuildId = held.savedBuildId;
    slot.boosters = held.boosters;
  };

  const pass = (matches: (targetPos: string, targetRole: SlotRole | null, playerPos: string | null) => boolean) => {
    for (const fs of target.slots) {
      const slot = bySlotId.get(fs.slotId)!;
      if (slot.worldCardId) continue;
      const idx = remaining.findIndex((h) => matches(fs.position, roleOfPosition(fs.position), h.fromPosition));
      if (idx >= 0) place(remaining.splice(idx, 1)[0], slot);
    }
  };

  pass((tPos, _tRole, pPos) => pPos != null && tPos === pPos);
  pass((_tPos, tRole, pPos) => tRole != null && pPos != null && tRole === roleOfPosition(pPos));
  // 残り: 空きスロットへ順に
  for (const fs of target.slots) {
    const slot = bySlotId.get(fs.slotId)!;
    if (slot.worldCardId || remaining.length === 0) continue;
    place(remaining.shift()!, slot);
  }

  const movedToBench: string[] = [];
  const dropped: string[] = [];
  const subs: StoredSub[] = [...squad.substitutes];
  for (const h of remaining) {
    if (subs.length < MAX_SUBSTITUTES) {
      subs.push({ subId: newSubId(), worldCardId: h.worldCardId, buildMode: h.buildMode, savedBuildId: h.savedBuildId, boosters: h.boosters });
      movedToBench.push(h.worldCardId);
    } else {
      dropped.push(h.worldCardId);
    }
  }

  const captainStillValid =
    squad.captainSlotId != null && newSlots.some((s) => s.slotId === squad.captainSlotId && s.worldCardId);

  return {
    squad: {
      ...squad,
      formationId: target.id,
      slots: newSlots,
      substitutes: subs,
      captainSlotId: captainStillValid ? squad.captainSlotId : null,
      linkUp: { centerPieceSlotId: null, keyManSlotId: null },
      setPieces: { corners: null, freeKicks: null, penalties: null },
      updatedAt: new Date().toISOString(),
    },
    movedToBench,
    dropped,
  };
}
