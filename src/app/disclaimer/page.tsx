import { PageContainer } from "@/components/ui/PageContainer";
import { DisclaimerView } from "@/components/public-info/DisclaimerView";

export const dynamic = "force-static";

export const metadata = {
  title: "免責事項 | eFootball Team AI",
  description: "eFootball Team AIが非公式サービスであること、および分析結果の性質についての免責事項です。",
};

export default function DisclaimerPage() {
  return (
    <PageContainer width="regular">
      <DisclaimerView />
    </PageContainer>
  );
}
