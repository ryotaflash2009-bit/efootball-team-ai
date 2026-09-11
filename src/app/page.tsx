import { loadPlayers } from "@/lib/players";
import { getSourceMeta, listPlayers } from "@/lib/world/repository";
import { getManagerCount } from "@/lib/managers/repository";
import { WorldDataUnavailableError } from "@/lib/world/db";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { HomePageView, type HomeMiniCardData, type HomePageWorldSummary } from "@/components/HomePageView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** クライアントへは生の CDN URL（imageUrlCandidate 等）を渡さず、解決済み imageSources だけ渡す。 */
function toMiniCardData(p: WorldPlayerListItem): HomeMiniCardData {
  return {
    worldCardId: p.worldCardId,
    nameJa: p.nameJa,
    nameEn: p.nameEn,
    ovrMax: p.ovrMax,
    ovrBase: p.ovrBase,
    registeredPosition: p.registeredPosition,
    imageSources: resolveCardImageSources({
      worldCardId: p.worldCardId,
      efhubCardId: p.efhubCardId,
      hasEfhubLink: p.hasEfhubLink,
      hasWorldImage: p.imageUrlCandidate != null,
      hasWorldMobileImage: p.mobileImageUrlCandidate != null,
    }),
  };
}

export default async function HomePage() {
  const { meta } = await loadPlayers();

  let world: HomePageWorldSummary | null = null;
  let topOvr: HomeMiniCardData[] = [];
  let recent: HomeMiniCardData[] = [];
  let managerCount: number | null = null;
  try {
    const sourceMeta = getSourceMeta();
    world = { totalCount: sourceMeta.totalCount, source: sourceMeta.source, syncFinishedAt: sourceMeta.syncFinishedAt };
    topOvr = listPlayers({ page: 1, pageSize: 14, query: "", sort: "ovr_max_desc", position: null, cardType: null, playingStyle: null, playingStyleDefensive: null, minOvr: null, maxOvr: null, hasBooster: null }).players.map(toMiniCardData);
    recent = listPlayers({ page: 1, pageSize: 14, query: "", sort: "updated_desc", position: null, cardType: null, playingStyle: null, playingStyleDefensive: null, minOvr: null, maxOvr: null, hasBooster: null }).players.map(toMiniCardData);
    managerCount = getManagerCount();
  } catch (err) {
    if (!(err instanceof WorldDataUnavailableError)) throw err;
  }

  return (
    <HomePageView
      world={world}
      efhubTotal={meta ? meta.totalReceived : null}
      managerCount={managerCount}
      topOvr={topOvr}
      recent={recent}
    />
  );
}
