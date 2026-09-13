import { PageContainer } from "@/components/ui/PageContainer";
import { MyTeamCloudView } from "@/components/auth/MyTeamCloudView";

export const metadata = {
  title: "My Teamクラウド保存 | eFootball Team AI",
  description: "My Team(実際に保有しているカードの一覧)を、明示的な操作でクラウドへ保存・確認できる開発者向け技術検証ページ(PoC)。",
  robots: { index: false, follow: false },
};

export default function MyTeamCloudPage() {
  return (
    <PageContainer width="regular">
      <MyTeamCloudView />
    </PageContainer>
  );
}
