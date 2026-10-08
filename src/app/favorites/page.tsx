import { PageContainer } from "@/components/ui/PageContainer";
import { FavoritesView } from "@/components/user-cards/FavoritesView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const dynamic = "force-static";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "お気に入り | TeamAIXI",
};

export default function FavoritesPage() {
  return (
    <PageContainer>
      <FavoritesView />
    </PageContainer>
  );
}
