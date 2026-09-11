import { PageContainer } from "@/components/ui/PageContainer";
import { MyTeamView } from "@/components/user-cards/MyTeamView";

export const dynamic = "force-static";

export const metadata = {
  title: "My Team | eFootball Team AI",
};

export default function MyTeamPage() {
  return (
    <PageContainer>
      <MyTeamView />
    </PageContainer>
  );
}
