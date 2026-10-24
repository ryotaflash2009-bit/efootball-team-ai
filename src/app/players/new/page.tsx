import { PageContainer } from "@/components/ui/PageContainer";
import { NEW_CARD_DAYS, RECENT_LIMIT, officialStaleDays } from "@/lib/new-cards/constants";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { listProvisionalPlayers } from "@/lib/world/repository";
import { cachedGetSourceMeta, cachedListRecentlyAddedPlayers } from "@/lib/reference-data/runtime/cached-queries";
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
  const recent = await cachedListRecentlyAddedPlayers(NEW_CARD_DAYS, RECENT_LIMIT).catch(() => []);
  const provisional = listProvisionalPlayers();
  // 正式なデータの最後の取り込み（7 日より前なら案内を出す・2026-10-24: 取得元の機械判定で取り込みが止まった）
  const lastImportAt = await cachedGetSourceMeta()
    .then((m) => m.syncFinishedAt ?? null)
    .catch(() => null);
  const newestProvisionalAt = provisional.map((p) => p.provisional?.firstSeenAt ?? null).filter((v): v is string => typeof v === "string").sort().at(-1) ?? null;
  const staleDays = officialStaleDays(lastImportAt, newestProvisionalAt);
  // 「見た」の時刻は、このページに出ている最も新しいカードの追加時刻（端末の時計・キャッシュの遅れに左右されない・2026-10-18）
  const latestAddedAt = [...recent.map((p) => p.addedAt ?? null), ...provisional.map((p) => p.provisional?.firstSeenAt ?? null)]
    .filter((v): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)))
    .sort()
    .at(-1) ?? null;
  return (
    <PageContainer width="full">
      <ProvisionalCardsView lastImportAt={lastImportAt} staleDays={staleDays} latestAddedAt={latestAddedAt} cards={provisional.map(toCardData)} recent={recent.map(toCardData)} recentDays={NEW_CARD_DAYS} batches={addedBatches(recent, PACK_CHECK_LIMIT)} packCheckLimit={PACK_CHECK_LIMIT} />
    </PageContainer>
  );
}
