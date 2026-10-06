import { Suspense } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { ManagerCompareView } from "@/components/managers/ManagerCompareView";

export const metadata = {
  title: "監督の比較 | TeamAIXI",
  description: "2〜4 人の監督の戦術の適性・ブースター・フォーメーションを並べて比較します。",
};

// force-static にしない: 静的の生成では ?ids= が空になり、hydration が合わなくなる（React #418）。
// useSearchParams を Suspense の中で使い、比較の部分はブラウザで描く。
export default function ManagerComparePage() {
  return (
    <PageContainer>
      <Suspense fallback={null}>
        <ManagerCompareView />
      </Suspense>
    </PageContainer>
  );
}
