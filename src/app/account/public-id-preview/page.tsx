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
 * F-124: 参照データの自動更新が完成するまで、コミュニティ機能は一般に出さない。
 */
export default function PublicIdPreviewPage() {
  if (!areInternalPagesVisible()) notFound();
  return (
    <PageContainer>
      <PublicIdPreview />
    </PageContainer>
  );
}
