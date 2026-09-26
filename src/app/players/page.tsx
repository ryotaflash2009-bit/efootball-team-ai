import { parseWorldListQuery } from "@/lib/world/schemas";
import { listPlayers, getFacets, getSourceMeta } from "@/lib/world/repository";
import { WorldDataUnavailableError } from "@/lib/world/db";
import type { WorldFacets, WorldPlayerListItem } from "@/lib/world/types";
import { resolveCardImageSources } from "@/lib/world/image";
import { PageContainer } from "@/components/ui/PageContainer";
import { PlayersPageView, PlayersPageUnavailable, PlayersPageFailed, PlayersPageSearchRejected } from "@/components/world/PlayersPageView";
import { SearchInputRejectedError, checkSearchInput } from "@/lib/search/search-input";
import type { WorldPlayerCardData } from "@/components/world/WorldPlayerCard";
import { settledInOrder } from "@/lib/settled-in-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const pick = (sp: SP, key: string): string | null => (typeof sp[key] === "string" ? (sp[key] as string) : null);

/** クライアントへは生の CDN URL（imageUrlCandidate 等）を渡さず、解決済み imageSources だけ渡す。 */
function toCardData(p: WorldPlayerListItem): WorldPlayerCardData {
  return {
    worldCardId: p.worldCardId,
    nameJa: p.nameJa,
    nameEn: p.nameEn,
    ovrMax: p.ovrMax,
    ovrBase: p.ovrBase,
    maximumLevel: p.maximumLevel,
    registeredPosition: p.registeredPosition,
    cardType: p.cardType,
    hasEfhubLink: p.hasEfhubLink,
    imageSources: resolveCardImageSources({
      worldCardId: p.worldCardId,
      efhubCardId: p.efhubCardId,
      hasEfhubLink: p.hasEfhubLink,
      hasWorldImage: p.imageUrlCandidate != null,
      hasWorldMobileImage: p.mobileImageUrlCandidate != null,
    }),
  };
}

export default async function PlayersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  // 制御文字等を含む検索語は照会せず、安全な表示にする(上流の防御による拒否も同じ表示)。
  if (!checkSearchInput(pick(sp, "q")).ok) {
    return (
      <PageContainer>
        <PlayersPageSearchRejected />
      </PageContainer>
    );
  }

  const query = parseWorldListQuery({
    page: pick(sp, "page"),
    pageSize: pick(sp, "pageSize"),
    q: pick(sp, "q"),
    sort: pick(sp, "sort"),
    position: pick(sp, "position"),
    cardType: pick(sp, "cardType"),
    playingStyle: pick(sp, "playingStyle"),
    playingStyleDef: pick(sp, "playingStyleDef"),
    minOvr: pick(sp, "minOvr"),
    maxOvr: pick(sp, "maxOvr"),
    hasBooster: pick(sp, "hasBooster"),
  });

  let result: Awaited<ReturnType<typeof listPlayers>> | null = null;
  let facets: WorldFacets = { positions: [], cardTypes: [], playingStyles: [], playingStyleDefensives: [] };
  let sourceMeta: Awaited<ReturnType<typeof getSourceMeta>> | null = null;
  let unavailable = false;
  let failed = false;
  let rejected = false;

  // 3つの照会は互いに独立なので並列に行う(直列だと表示完了が合計時間だけ遅れていた。2026-09-25計測)。
  // エラーの扱いは従来の直列実行と同じ: 一覧 → facets → メタ情報の順に、最初の失敗で判定する。
  const [listR, facetsR, metaR] = await Promise.allSettled([listPlayers(query), getFacets(), getSourceMeta()]);
  const settled = settledInOrder([listR, facetsR, metaR]);
  if (settled.failure) {
    const err: unknown = settled.failure.reason;
    if (err instanceof WorldDataUnavailableError) unavailable = true;
    else if (err instanceof SearchInputRejectedError) rejected = true;
    else failed = true;
  } else if (listR.status === "fulfilled" && facetsR.status === "fulfilled" && metaR.status === "fulfilled") {
    result = listR.value;
    facets = facetsR.value;
    sourceMeta = metaR.value;
  }

  if (rejected) {
    return (
      <PageContainer>
        <PlayersPageSearchRejected />
      </PageContainer>
    );
  }

  if (unavailable) {
    return (
      <PageContainer>
        <PlayersPageUnavailable />
      </PageContainer>
    );
  }

  if (failed || !result) {
    return (
      <PageContainer>
        <PlayersPageFailed />
      </PageContainer>
    );
  }

  const hasFilters = !!(
    query.query ||
    query.position ||
    query.cardType ||
    query.playingStyle ||
    query.playingStyleDefensive ||
    query.minOvr != null ||
    query.maxOvr != null ||
    query.hasBooster != null
  );
  return (
    <PageContainer>
      <PlayersPageView
        result={{ ...result, players: result.players.map(toCardData) }}
        facets={facets}
        sourceMeta={sourceMeta}
        hasFilters={hasFilters}
        searchParams={sp}
      />
    </PageContainer>
  );
}
