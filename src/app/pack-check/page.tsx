import { Suspense } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { PackCheckView } from "@/components/pack-check/PackCheckView";

// パック診断（F-092 の自前の版・2026-10-17）。パックの中身は利用者が選ぶ。比較はブラウザーの中だけ（My Team は端末の保存）。
export const metadata = pageMetadata({
  path: "/pack-check",
  title: "パック診断 | TeamAIXI",
  description: "イーフト（eFootball™）のパックのカードを選ぶと、あなたの My Team の同じポジションの最高のカードと OVR を比べ、強化になるカードを数えます。",
});

export default function PackCheckPage() {
  return (
    <PageContainer>
      <Suspense fallback={null}>
        <PackCheckView />
      </Suspense>
    </PageContainer>
  );
}
