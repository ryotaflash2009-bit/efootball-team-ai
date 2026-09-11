import { PageContainer } from "@/components/ui/PageContainer";
import { DataManagementView } from "@/components/public-info/DataManagementView";

export const dynamic = "force-static";

export const metadata = {
  title: "データ管理 | eFootball Team AI",
  description: "保存データの保存場所・バックアップ方法・削除方法についての説明ページです。",
};

export default function DataManagementPage() {
  return (
    <PageContainer width="regular">
      <DataManagementView />
    </PageContainer>
  );
}
