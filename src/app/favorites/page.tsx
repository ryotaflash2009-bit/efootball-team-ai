import { PageContainer } from "@/components/ui/PageContainer";
import { FavoritesView } from "@/components/user-cards/FavoritesView";

export const dynamic = "force-static";

export const metadata = {
  title: "お気に入り | TeamAIXI",
};

export default function FavoritesPage() {
  return (
    <PageContainer>
      <FavoritesView />
    </PageContainer>
  );
}
