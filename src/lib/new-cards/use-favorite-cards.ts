"use client";

import { useMemo } from "react";
import { useFavorites } from "@/lib/user-cards/hooks";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import type { WorldPlayerListItem } from "@/lib/world/types";

/**
 * この端末のお気に入りのカード（読めたものだけ・2026-11-01）。exclude のカード（所持のカードなど）は除く。
 * スカッド・比較の選手検索で、入力の前に所持のカードの次に出す。
 */
export function useFavoriteCards(exclude: readonly string[] = []): WorldPlayerListItem[] {
  const { favorites } = useFavorites();
  const ids = useMemo(() => {
    const skip = new Set(exclude);
    return favorites.map((f) => f.worldCardId).filter((id) => !skip.has(id));
  }, [favorites, exclude]);
  const { cards } = useResolvedCards(ids);
  return useMemo(() => ids.map((id) => cards.get(id)).filter((c): c is WorldPlayerListItem => c != null), [ids, cards]);
}
