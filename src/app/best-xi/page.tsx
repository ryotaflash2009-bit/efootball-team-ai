import { BestXiView } from "@/components/best-xi/BestXiView";
import { PageContainer } from "@/components/ui/PageContainer";

export const dynamic = "force-static";

export const metadata = {
  title: "AIベスト11 | eFootball Team AI",
};

export default function BestXiPage() {
  return (
    <PageContainer>
      <BestXiView />
    </PageContainer>
  );
}
