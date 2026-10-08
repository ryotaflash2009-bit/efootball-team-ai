import { loadPlayers } from "@/lib/players";
import { cachedGetManagerCount, cachedGetSourceMeta, cachedListPlayers } from "@/lib/reference-data/runtime/cached-queries";
import { getSourceMeta, listPlayers } from "@/lib/world/repository";
import { getManagerCount } from "@/lib/managers/repository";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { HomePageView, type HomeMiniCardData, type HomePageWorldSummary } from "@/components/HomePageView";
import { settledInOrder } from "@/lib/settled-in-order";
import { classifyHomeFailure } from "@/lib/home-failure";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { websiteJsonLd } from "@/lib/seo/structured-data";

export const metadata = pageMetadata({
  path: "/",
  title: "TeamAIXI | イーフト（eFootball）のチーム診断・選手比較ツール",
  description: "イーフト（eFootball™）のスカッドを組んでチーム診断。選手の能力値・育成計算・監督の戦術の適性・AI ベスト11 を無料で確認できる非公式ツールです。",
});

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
  // WorldDataUnavailableErrorなら部分表示。WorldQueryError（一時的な照会の失敗。サーバー側には分類つきで記録済み）も、
  // ホームは要約の画面なので error boundary へ投げず、失敗より前に得た値だけで表示して「一時的に読み込めなかった」と示す
  // （2026-10-02 の公開 black-box で一度だけ観測。再現 0/60）。それ以外の例外は従来どおり error boundary へ。
  const base = { page: 1, pageSize: 14, query: "", position: null, cardType: null, playingStyle: null, playingStyleDefensive: null, minOvr: null, maxOvr: null, hasBooster: null } as const;
  const [metaR, topR, recentR, managersR] = await Promise.allSettled([
    cachedGetSourceMeta(),
    cachedListPlayers({ ...base, sort: "ovr_max_desc" }),
    cachedListPlayers({ ...base, sort: "updated_desc" }),
    cachedGetManagerCount(),
  ]);
  const settled = settledInOrder([metaR, topR, recentR, managersR]);
  const handling = classifyHomeFailure(settled.failure ? settled.failure.reason : undefined);
  if (handling === "throw") throw settled.failure!.reason;
  const temporaryError = handling === "temporary";
  // 従来は最初の失敗までに得た値だけを表示していた。照会順で失敗より前の結果だけを使う。
  if (settled.usable(0) && metaR.status === "fulfilled") {
    world = { totalCount: metaR.value.totalCount, source: metaR.value.source, syncFinishedAt: metaR.value.syncFinishedAt };
  }
  if (settled.usable(1) && topR.status === "fulfilled") topOvr = topR.value.players.map(toMiniCardData);
  if (settled.usable(2) && recentR.status === "fulfilled") recent = recentR.value.players.map(toMiniCardData);
  if (settled.usable(3) && managersR.status === "fulfilled") managerCount = managersR.value;

  return (
    <>
      <JsonLdScript data={websiteJsonLd()} />
      <HomePageView
        world={world}
        efhubTotal={meta ? meta.totalReceived : null}
        managerCount={managerCount}
        topOvr={topOvr}
        recent={recent}
        temporaryError={temporaryError}
      />
    </>
  );
}
