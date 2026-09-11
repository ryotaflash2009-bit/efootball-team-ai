import { PageContainer } from "@/components/ui/PageContainer";
import { MyBuildsView } from "@/components/progression/MyBuildsView";

export const dynamic = "force-static";

export const metadata = {
  title: "My Builds | eFootball Team AI",
};

export default function MyBuildsPage() {
  return (
    <PageContainer>
      <MyBuildsView />
    </PageContainer>
  );
}
