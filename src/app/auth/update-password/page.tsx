import { PageContainer } from "@/components/ui/PageContainer";
import { UpdatePasswordView } from "@/components/auth/UpdatePasswordView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "新しいパスワードを設定 | TeamAIXI",
  description: "新しいパスワードを設定します（技術検証段階）。",
};

export default function UpdatePasswordPage() {
  return (
    <PageContainer width="regular">
      <UpdatePasswordView />
    </PageContainer>
  );
}
