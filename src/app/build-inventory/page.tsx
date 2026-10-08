import { PageContainer } from "@/components/ui/PageContainer";
import { BuildInventoryView } from "@/components/progression/BuildInventoryView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const dynamic = "force-static";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "保存ビルド分析 | TeamAIXI",
};

export default function BuildInventoryPage() {
  return (
    <PageContainer>
      <BuildInventoryView />
    </PageContainer>
  );
}
