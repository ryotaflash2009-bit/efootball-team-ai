import { PageContainer } from "@/components/ui/PageContainer";
import { UserProfileView } from "@/components/community/UserProfileView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

// 利用者の公開プロフィール（2026-10-14）。中身はログインした人の権限でブラウザーから取得する（サーバーは何も読まない）。
// 検索には出さない（noindex）。題名に ID・表示名を入れない（共有の際のプレビューに出さない）。
export const metadata = {
  title: "プロフィール | TeamAIXI",
  description: "TeamAIXI の利用者のプロフィール（ログインが必要）。",
  robots: PRIVATE_PAGE_ROBOTS,
  referrer: "no-referrer" as const,
};

export default async function UserProfilePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  let id = "";
  try {
    id = decodeURIComponent(publicId);
  } catch {
    id = "";
  }
  return (
    <PageContainer width="regular">
      <UserProfileView publicId={id} />
    </PageContainer>
  );
}
