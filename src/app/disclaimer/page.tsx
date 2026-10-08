import { PageContainer } from "@/components/ui/PageContainer";
import { DisclaimerView } from "@/components/public-info/DisclaimerView";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  path: "/disclaimer",
  title: "免責事項 | TeamAIXI",
  description: "TeamAIXI が非公式サービスであること、データと分析結果の性質についての免責事項です。",
});

export default function DisclaimerPage() {
  return (
    <PageContainer width="regular">
      <DisclaimerView />
    </PageContainer>
  );
}
