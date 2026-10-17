"use client";

import { useMemo } from "react";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import type { WorldPlayerListItem } from "@/lib/world/types";

/**
 * この端末の My Team で「所持」のカード（削除済みは除く）と、その要約（2026-10-18・4 つの画面で共通）。
 * 新しいカードとの比較・パック診断・選手の詳細の比較・トップの件数で同じ規則を使う。
 */
export function useOwnedCards(): { ownedIds: string[]; owned: WorldPlayerListItem[]; scopeStatus: ReturnType<typeof useMyTeam>["scopeStatus"] } {
  const { myTeam, scopeStatus } = useMyTeam();
  const ownedIds = useMemo(() => myTeam.filter((r) => r.ownershipStatus === "owned" && !r.deletedAt).map((r) => r.worldCardId), [myTeam]);
  const { cards } = useResolvedCards(ownedIds);
  const owned = useMemo(() => ownedIds.map((id) => cards.get(id)).filter((c): c is WorldPlayerListItem => c != null), [ownedIds, cards]);
  return { ownedIds, owned, scopeStatus };
}
