import type { WorldPlayerDetail } from "@/lib/world/types";
import { toProgressionCard } from "@/lib/progression/from-world";
import type { SquadPlayerDisplay } from "./types";

/** World 選手詳細 → スカッドの表示情報。育成カード変換は既存 toProgressionCard を再利用。 */
export function worldDetailToSquadDisplay(detail: WorldPlayerDetail): SquadPlayerDisplay {
  return {
    worldCardId: detail.worldCardId,
    nameEn: detail.nameEn,
    nameJa: detail.nameJa,
    cardType: detail.cardType,
    registeredPosition: detail.registeredPosition,
    playingStyle: detail.playingStyle,
    playingStyleDefensive: detail.playingStyleDefensive,
    ovrBase: detail.ovrBase,
    ovrMax: detail.ovrMax,
    maximumLevel: detail.maximumLevel,
    hasEfhubLink: detail.hasEfhubLink,
    efhubCardId: detail.efhubCardId,
    imageUrlCandidate: detail.imageUrlCandidate,
    mobileImageUrlCandidate: detail.mobileImageUrlCandidate,
    playerSkills: detail.playerSkills,
    aiStyles: detail.aiStyles,
  };
}

export { toProgressionCard };
