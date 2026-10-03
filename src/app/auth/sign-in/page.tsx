import { Suspense } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { SignInView } from "@/components/auth/SignInView";

export const metadata = {
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
