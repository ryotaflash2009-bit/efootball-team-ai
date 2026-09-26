import { loadPlayers } from "@/lib/players";
import { getSourceMeta, listPlayers } from "@/lib/world/repository";
import { getManagerCount } from "@/lib/managers/repository";
import { WorldDataUnavailableError } from "@/lib/world/db";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { HomePageView, type HomeMiniCardData, type HomePageWorldSummary } from "@/components/HomePageView";
import { settledInOrder } from "@/lib/settled-in-order";

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
  // 4つの照会は互いに独立なので並列に行う(直列だと表示完了が合計時間だけ遅れていた。2026-09-27計測)。
  // エラーの扱いは従来の直列実行と同じ: 照会順(メタ → 上位OVR → 最近の更新 → 監督数)で最初の失敗だけを判定し、
  // WorldDataUnavailableErrorなら部分表示、それ以外はerror boundaryへ投げる。
  const base = { page: 1, pageSize: 14, query: "", position: null, cardType: null, playingStyle: null, playingStyleDefensive: null, minOvr: null, maxOvr: null, hasBooster: null } as const;
  const [metaR, topR, recentR, managersR] = await Promise.allSettled([
    getSourceMeta(),
    listPlayers({ ...base, sort: "ovr_max_desc" }),
    listPlayers({ ...base, sort: "updated_desc" }),
    getManagerCount(),
  ]);
  const settled = settledInOrder([metaR, topR, recentR, managersR]);
  if (settled.failure && !(settled.failure.reason instanceof WorldDataUnavailableError)) throw settled.failure.reason;
  // 従来は最初の失敗までに得た値だけを表示していた。照会順で失敗より前の結果だけを使う。
  if (settled.usable(0) && metaR.status === "fulfilled") {
    world = { totalCount: metaR.value.totalCount, source: metaR.value.source, syncFinishedAt: metaR.value.syncFinishedAt };
  }
  if (settled.usable(1) && topR.status === "fulfilled") topOvr = topR.value.players.map(toMiniCardData);
  if (settled.usable(2) && recentR.status === "fulfilled") recent = recentR.value.players.map(toMiniCardData);
  if (settled.usable(3) && managersR.status === "fulfilled") managerCount = managersR.value;

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
