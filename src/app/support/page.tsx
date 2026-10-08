import { PageContainer } from "@/components/ui/PageContainer";
import { SupportView } from "@/components/public-info/SupportView";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  path: "/support",
  title: "問い合わせ | TeamAIXI",
  description: "TeamAIXIへの問い合わせ・不具合報告・権利者からの連絡についての案内ページです。",
});

export default function SupportPage() {
  return (
    <PageContainer width="regular">
      <SupportView />
    </PageContainer>
  );
}
