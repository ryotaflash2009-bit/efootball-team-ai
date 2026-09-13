import { PageContainer } from "@/components/ui/PageContainer";
import { LocalDataMigrationView } from "@/components/auth/LocalDataMigrationView";

export const metadata = {
  title: "ローカルデータ移行 | eFootball Team AI",
  description: "アカウント分離前にこのブラウザーへ保存されたローカルデータを、現在ログイン中のアカウント専用領域へ安全に移行する画面。",
  robots: { index: false, follow: false },
};

export default function LocalDataMigrationPage() {
  return (
    <PageContainer width="regular">
      <LocalDataMigrationView />
    </PageContainer>
  );
}
