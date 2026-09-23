import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { areInternalPagesVisible } from "@/lib/public-info/internal-pages";
import { ReleaseReadinessView } from "@/components/public-info/ReleaseReadinessView";

// 表示可否をrequest時に判定し、非表示なら本物の404 statusを返す(静的生成だとstatus 200になるため)。
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!areInternalPagesVisible()) notFound();
  return {
    title: "公開準備状況 | eFootball Team AI",
    description: "eFootball Team AIの現在の提供段階と、公開前に必要な残作業をまとめたページです。",
    robots: { index: false, follow: false },
  };
}

export default function ReleaseReadinessPage() {
  // 内部向けの公開準備状況。Production build・Previewでは404にする(fail-closed)。
  if (!areInternalPagesVisible()) notFound();
  return (
    <PageContainer width="regular">
      <ReleaseReadinessView />
    </PageContainer>
  );
}
