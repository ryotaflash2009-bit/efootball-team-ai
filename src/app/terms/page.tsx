import { PageContainer } from "@/components/ui/PageContainer";
import { TermsView } from "@/components/public-info/TermsView";

export const dynamic = "force-static";

export const metadata = {
  title: "利用規約(草案) | eFootball Team AI",
  description: "eFootball Team AIの利用条件についての説明(ベータ公開準備用の草案)です。",
};

export default function TermsPage() {
  return (
    <PageContainer width="regular">
      <TermsView />
    </PageContainer>
  );
}
