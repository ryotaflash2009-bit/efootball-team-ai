import { PageContainer } from "@/components/ui/PageContainer";
import { BuildInventoryView } from "@/components/progression/BuildInventoryView";

export const dynamic = "force-static";

export const metadata = {
  title: "保存ビルド分析 | eFootball Team AI",
};

export default function BuildInventoryPage() {
  return (
    <PageContainer>
      <BuildInventoryView />
    </PageContainer>
  );
}
