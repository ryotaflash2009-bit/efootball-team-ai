import { PageContainer } from "@/components/ui/PageContainer";
import { AccountDeletionView } from "@/components/auth/AccountDeletionView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "アカウントの削除 | TeamAIXI",
  description: "アカウントの削除の対象・削除されないもの・手順。",
};

export default function AccountDeletePage() {
  return (
    <PageContainer width="regular">
      <AccountDeletionView />
    </PageContainer>
  );
}
