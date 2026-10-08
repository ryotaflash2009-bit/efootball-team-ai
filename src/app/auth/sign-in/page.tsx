import { Suspense } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { SignInView } from "@/components/auth/SignInView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "ログイン | TeamAIXI",
  description: "TeamAIXIへログインします（技術検証段階）。",
};

export default function SignInPage() {
  return (
    <PageContainer width="regular">
      <Suspense fallback={null}>
        <SignInView />
      </Suspense>
    </PageContainer>
  );
}
