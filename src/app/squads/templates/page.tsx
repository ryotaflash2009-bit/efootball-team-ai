import { SquadTemplatesBoard } from "@/components/squad/SquadTemplatesBoard";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-static";

export const metadata = {
  title: "スカッドテンプレート | eFootball Team AI",
};

export default function SquadTemplatesPage() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="スカッドテンプレート"
          icon="squad"
          description="フォーメーションや選手配置（自由配置座標を含む）をテンプレートとして保存し、新しいスカッドの雛形にできます。テンプレートはこの端末のブラウザ内（localStorage）にのみ保存され、通常のスカッドとは別に管理されます。"
        />
        <SquadTemplatesBoard />
      </div>
    </PageContainer>
  );
}
