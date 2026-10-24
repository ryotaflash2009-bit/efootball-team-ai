import { permanentRedirect } from "next/navigation";
import { POSITION_ORDER } from "@/lib/tier/own-tier";

// /tier と /tier?position=XX は /tier/XX へ（2026-10-24: ポジションごとのページに分けた。古いリンク・ブックマークもそのまま使える）
export const runtime = "nodejs";

type SP = Record<string, string | string[] | undefined>;
const DEFAULT_POSITION = "CF";

export default async function TierPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const requested = typeof sp.position === "string" ? sp.position.toUpperCase() : DEFAULT_POSITION;
  permanentRedirect(`/tier/${POSITION_ORDER.includes(requested) ? requested : DEFAULT_POSITION}`);
}
