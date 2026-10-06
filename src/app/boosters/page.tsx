import { PageContainer } from "@/components/ui/PageContainer";
import { BoosterListView } from "@/components/progression/BoosterListView";

export const dynamic = "force-static";

export const metadata = {
  title: "ブースター一覧 | TeamAIXI",
  description: "選手ブースターの対象能力・最大の上昇量・効果の証拠の段階の一覧です。",
};

export default function BoostersPage() {
  return (
    <PageContainer width="regular">
      <BoosterListView />
    </PageContainer>
  );
}
