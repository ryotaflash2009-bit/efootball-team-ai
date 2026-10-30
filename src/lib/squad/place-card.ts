import { assignWorldCardToSlot, type SquadAssignErrorCode } from "./assign";
import { removeSquadPlayer } from "./moves";
import type { StoredSquad } from "./types";

/**
 * 先発の枠にカードを置く（純関数・2026-10-30）。枠に選手がいれば外してから置く（入れ替え）。
 * 置けない理由（同じカード・同じ選手がすでにいる・不正な枠など）は assign と同じ errorCode で返す。
 */
export function placeCardInSlot(
  squad: StoredSquad,
  slotId: string,
  worldCardId: string,
): { ok: true; squad: StoredSquad } | { ok: false; errorCode: SquadAssignErrorCode | "remove_failed" } {
  let base = squad;
  if (squad.slots.find((s) => s.slotId === slotId)?.worldCardId) {
    const removed = removeSquadPlayer(squad, { area: "starter", slotId });
    if (!removed.ok) return { ok: false, errorCode: "remove_failed" };
    base = removed.squad;
  }
  const r = assignWorldCardToSlot(base, slotId, worldCardId);
  return r.ok ? { ok: true, squad: r.squad } : { ok: false, errorCode: r.errorCode };
}
