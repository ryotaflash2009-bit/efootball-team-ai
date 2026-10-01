import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { LocalPostsView } from "@/components/posts/LocalPostsView";
import { areInternalPagesVisible } from "@/lib/public-info/internal-pages";

export const metadata: Metadata = {
  title: "Local photo posts (prototype)",
  robots: { index: false, follow: false },
};

/**
 * F-084 写真付き投稿のローカル試作（内部ページ）。Production では表示しない（middleware と、ここでの notFound の二重）。
 * F-124: 参照データの自動更新が完成するまで、コミュニティ機能は一般に出さない。
 */
export default function LocalPostsPage() {
  if (!areInternalPagesVisible()) notFound();
  return (
    <PageContainer>
      <LocalPostsView />
    </PageContainer>
  );
}
