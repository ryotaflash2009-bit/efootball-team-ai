import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { areInternalPagesVisible } from "@/lib/public-info/internal-pages";
import { RlsTestView } from "@/components/auth/RlsTestView";

// 表示可否をrequest時に判定し、非表示なら本物の404 statusを返す(静的生成だとstatus 200になるため)。
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!areInternalPagesVisible()) notFound();
  return {
    title: "開発用RLS検証 | eFootball Team AI",
    description: "Supabase Row Level Securityによるユーザー別データ分離を確認する開発者向け技術検証ページ(PoC)。",
    robots: { index: false, follow: false },
  };
}

export default function RlsTestPage() {
  // 開発者向けPoC。Production build・Previewでは存在しないものとして404にする(fail-closed)。
  if (!areInternalPagesVisible()) notFound();
  return (
    <PageContainer width="regular">
      <RlsTestView />
    </PageContainer>
  );
}
