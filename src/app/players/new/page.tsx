import { PageContainer } from "@/components/ui/PageContainer";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { listProvisionalPlayers } from "@/lib/world/repository";
import { cachedListRecentlyAddedPlayers } from "@/lib/reference-data/runtime/cached-queries";
import { resolveCardImageSources } from "@/lib/world/image";
import { ProvisionalCardsView } from "@/components/world/ProvisionalCardsView";
import type { WorldPlayerCardData } from "@/components/world/WorldPlayerCard";
import type { WorldPlayerListItem } from "@/lib/world/types";

// 新しいカード（2026-10-15 暫定・2026-10-17 最近追加された正式なカード）。暫定はリポジトリの JSON、正式は World の created_at。
export const metadata = pageMetadata({
  path: "/players/new",
  title: "新しいカード | TeamAIXI",
  description: "イーフト（eFootball™）の最近追加された選手カードと、正式なデータの反映前の新しいカード（暫定）を一覧で確認できます。正式なデータが届くと自動で置き換わります。",
});

export const runtime = "nodejs";
export const revalidate = 300;

const RECENT_DAYS = 7;

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
  const recent = await cachedListRecentlyAddedPlayers(RECENT_DAYS, 200).catch(() => []);
  return (
    <PageContainer width="full">
      <ProvisionalCardsView cards={listProvisionalPlayers().map(toCardData)} recent={recent.map(toCardData)} recentDays={RECENT_DAYS} />
    </PageContainer>
  );
}
