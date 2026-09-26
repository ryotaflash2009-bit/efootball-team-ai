import { PageContainer } from "@/components/ui/PageContainer";
import { SharedDiagnosisView } from "@/components/squad/SharedDiagnosisView";

// 共有データはURLのfragment(#以降)だけにあり、サーバーへは届かない。ページ自体は静的で、読み取り専用。
export const dynamic = "force-static";

export const metadata = {
  title: "共有されたスカッド診断 | eFootball Team AI",
  description: "共有されたスカッド診断の要約（読み取り専用）です。",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer" as const,
};

export default function SharedDiagnosisPage() {
  return (
    <PageContainer width="regular">
      <SharedDiagnosisView />
    </PageContainer>
  );
}
