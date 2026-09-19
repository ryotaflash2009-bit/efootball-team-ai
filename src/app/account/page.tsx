import { PageContainer } from "@/components/ui/PageContainer";
import { AccountView } from "@/components/auth/AccountView";

export const metadata = {
  title: "アカウント | eFootball Team AI",
  description: "Supabase Authを利用したアカウント管理と、明示操作によるMy Teamクラウド保存・取得を行えます。端末間の自動同期は未対応です。",
};

export default function AccountPage() {
  return (
    <PageContainer width="regular">
      <AccountView />
    </PageContainer>
  );
}
