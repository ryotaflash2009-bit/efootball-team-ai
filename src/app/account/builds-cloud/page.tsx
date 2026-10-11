import { PageContainer } from "@/components/ui/PageContainer";
import { BuildsCloudView } from "@/components/auth/BuildsCloudView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata = {
  title: "保存ビルドのクラウド保存 | TeamAIXI",
  description: "保存ビルド（My Builds）を明示的な操作でクラウドへ保存し、別の端末で足りないビルドだけを追加して戻す機能（アルファ）。",
  robots: PRIVATE_PAGE_ROBOTS,
};

export default function BuildsCloudPage() {
  return (
    <PageContainer width="regular">
      <BuildsCloudView />
    </PageContainer>
  );
}
