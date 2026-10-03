import { PageContainer } from "@/components/ui/PageContainer";
import { TermsView } from "@/components/public-info/TermsView";

export const dynamic = "force-static";

export const metadata = {
  title: "利用規約 | TeamAIXI",
  description: "非公式の eFootball™ スカッド分析ツール TeamAIXI v1.0 の利用条件です。",
};

export default function TermsPage() {
  return (
    <PageContainer width="regular">
      <TermsView />
    </PageContainer>
  );
}
