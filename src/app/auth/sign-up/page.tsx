import { PageContainer } from "@/components/ui/PageContainer";
import { SignUpView } from "@/components/auth/SignUpView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
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
