import { SquadTemplatesBoard, SquadTemplatesPageHeader } from "@/components/squad/SquadTemplatesBoard";
import { PageContainer } from "@/components/ui/PageContainer";

export const dynamic = "force-static";

export const metadata = {
  title: "スカッドテンプレート | TeamAIXI",
};

export default function SquadTemplatesPage() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-5">
        <SquadTemplatesPageHeader />
        <SquadTemplatesBoard />
      </div>
    </PageContainer>
  );
}
