import type { Metadata } from "next";
import { PageContainer } from "@/components/ui/PageContainer";
import { ConfirmEmailLinkView } from "@/components/auth/ConfirmEmailLinkView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata: Metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "メールのリンクを確認 | TeamAIXI",
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
