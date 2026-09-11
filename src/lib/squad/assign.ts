import { getFormation } from "./formations";
import { MAX_SUBSTITUTES, WORLD_CARD_ID_RE } from "./types";
import type { StoredSquad, SquadBuildMode } from "./types";

/**
 * スカッドへの選手配置（純関数・単一実装）。
 * ピッチ枠・ベンチ・My Team 導線・選手詳細のいずれからでもこの関数を通す。
 *  - worldCardId は必ず数字文字列として扱う（Number 変換しない）。
 *  - 同一 worldCardId の重複配置は拒否（同一人物の別カード = 別 worldCardId は許可）。
 *  - 追加対象以外のスロット・ベンチ・監督・比較・条件設定・ビルド参照は保持する。
 */

export type SquadAssignErrorCode =
  | "invalid_world_card_id"
  | "invalid_slot_id"
  | "slot_not_found"
  | "duplicate_not_allowed"
  | "slot_occupied"
  | "bench_full";

export type SquadAssignResult =
  | { ok: true; squad: StoredSquad }
  | { ok: false; errorCode: SquadAssignErrorCode; squad: StoredSquad };

function isPlaced(squad: StoredSquad, worldCardId: string): boolean {
  return (
    squad.slots.some((s) => s.worldCardId === worldCardId) ||
    squad.substitutes.some((s) => s.worldCardId === worldCardId)
  );
}

/** 指定した先発スロットへ選手を配置する（スロットが埋まっている場合は拒否）。 */
export function assignWorldCardToSlot(
  squad: StoredSquad,
  slotId: string,
  worldCardId: string,
): SquadAssignResult {
  if (typeof worldCardId !== "string" || !WORLD_CARD_ID_RE.test(worldCardId)) {
    return { ok: false, errorCode: "invalid_world_card_id", squad };
  }
  const validSlotIds = new Set(getFormation(squad.formationId).slots.map((s) => s.slotId));
  if (!validSlotIds.has(slotId)) return { ok: false, errorCode: "invalid_slot_id", squad };
  const slot = squad.slots.find((s) => s.slotId === slotId);
  if (!slot) return { ok: false, errorCode: "slot_not_found", squad };
  if (slot.worldCardId === worldCardId) return { ok: true, squad };
  if (isPlaced(squad, worldCardId)) return { ok: false, errorCode: "duplicate_not_allowed", squad };
  if (slot.worldCardId) return { ok: false, errorCode: "slot_occupied", squad };

  return {
    ok: true,
    squad: {
      ...squad,
      slots: squad.slots.map((s) =>
        s.slotId === slotId
          ? { ...s, worldCardId, buildMode: "none" as SquadBuildMode, savedBuildId: null, boosters: undefined, conditionalBoosters: undefined }
          : s,
      ),
      updatedAt: new Date().toISOString(),
    },
  };
}

/** ベンチ（サブ）へ選手を追加する。 */
export function addWorldCardToBench(
  squad: StoredSquad,
  worldCardId: string,
  makeSubId: () => string,
): SquadAssignResult {
  if (typeof worldCardId !== "string" || !WORLD_CARD_ID_RE.test(worldCardId)) {
    return { ok: false, errorCode: "invalid_world_card_id", squad };
  }
  if (isPlaced(squad, worldCardId)) return { ok: false, errorCode: "duplicate_not_allowed", squad };
  if (squad.substitutes.length >= MAX_SUBSTITUTES) return { ok: false, errorCode: "bench_full", squad };

  return {
    ok: true,
    squad: {
      ...squad,
      substitutes: [
        ...squad.substitutes,
        { subId: makeSubId(), worldCardId, buildMode: "none", savedBuildId: null },
      ],
      updatedAt: new Date().toISOString(),
    },
  };
}
