import type { Metadata } from "next";
import { PageContainer } from "@/components/ui/PageContainer";
import { ConfirmEmailLinkView } from "@/components/auth/ConfirmEmailLinkView";

export const metadata: Metadata = {
  title: "メールのリンクを確認 | eFootball Team AI",
  description: "認証メールのリンクを確認します。",
  // トークン付きの URL を Referer で外部へ渡さない。
  referrer: "no-referrer",
};

export default function ConfirmEmailLinkPage() {
  return (
    <PageContainer width="regular">
      <ConfirmEmailLinkView />
    </PageContainer>
  );
}
