import { getFormation } from "./formations";
import { inferFreshRole, isPlacementRole, clampCoord } from "./role-inference";
import { evaluateCompatibility } from "./position";
import type { StoredSquad } from "./types";

/**
 * ある worldCardId がどのスカッドで使われているか（純関数）。
 * worldCardId は文字列として扱う。適性は「配置ロール」ではなくカード本来の登録ポジションで判定。
 */

export interface SquadUsage {
  squadId: string;
  squadName: string;
  formationId: string;
  formationName: string;
  hasCustomPositioning: boolean;
  area: "starter" | "bench";
  slotId: string | null;
  benchIndex: number | null;
  x: number | null;
  y: number | null;
  /** 配置ロール（座標 or 手動指定・内部コード）。ベンチは null。 */
  placementRole: string | null;
  /** カード本来の登録ポジション（適性判定に使うが、ここでは呼び出し側が渡す） */
  isCaptain: boolean;
  setPieceRoles: string[];
  savedBuildId: string | null;
  updatedAt: string;
}

function slotHasCustomPositioning(squad: StoredSquad): boolean {
  const fdef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
  return squad.slots.some((sl) => {
    if (!sl.worldCardId) return false;
    if (sl.roleOverride) return true;
    const fs = fdef.get(sl.slotId);
    if (!fs || sl.x == null || sl.y == null) return false;
    return Math.abs(sl.x - fs.x) > 1.5 || Math.abs(sl.y - fs.y) > 1.5;
  });
}

export function findSquadUsageByWorldCardId(
  squads: StoredSquad[],
  worldCardId: string,
): SquadUsage[] {
  if (typeof worldCardId !== "string" || !worldCardId) return [];
  const out: SquadUsage[] = [];
  for (const squad of squads) {
    const fdef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
    const custom = slotHasCustomPositioning(squad);
    const setPieceSlots = squad.setPieces ?? { corners: null, freeKicks: null, penalties: null };

    for (const sl of squad.slots) {
      if (sl.worldCardId !== worldCardId) continue;
      const fs = fdef.get(sl.slotId);
      const x = clampCoord(sl.x ?? fs?.x ?? 50);
      const y = clampCoord(sl.y ?? fs?.y ?? 50);
      const placementRole = isPlacementRole(sl.roleOverride) ? sl.roleOverride : inferFreshRole(x, y);
      const setPieceRoles: string[] = [];
      if (setPieceSlots.freeKicks === sl.slotId) setPieceRoles.push("FK");
      if (setPieceSlots.corners === sl.slotId) setPieceRoles.push("CK");
      if (setPieceSlots.penalties === sl.slotId) setPieceRoles.push("PK");
      out.push({
        squadId: squad.squadId,
        squadName: squad.squadName,
        formationId: squad.formationId,
        formationName: getFormation(squad.formationId).name,
        hasCustomPositioning: custom,
        area: "starter",
        slotId: sl.slotId,
        benchIndex: null,
        x,
        y,
        placementRole,
        isCaptain: squad.captainSlotId === sl.slotId,
        setPieceRoles,
        savedBuildId: sl.savedBuildId ?? null,
        updatedAt: squad.updatedAt,
      });
    }

    squad.substitutes.forEach((sub, index) => {
      if (sub.worldCardId !== worldCardId) return;
      out.push({
        squadId: squad.squadId,
        squadName: squad.squadName,
        formationId: squad.formationId,
        formationName: getFormation(squad.formationId).name,
        hasCustomPositioning: custom,
        area: "bench",
        slotId: null,
        benchIndex: index,
        x: null,
        y: null,
        placementRole: null,
        isCaptain: false,
        setPieceRoles: [],
        savedBuildId: sub.savedBuildId ?? null,
        updatedAt: squad.updatedAt,
      });
    });
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

/** 配置ロールに対するカード適性のラベル（配置ロールと適性の分離を UI に渡す用）。 */
export function suitabilityForPlacement(
  registeredPosition: string | null,
  placementRole: string | null,
): string {
  if (!placementRole) return "—";
  return evaluateCompatibility(registeredPosition, placementRole).label;
}
