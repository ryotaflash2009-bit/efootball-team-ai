"use client";

import { useEffect, useMemo, useState } from "react";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { listSquads } from "@/lib/squad/squad-storage";
import { getFormation } from "@/lib/squad/formations";
import type { StoredSquad } from "@/lib/squad/types";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import type { SquadFitInput } from "@/lib/new-cards/card-squad-fit";

/**
 * 保存スカッドを「1 枚のカードで強くなるか」の判定の入力にする（2026-10-26・選手の詳細とパック診断で共通）。
 * スカッドはブラウザーの中だけ（スコープの解決の後に読む・hydration の後）。読み込み中は null。
 * カードを読めていない枠は「空き」と誤って扱わないよう除く。version を変えると保存データを読み直す（その場で入れた後）。
 */
export function useSavedSquadFitInputs(version = 0): SquadFitInput[] | null {
  const scopeState = useSyncedStorageScope();
  const [squads, setSquads] = useState<StoredSquad[] | null>(null);
  useEffect(() => {
    if (scopeState.status === "loading") {
      setSquads(null);
      return;
    }
    setSquads(listSquads());
  }, [version, scopeState.status === "resolved" ? scopeState.scope.kind : "loading", scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope.scopeId : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = useMemo(() => [...new Set((squads ?? []).flatMap((s) => s.slots.map((x) => x.worldCardId)).filter((x): x is string => !!x))], [squads]);
  const { cards, loading } = useResolvedCards(ids);
  return useMemo(() => {
    if (!squads || loading) return null;
    return squads.map((sq) => {
      const posBySlot = new Map(getFormation(sq.formationId).slots.map((s) => [s.slotId, s.position]));
      return {
        squadId: sq.squadId,
        squadName: sq.squadName,
        slots: sq.slots.flatMap((sl) => {
          const c = sl.worldCardId ? cards.get(sl.worldCardId) : null;
          if (sl.worldCardId && !c) return [];
          return [{ slotId: sl.slotId, position: posBySlot.get(sl.slotId) ?? "", current: c ?? null }];
        }),
        inSquad: new Set([...sq.slots.map((s) => s.worldCardId), ...sq.substitutes.map((s) => s.worldCardId)].filter((x): x is string => !!x)),
      };
    });
  }, [squads, cards, loading]);
}
