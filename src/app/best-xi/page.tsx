import { BestXiView } from "@/components/best-xi/BestXiView";
import { PageContainer } from "@/components/ui/PageContainer";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  path: "/best-xi",
  title: "AIベスト11 | TeamAIXI",
  description: "保存した選手から、ポジションの適性と能力値で AI ベスト11（決定的な規則）と控えを選びます。",
});

export default function BestXiPage() {
  return (
    <PageContainer>
      <BestXiView />
    </PageContainer>
  );
}
