import { PageContainer } from "@/components/ui/PageContainer";
import { RlsTestView } from "@/components/auth/RlsTestView";

export const metadata = {
  title: "開発用RLS検証 | eFootball Team AI",
  description: "Supabase Row Level Securityによるユーザー別データ分離を確認する開発者向け技術検証ページ(PoC)。",
  robots: { index: false, follow: false },
};

export default function RlsTestPage() {
  return (
    <PageContainer width="regular">
      <RlsTestView />
    </PageContainer>
  );
}
