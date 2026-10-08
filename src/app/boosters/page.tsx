import { PageContainer } from "@/components/ui/PageContainer";
import { BoosterListView } from "@/components/progression/BoosterListView";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  path: "/boosters",
  title: "ブースター一覧 | TeamAIXI",
  description: "選手ブースターの対象能力・最大の上昇量・効果の証拠の段階の一覧です。",
});

export default function BoostersPage() {
  return (
    <PageContainer width="regular">
      <BoosterListView />
    </PageContainer>
  );
}
