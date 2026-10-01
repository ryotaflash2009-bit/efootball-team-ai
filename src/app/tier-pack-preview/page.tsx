import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { TierPackPreview } from "@/components/tier-pack/TierPackPreview";
import { areInternalPagesVisible } from "@/lib/public-info/internal-pages";

export const metadata: Metadata = {
  title: "Tier lists and packs (prototype)",
  robots: { index: false, follow: false },
};

/** F-090/F-092 の表示の試作（内部ページ・合成データだけ）。Production では表示しない（middleware と notFound の二重）。 */
export default function TierPackPreviewPage() {
  if (!areInternalPagesVisible()) notFound();
  return (
    <PageContainer>
      <TierPackPreview />
    </PageContainer>
  );
}
