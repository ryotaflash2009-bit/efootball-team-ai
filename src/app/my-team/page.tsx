import { PageContainer } from "@/components/ui/PageContainer";
import { MyTeamView } from "@/components/user-cards/MyTeamView";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/public-info/search-indexing";

export const dynamic = "force-static";

export const metadata = {
  robots: PRIVATE_PAGE_ROBOTS,
  title: "My Team | TeamAIXI",
};

export default function MyTeamPage() {
  return (
    <PageContainer>
      <MyTeamView />
    </PageContainer>
  );
}
