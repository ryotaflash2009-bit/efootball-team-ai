import { PageContainer } from "@/components/ui/PageContainer";
import { PrivacyView } from "@/components/public-info/PrivacyView";

export const dynamic = "force-static";

export const metadata = {
  title: "プライバシーポリシー(草案) | eFootball Team AI",
  description: "eFootball Team AIが現在取り扱うデータと保存場所についての説明(ベータ公開準備用の草案)です。",
};

export default function PrivacyPage() {
  return (
    <PageContainer width="regular">
      <PrivacyView />
    </PageContainer>
  );
}
