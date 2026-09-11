import { PageContainer } from "@/components/ui/PageContainer";
import { SupportView } from "@/components/public-info/SupportView";

export const dynamic = "force-static";

export const metadata = {
  title: "問い合わせ | eFootball Team AI",
  description: "eFootball Team AIへの問い合わせ・不具合報告・権利者からの連絡についての案内ページです。",
};

export default function SupportPage() {
  return (
    <PageContainer width="regular">
      <SupportView />
    </PageContainer>
  );
}
