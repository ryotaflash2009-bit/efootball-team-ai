import { PageContainer } from "@/components/ui/PageContainer";
import { MyBuildsView } from "@/components/progression/MyBuildsView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const dynamic = "force-static";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "My Builds | TeamAIXI",
};

export default function MyBuildsPage() {
  return (
    <PageContainer>
      <MyBuildsView />
    </PageContainer>
  );
}
