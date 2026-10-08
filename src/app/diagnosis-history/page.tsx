import { PageContainer } from "@/components/ui/PageContainer";
import { DiagnosisHistoryView } from "@/components/squad/DiagnosisHistoryView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

// 履歴はブラウザー内(localStorage)だけにあり、ページ自体は静的。サーバー側の保存・送信はない。
export const dynamic = "force-static";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "診断履歴 | TeamAIXI",
  description: "このブラウザーに保存したスカッド診断の履歴です。",
};

export default function DiagnosisHistoryPage() {
  return (
    <PageContainer width="regular">
      <DiagnosisHistoryView />
    </PageContainer>
  );
}
