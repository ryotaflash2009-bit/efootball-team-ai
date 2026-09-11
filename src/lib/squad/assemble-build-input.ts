import type { WorldPlayerDetail } from "@/lib/world/types";
import type { ManagerContext, SavedBuild } from "@/lib/progression/types";
import type { LinkUpPlay } from "@/lib/managers/types";
import { toProgressionCard } from "@/lib/progression/from-world";
import { worldDetailToSquadDisplay } from "./from-world";
import { getFormation } from "./formations";
import { clampCoord, inferFreshRole, isPlacementRole } from "./role-inference";
import type { BuildSquadInput } from "./build-squad";
import type { SquadEntryInput, StoredSquad } from "./types";

/**
 * StoredSquad ＋ 解決済み選手詳細 → buildSquad の入力（純関数）。
 *
 * SquadEditor の `computed` 組み立てと同じ規則をコンポーネント外へ切り出したもの。
 * 比較ビューはこれを通して既存の `buildSquad` を呼ぶ（比較専用の集計は作らない）。
 *
 *  - `details`: worldCardId → WorldPlayerDetail（by-id API の結果）。無い ID は「未解決」。
 *  - 未解決の先発カードは entry を渡さない（buildSquad 側で entry:null になるが座標・ロールは保持）。
 *  - 未解決のベンチカードは substitutes から除外（SquadEditor と同じ）。
 *  - 座標は保存値 → formation 既定の順で補完。書き戻しはしない（表示のための導出のみ）。
 */
export interface AssembleBuildInputArgs {
  squad: StoredSquad;
  details: Map<string, WorldPlayerDetail>;
  savedBuildsByCard: Map<string, SavedBuild[]>;
  manager: ManagerContext | null;
  managerLinkUpPlays: LinkUpPlay[] | null;
}

/** slotId → { x, y, role }（effectiveRole = roleOverride ?? 座標からの推定）。占有スロットのみ。 */
export function resolveSlotPlacements(
  squad: StoredSquad,
): Record<string, { x: number; y: number; role: string }> {
  const out: Record<string, { x: number; y: number; role: string }> = {};
  const fdef = new Map(getFormation(squad.formationId).slots.map((s) => [s.slotId, s]));
  for (const sl of squad.slots) {
    if (!sl.worldCardId) continue;
    const fs = fdef.get(sl.slotId);
    const x = clampCoord(sl.x ?? fs?.x ?? 50);
    const y = clampCoord(sl.y ?? fs?.y ?? 50);
    const role = isPlacementRole(sl.roleOverride) ? sl.roleOverride : inferFreshRole(x, y);
    out[sl.slotId] = { x, y, role };
  }
  return out;
}

function makeEntry(
  worldCardId: string,
  buildMode: SquadEntryInput["buildMode"],
  savedBuildId: string | null,
  boosters: SquadEntryInput["selectedPlayerBoosters"],
  conditionalBoosters: SquadEntryInput["selectedConditionalBoosters"],
  args: AssembleBuildInputArgs,
): SquadEntryInput | null {
  const detail = args.details.get(worldCardId);
  if (!detail) return null;
  let savedAllocation: Record<string, number> | null = null;
  let savedBuildName: string | null = null;
  let savedBuildRulesVersion: string | null = null;
  if (savedBuildId) {
    const b = (args.savedBuildsByCard.get(worldCardId) ?? []).find((x) => x.buildId === savedBuildId);
    if (b) {
      savedAllocation = b.progressionAllocation;
      savedBuildName = b.buildName;
      savedBuildRulesVersion = b.rulesVersion;
    }
  }
  return {
    card: toProgressionCard(detail),
    display: worldDetailToSquadDisplay(detail),
    buildMode,
    savedAllocation,
    savedBuildName,
    savedBuildRulesVersion,
    selectedPlayerBoosters: boosters ?? [],
    selectedConditionalBoosters: conditionalBoosters ?? [],
  };
}

export function assembleBuildSquadInput(args: AssembleBuildInputArgs): BuildSquadInput {
  const { squad } = args;
  const entries: Record<string, SquadEntryInput | null> = {};
  const slotPlacements = resolveSlotPlacements(squad);

  for (const sl of squad.slots) {
    entries[sl.slotId] = sl.worldCardId
      ? makeEntry(sl.worldCardId, sl.buildMode, sl.savedBuildId, sl.boosters, sl.conditionalBoosters, args)
      : null;
  }

  const substitutes = squad.substitutes
    .map((sub) => {
      const e = makeEntry(sub.worldCardId, sub.buildMode, sub.savedBuildId, sub.boosters, sub.conditionalBoosters, args);
      return e ? { subId: sub.subId, entry: e } : null;
    })
    .filter((x): x is { subId: string; entry: SquadEntryInput } => x != null);

  return {
    formationId: squad.formationId,
    entries,
    substitutes,
    manager: args.manager,
    managerLinkUpPlays: args.managerLinkUpPlays,
    captainSlotId: squad.captainSlotId ?? null,
    linkUpSelection: squad.linkUp ?? { centerPieceSlotId: null, keyManSlotId: null },
    savedRulesVersion: squad.rulesVersion ?? null,
    slotPlacements,
  };
}
