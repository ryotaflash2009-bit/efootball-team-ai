"use client";

import { useMemo } from "react";
import type { StoredSquad } from "@/lib/squad/types";
import { getFormation } from "@/lib/squad/formations";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";
import { squadNewCardSuggestions } from "@/lib/new-cards/squad-suggestions";

/**
 * スカッドごとの「所持カードで強くできる枠」の数（2026-10-26・スカッドの一覧の印）。
 * 編集画面の欄（SquadOwnedUpgradesPanel）と同じ規則・同じ入力の作り方。読み込み中は空（数を出さない）。
 */
export function useOwnedUpgradeCounts(squads: readonly StoredSquad[] | null): Map<string, number> {
  const { owned } = useOwnedCards();
  const ids = useMemo(() => [...new Set((squads ?? []).flatMap((s) => s.slots.map((x) => x.worldCardId)).filter((x): x is string => !!x))], [squads]);
  const { cards, loading } = useResolvedCards(ids);
  return useMemo(() => {
    const out = new Map<string, number>();
    if (!squads || loading || owned.length === 0) return out;
    for (const sq of squads) {
      const posBySlot = new Map(getFormation(sq.formationId).slots.map((s) => [s.slotId, s.position]));
      const slots = sq.slots.flatMap((sl) => {
        const c = sl.worldCardId ? cards.get(sl.worldCardId) : null;
        if (sl.worldCardId && !c) return [];
        return [{ slotId: sl.slotId, position: posBySlot.get(sl.slotId) ?? "", current: c ?? null }];
      });
      const inSquad = new Set([...sq.slots.map((s) => s.worldCardId), ...sq.substitutes.map((s) => s.worldCardId)].filter((x): x is string => !!x));
      const n = squadNewCardSuggestions(slots, owned, inSquad).length;
      if (n > 0) out.set(sq.squadId, n);
    }
    return out;
  }, [squads, cards, loading, owned]);
}
