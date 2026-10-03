import { PageContainer } from "@/components/ui/PageContainer";
import { SignUpView } from "@/components/auth/SignUpView";

export const metadata = {
  title: "新規登録 | TeamAIXI",
  description: "TeamAIXIのアカウントを新規登録します（技術検証段階）。",
};

export default function SignUpPage() {
  return (
    <PageContainer width="regular">
      <SignUpView />
    </PageContainer>
  );
}
