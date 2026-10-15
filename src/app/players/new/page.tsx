import { PageContainer } from "@/components/ui/PageContainer";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { listProvisionalPlayers } from "@/lib/world/repository";
import { ProvisionalCardsView } from "@/components/world/ProvisionalCardsView";
import type { WorldPlayerCardData } from "@/components/world/WorldPlayerCard";

// 新しいカード（暫定・2026-10-15）。データはリポジトリの JSON（同期の workflow が更新し、デプロイで反映）。
export const metadata = pageMetadata({
  path: "/players/new",
  title: "新しいカード（暫定） | TeamAIXI",
  description: "イーフト（eFootball™）の新しい選手カードを、正式なデータの反映前に暫定の能力値・スキルで確認できます。正式なデータが届くと自動で置き換わります。",
});

export default function ProvisionalCardsPage() {
  const cards: WorldPlayerCardData[] = listProvisionalPlayers().map((p) => ({
    worldCardId: p.worldCardId,
    nameJa: p.nameJa,
    nameEn: p.nameEn,
    ovrMax: p.ovrMax,
    ovrBase: p.ovrBase,
    maximumLevel: p.maximumLevel,
    registeredPosition: p.registeredPosition,
    cardType: p.cardType,
    hasEfhubLink: false,
    // 暫定のカードの画像は持たない（プレースホルダー）
    imageSources: [],
    provisional: true,
  }));
  return (
    <PageContainer width="full">
      <ProvisionalCardsView cards={cards} />
    </PageContainer>
  );
}
