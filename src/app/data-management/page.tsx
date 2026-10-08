import { PageContainer } from "@/components/ui/PageContainer";
import { DataManagementView } from "@/components/public-info/DataManagementView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const dynamic = "force-static";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "データ管理 | TeamAIXI",
  description: "保存データの保存場所・バックアップ方法・削除方法についての説明ページです。",
};

export default function DataManagementPage() {
  return (
    <PageContainer width="regular">
      <DataManagementView />
    </PageContainer>
  );
}
