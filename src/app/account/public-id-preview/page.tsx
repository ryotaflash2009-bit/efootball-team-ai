import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { PublicIdPreview } from "@/components/profile/PublicIdPreview";
import { areInternalPagesVisible } from "@/lib/public-info/internal-pages";

export const metadata: Metadata = {
  title: "Public ID (prototype)",
  robots: { index: false, follow: false },
};

/**
 * F-053 公開 ID の試作（内部ページ）。Production では表示しない（middleware と、ここでの notFound の二重）。
 * F-124 は 2026-10-03 に招待制の少人数ベータとして解除されたが、コミュニティ機能の公開は引き続き禁止（本人の判断）。
 */
export default function PublicIdPreviewPage() {
  if (!areInternalPagesVisible()) notFound();
  return (
    <PageContainer>
      <PublicIdPreview />
    </PageContainer>
  );
}
