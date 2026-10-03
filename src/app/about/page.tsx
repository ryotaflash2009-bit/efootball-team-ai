import { PageContainer } from "@/components/ui/PageContainer";
import { AboutView } from "@/components/public-info/AboutView";

export const dynamic = "force-static";

export const metadata = {
  title: "サービス概要 | TeamAIXI",
  description: "TeamAIXIで現在利用できる機能・利用できない機能をまとめた説明ページです。",
};

export default function AboutPage() {
  return (
    <PageContainer width="regular">
      <AboutView />
    </PageContainer>
  );
}
