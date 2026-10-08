import { Suspense } from "react";
import { SquadCompareBoard, SquadComparePageHeader, SquadCompareLoading } from "@/components/squad/SquadCompareBoard";
import { PageContainer } from "@/components/ui/PageContainer";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  path: "/squads/compare",
  title: "スカッド比較 | TeamAIXI",
  description: "2 つのスカッドの診断・能力・配置を並べて比べられます。",
});

export default function SquadComparePage() {
  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-5">
        <SquadComparePageHeader />
        <Suspense fallback={<SquadCompareLoading />}>
          <SquadCompareBoard />
        </Suspense>
      </div>
    </PageContainer>
  );
}
