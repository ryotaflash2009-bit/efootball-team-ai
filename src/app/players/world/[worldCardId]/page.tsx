import { notFound } from "next/navigation";
import { cachedGetEfhubAnalysisDetail, cachedGetPlayerByWorldId } from "@/lib/reference-data/runtime/cached-queries";
import { getPlayerByWorldId } from "@/lib/world/repository";
import { WorldDataUnavailableError } from "@/lib/world/db";
import { worldCardIdSchema } from "@/lib/world/schemas";
import { toProgressionCard } from "@/lib/progression/from-world";
import { resolveCardImageSources } from "@/lib/world/image";
import { getEfhubAnalysisDetail } from "@/lib/world/analysis-repository";
import { buildPlayerAnalysis } from "@/lib/world/player-analysis";
import { PageContainer } from "@/components/ui/PageContainer";
import { WorldPlayerDetailView } from "@/components/world/WorldPlayerDetailView";
import { PlayerDetailWorldDataUnavailable } from "@/components/world/PlayerDetailWorldDataUnavailable";

export const runtime = "nodejs";
export const revalidate = 300;

const DETAIL_TAB_IDS = ["overview", "stats", "skills", "progression", "data"] as const;

export default async function WorldPlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ worldCardId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { worldCardId } = await params;
  const sp = (await searchParams) ?? {};
  const tabParam = typeof sp.tab === "string" ? sp.tab : null;
  const initialTab = DETAIL_TAB_IDS.includes(tabParam as (typeof DETAIL_TAB_IDS)[number])
    ? (tabParam as string)
    : undefined;
  const parsed = worldCardIdSchema.safeParse(decodeURIComponent(worldCardId));
  if (!parsed.success) notFound();

  // 分析（EFHUB）の読み込みはカード ID だけで始められるため、選手データの読み込みと並行して始める（直列の待ちをなくす。2026-10-04）。
  // 失敗しても分析なしで表示する（従来どおり）。選手が無い・データが使えない場合は結果を使わない。
  const analysisPromise = cachedGetEfhubAnalysisDetail(parsed.data).catch(() => null);
  let player: Awaited<ReturnType<typeof getPlayerByWorldId>> = null;
  try {
    player = await cachedGetPlayerByWorldId(parsed.data);
  } catch (err) {
    if (err instanceof WorldDataUnavailableError) {
      return (
        <PageContainer>
          <PlayerDetailWorldDataUnavailable />
        </PageContainer>
      );
    }
    throw err;
  }

  if (!player) notFound();

  const progressionCard = toProgressionCard(player);
  const progressionImageSources = resolveCardImageSources({
    worldCardId: player.worldCardId,
    efhubCardId: player.efhubCardId,
    hasEfhubLink: player.hasEfhubLink,
    hasWorldImage: player.imageUrlCandidate != null,
    hasWorldMobileImage: player.mobileImageUrlCandidate != null,
  });

  const analysisDetail: Awaited<ReturnType<typeof getEfhubAnalysisDetail>> = await analysisPromise;
  const playerAnalysis = buildPlayerAnalysis(player, analysisDetail);
  // クライアントへは生の CDN URL（imageUrlCandidate 等）を渡さず、解決済み imageSources だけ渡す。
  const { imageUrlCandidate: _imageUrlCandidate, mobileImageUrlCandidate: _mobileImageUrlCandidate, ...safePlayer } = player;

  return (
    <WorldPlayerDetailView
      player={safePlayer}
      progressionCard={progressionCard}
      progressionImageSources={progressionImageSources}
      heroImageSources={progressionImageSources}
      playerAnalysis={playerAnalysis}
      hasEfhubAnalysis={analysisDetail != null}
      initialTab={initialTab}
    />
  );
}
