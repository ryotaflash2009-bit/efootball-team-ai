import { NextResponse } from "next/server";
import { NEW_CARD_DAYS, RECENT_LIMIT } from "@/lib/new-cards/constants";
import { cachedListRecentlyAddedPlayers } from "@/lib/reference-data/runtime/cached-queries";
import { listProvisionalPlayers } from "@/lib/world/repository";

export const runtime = "nodejs";

/**
 * 新しいカードの要約（2026-10-17）: 最近 7 日に追加された正式なカード＋暫定のカード。スカッドの提案などブラウザーの計算に使う。
 * 返すのは表示と比較に要る項目だけ（画像の URL は返さない）。
 */
export async function GET() {
  const recent = await cachedListRecentlyAddedPlayers(NEW_CARD_DAYS, RECENT_LIMIT).catch(() => []);
  const pick = (p: { worldCardId: string; nameJa: string | null; nameEn: string | null; registeredPosition: string | null; ovrBase: number | null; ovrMax: number | null; cardType: string | null; addedAt?: string | null; provisional?: { firstSeenAt: string | null } }, provisional: boolean) => ({
    worldCardId: p.worldCardId,
    nameJa: p.nameJa,
    nameEn: p.nameEn,
    registeredPosition: p.registeredPosition,
    ovrBase: p.ovrBase,
    ovrMax: p.ovrMax,
    cardType: p.cardType,
    provisional,
    // 追加された時刻（正式: World の created_at・暫定: 初めて見つけた時刻）。サイドメニューの「前回から追加」の件数に使う
    addedAt: provisional ? (p.provisional?.firstSeenAt ?? null) : (p.addedAt ?? null),
  });
  const cards = [...recent.map((p) => pick(p, false)), ...listProvisionalPlayers().map((p) => pick(p, true))];
  const res = NextResponse.json({ cards, days: NEW_CARD_DAYS });
  if (process.env.NODE_ENV === "production") res.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
  return res;
}
