import { Suspense } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { SignInView } from "@/components/auth/SignInView";

export const metadata = {
  title: "ログイン | eFootball Team AI",
  description: "eFootball Team AIへログインします（技術検証段階）。",
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
