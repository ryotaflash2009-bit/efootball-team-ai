import { loadPlayers } from "@/lib/players";
import { cachedListRecentlyAddedPlayers } from "@/lib/reference-data/runtime/cached-queries";
import { listProvisionalPlayers } from "@/lib/world/repository";
import { cachedGetManagerCount, cachedGetSourceMeta, cachedListPlayers } from "@/lib/reference-data/runtime/cached-queries";
import { getSourceMeta, listPlayers } from "@/lib/world/repository";
import { getManagerCount } from "@/lib/managers/repository";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { HomePageView, type HomeMiniCardData, type HomePageWorldSummary } from "@/components/HomePageView";
import { settledInOrder } from "@/lib/settled-in-order";
import { classifyHomeFailure } from "@/lib/home-failure";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { NEW_CARD_DAYS, RECENT_LIMIT } from "@/lib/new-cards/constants";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { websiteJsonLd } from "@/lib/seo/structured-data";
import { officialStaleDays } from "@/lib/new-cards/constants";

export const metadata = pageMetadata({
  path: "/",
  title: "TeamAIXI | イーフト（eFootball）のチーム診断・選手比較ツール",
  description: "イーフト（eFootball™）のスカッドを組んでチーム診断。選手の能力値・育成計算・監督の戦術の適性・AI ベスト11 を無料で確認できる非公式ツールです。",
});

export const runtime = "nodejs";
// 5 分ごとに作り直す（2026-10-18: 初回の表示を速くする。データの照会も 5 分のキャッシュ・/players/new と同じ）
export const revalidate = 300;

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
  const base = { page: 1, pageSize: 14, query: "", position: null, cardType: null, playingStyle: null, playingStyleDefensive: null, nationality: null, league: null, team: null, minOvr: null, maxOvr: null, hasBooster: null } as const;
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
  // 本番の 5 分ごとの作り直し（ISR）で照会が失敗したら（一時的・データなしのどちらも）投げる＝前の正しいページを出し続ける（2026-10-18/20）。
  // ビルドの時（前のページが無い）と開発（next dev）は従来どおり、得られた値だけで表示する（「一時的に読み込めなかった」の表示）。
  const isIsrRefresh = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
  if (isIsrRefresh && handling !== "none") throw settled.failure!.reason;
  // 従来は最初の失敗までに得た値だけを表示していた。照会順で失敗より前の結果だけを使う。
  if (settled.usable(0) && metaR.status === "fulfilled") {
    world = { totalCount: metaR.value.totalCount, source: metaR.value.source, syncFinishedAt: metaR.value.syncFinishedAt, latestCardUpdatedAt: metaR.value.latestCardUpdatedAt ?? null };
  }
  if (settled.usable(1) && topR.status === "fulfilled") topOvr = topR.value.players.map(toMiniCardData);
  if (settled.usable(2) && recentR.status === "fulfilled") recent = recentR.value.players.map(toMiniCardData);
  if (settled.usable(3) && managersR.status === "fulfilled") managerCount = managersR.value;

  // 新しいカードの枚数。作り直しの時に取れなければ投げる（少ない枚数のページを 5 分出し続けない）
  let recentlyAdded: unknown[];
  try {
    recentlyAdded = await cachedListRecentlyAddedPlayers(NEW_CARD_DAYS, RECENT_LIMIT);
  } catch (err) {
    if (isIsrRefresh) throw err;
    recentlyAdded = [];
  }
  const provisionalCount = listProvisionalPlayers().length + recentlyAdded.length;
  // 正式なデータの取り込みが止まっていれば知らせる（選手一覧・新しいカードと同じ規則・2026-11-01）。ISR の作り直し（5 分）ごとに計算する
  const newestProvisionalAt = listProvisionalPlayers().map((p) => p.provisional?.firstSeenAt ?? null).filter((v): v is string => typeof v === "string").sort().at(-1) ?? null;
  const staleDays = officialStaleDays(world?.syncFinishedAt ?? null, newestProvisionalAt);

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
        provisionalCount={provisionalCount}
        staleDays={staleDays}
      />
    </>
  );
}
