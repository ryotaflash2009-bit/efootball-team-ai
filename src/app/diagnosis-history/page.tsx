import { PageContainer } from "@/components/ui/PageContainer";
import { DiagnosisHistoryView } from "@/components/squad/DiagnosisHistoryView";

// 履歴はブラウザー内(localStorage)だけにあり、ページ自体は静的。サーバー側の保存・送信はない。
export const dynamic = "force-static";

export const metadata = {
  title: "診断履歴 | eFootball Team AI",
  description: "このブラウザーに保存したスカッド診断の履歴です。",
};

export default function DiagnosisHistoryPage() {
  return (
    <PageContainer width="regular">
      <DiagnosisHistoryView />
    </PageContainer>
  );
}
