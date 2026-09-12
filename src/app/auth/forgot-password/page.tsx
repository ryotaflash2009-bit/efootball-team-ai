import { PageContainer } from "@/components/ui/PageContainer";
import { ForgotPasswordView } from "@/components/auth/ForgotPasswordView";

export const metadata = {
  title: "パスワードをお忘れの方 | eFootball Team AI",
  description: "パスワード再設定用のメールを送信します（技術検証段階）。",
};

export default function ForgotPasswordPage() {
  return (
    <PageContainer width="regular">
      <ForgotPasswordView />
    </PageContainer>
  );
}
