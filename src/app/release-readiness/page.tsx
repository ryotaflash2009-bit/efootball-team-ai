import { PageContainer } from "@/components/ui/PageContainer";
import { ReleaseReadinessView } from "@/components/public-info/ReleaseReadinessView";

export const dynamic = "force-static";

export const metadata = {
  title: "公開準備状況 | eFootball Team AI",
  description: "eFootball Team AIの現在の提供段階と、公開前に必要な残作業をまとめたページです。",
};

export default function ReleaseReadinessPage() {
  return (
    <PageContainer width="regular">
      <ReleaseReadinessView />
    </PageContainer>
  );
}
