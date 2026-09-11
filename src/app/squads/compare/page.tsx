import { Suspense } from "react";
import { SquadCompareBoard } from "@/components/squad/SquadCompareBoard";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-static";

export const metadata = {
  title: "スカッド比較 | eFootball Team AI",
};

export default function SquadComparePage() {
  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="スカッド比較"
          icon="squad"
          description="保存済みの通常スカッドを 2 つ選び、フォーメーション・配置・先発 / ベンチ・監督・キャプテン・セットプレー・保存ビルド・ブースター・平均能力値・共通スキル・警告の違いを横並びで確認します。読み取り専用で、既存のスカッドは変更しません。比較対象は URL（?a=&b=）で復元されます。"
          backHref="/squads"
          backLabel="スカッド一覧へ"
        />
        <Suspense
          fallback={<p className="text-sm text-text-dim">読み込み中…</p>}
        >
          <SquadCompareBoard />
        </Suspense>
      </div>
    </PageContainer>
  );
}
