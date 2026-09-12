import { PageContainer } from "@/components/ui/PageContainer";
import { AccountView } from "@/components/auth/AccountView";

export const metadata = {
  title: "アカウント | eFootball Team AI",
  description: "アカウントのログイン状態を確認します（技術検証段階。クラウド同期は未実装）。",
};

export default function AccountPage() {
  return (
    <PageContainer width="regular">
      <AccountView />
    </PageContainer>
  );
}
