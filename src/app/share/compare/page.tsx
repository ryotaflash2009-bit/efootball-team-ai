import { PageContainer } from "@/components/ui/PageContainer";
import { SharedCompareView } from "@/components/squad/SharedCompareView";

// 共有データはURLのfragment(#以降)だけにあり、サーバーへは届かない。ページ自体は静的で、読み取り専用。
export const dynamic = "force-static";

export const metadata = {
  title: "共有された改善前後の比較 | eFootball Team AI",
  description: "共有されたスカッド診断の改善前後の比較（読み取り専用）です。",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer" as const,
};

export default function SharedComparePage() {
  return (
    <PageContainer width="regular">
      <SharedCompareView />
    </PageContainer>
  );
}
