import { SquadTemplatesBoard, SquadTemplatesPageHeader } from "@/components/squad/SquadTemplatesBoard";
import { PageContainer } from "@/components/ui/PageContainer";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  path: "/squads/templates",
  title: "スカッドテンプレート | TeamAIXI",
  description: "よく使われるフォーメーションの型からスカッドを作れます。",
});

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
