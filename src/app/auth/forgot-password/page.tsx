import { PageContainer } from "@/components/ui/PageContainer";
import { ForgotPasswordView } from "@/components/auth/ForgotPasswordView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "パスワードをお忘れの方 | TeamAIXI",
  description: "パスワード再設定用のメールを送信します（技術検証段階）。",
};

export default function ForgotPasswordPage() {
  return (
    <PageContainer width="regular">
      <ForgotPasswordView />
    </PageContainer>
  );
}
