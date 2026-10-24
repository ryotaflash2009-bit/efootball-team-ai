import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { POSITION_ORDER } from "@/lib/tier/own-tier";
import { TierContent } from "../tier-content";

// ポジションごとの Tier（2026-10-24: /tier?position= から分けた。あらかじめ作っておき、5 分ごとに作り直す＝初回の表示が速い）
export const runtime = "nodejs";
export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return POSITION_ORDER.map((position) => ({ position }));
}

export async function generateMetadata({ params }: { params: Promise<{ position: string }> }) {
  const { position } = await params;
  return pageMetadata({
    path: `/tier/${position}`,
    title: `${position} の Tier（最大 OVR の上位） | TeamAIXI`,
    description: `イーフト（eFootball™）の ${position} の選手カードを、最大 OVR の順位から S・A・B・C に分けた一覧です（自前のデータから計算・ゲーム内の強さの評価ではありません）。`,
  });
}

export default async function TierPositionPage({ params }: { params: Promise<{ position: string }> }) {
  const { position } = await params;
  if (!POSITION_ORDER.includes(position)) notFound();
  return <TierContent position={position} />;
}
