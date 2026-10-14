import { PageContainer } from "@/components/ui/PageContainer";
import { CommunityView } from "@/components/community/CommunityView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata = {
  title: "コミュニティ（公開プロフィール・友達） | TeamAIXI",
  description: "公開 ID・公開範囲・友達・友達との診断の比較・ブロック・ミュート・通報の設定（ログインが必要）。",
  robots: PRIVATE_PAGE_ROBOTS,
};

export default function CommunityPage() {
  return (
    <PageContainer width="regular">
      <CommunityView />
    </PageContainer>
  );
}
