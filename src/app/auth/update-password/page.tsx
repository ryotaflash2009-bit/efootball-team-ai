import { PageContainer } from "@/components/ui/PageContainer";
import { UpdatePasswordView } from "@/components/auth/UpdatePasswordView";

export const metadata = {
  title: "新しいパスワードを設定 | eFootball Team AI",
  description: "新しいパスワードを設定します（技術検証段階）。",
};

export default function UpdatePasswordPage() {
  return (
    <PageContainer width="regular">
      <UpdatePasswordView />
    </PageContainer>
  );
}
