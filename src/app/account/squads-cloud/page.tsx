import { PageContainer } from "@/components/ui/PageContainer";
import { SquadsCloudView } from "@/components/auth/SquadsCloudView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata = {
  title: "保存スカッドのクラウド保存 | TeamAIXI",
  description: "保存スカッドを明示的な操作でクラウドへ保存し、別の端末で足りないスカッドだけを追加して戻す機能（アルファ）。",
  robots: PRIVATE_PAGE_ROBOTS,
};

export default function SquadsCloudPage() {
  return (
    <PageContainer width="regular">
      <SquadsCloudView />
    </PageContainer>
  );
}
