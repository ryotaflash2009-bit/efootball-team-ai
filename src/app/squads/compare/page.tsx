import { Suspense } from "react";
import { SquadCompareBoard, SquadComparePageHeader, SquadCompareLoading } from "@/components/squad/SquadCompareBoard";
import { PageContainer } from "@/components/ui/PageContainer";

export const dynamic = "force-static";

export const metadata = {
  title: "スカッド比較 | TeamAIXI",
};

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
