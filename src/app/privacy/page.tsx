import { PageContainer } from "@/components/ui/PageContainer";
import { PrivacyView } from "@/components/public-info/PrivacyView";

export const dynamic = "force-static";

export const metadata = {
  title: "プライバシーポリシー | TeamAIXI",
  description: "TeamAIXI v1.0 が扱うデータ・保存場所・外部送信についての説明です。",
};

export default function PrivacyPage() {
  return (
    <PageContainer width="regular">
      <PrivacyView />
    </PageContainer>
  );
}
