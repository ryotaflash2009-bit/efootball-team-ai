import { PageContainer } from "@/components/ui/PageContainer";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { listProvisionalPlayers } from "@/lib/world/repository";
import { cachedListRecentlyAddedPlayers } from "@/lib/reference-data/runtime/cached-queries";
import { resolveCardImageSources } from "@/lib/world/image";
import { ProvisionalCardsView } from "@/components/world/ProvisionalCardsView";
import type { WorldPlayerCardData } from "@/components/world/WorldPlayerCard";
import type { WorldPlayerListItem } from "@/lib/world/types";
import { addedBatches } from "@/lib/new-cards/added-batches";

// 新しいカード（2026-10-15 暫定・2026-10-17 最近追加された正式なカード）。暫定はリポジトリの JSON、正式は World の created_at。
export const metadata = pageMetadata({
  path: "/players/new",
  title: "新しいカード | TeamAIXI",
  description: "イーフト（eFootball™）の最近追加された選手カードと、正式なデータの反映前の新しいカード（暫定）を一覧で確認できます。正式なデータが届くと自動で置き換わります。",
});

export const runtime = "nodejs";
export const revalidate = 300;

const RECENT_DAYS = 7;
/** 7 日に追加されるカードの上限の目安（日ごとの枚数が途中で切れないよう多めに・2026-10-18）。 */
const RECENT_LIMIT = 500;
/** パック診断に渡せる枚数（`PackCheckView` の上限と同じ）。 */
const PACK_CHECK_LIMIT = 30;

/** クライアントへは生の CDN URL を渡さず、解決済みの画像だけを渡す（選手一覧と同じ）。 */
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
    imageSources: p.provisional
      ? []
      : resolveCardImageSources({
          worldCardId: p.worldCardId,
          efhubCardId: p.efhubCardId,
          hasEfhubLink: p.hasEfhubLink,
          hasWorldImage: p.imageUrlCandidate != null,
          hasWorldMobileImage: p.mobileImageUrlCandidate != null,
        }),
    provisional: p.provisional ? true : undefined,
  };
}

export default async function NewCardsPage() {
  // 最近追加されたカードは取れなくても暫定の一覧は出す（一時的な照会の失敗で画面全体を壊さない）
  const recent = await cachedListRecentlyAddedPlayers(RECENT_DAYS, RECENT_LIMIT).catch(() => []);
  const provisional = listProvisionalPlayers();
  // 「見た」の時刻は、このページに出ている最も新しいカードの追加時刻（端末の時計・キャッシュの遅れに左右されない・2026-10-18）
  const latestAddedAt = [...recent.map((p) => p.addedAt ?? null), ...provisional.map((p) => p.provisional?.firstSeenAt ?? null)]
    .filter((v): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)))
    .sort()
    .at(-1) ?? null;
  return (
    <PageContainer width="full">
      <ProvisionalCardsView latestAddedAt={latestAddedAt} cards={provisional.map(toCardData)} recent={recent.map(toCardData)} recentDays={RECENT_DAYS} batches={addedBatches(recent, PACK_CHECK_LIMIT)} packCheckLimit={PACK_CHECK_LIMIT} />
    </PageContainer>
  );
}
