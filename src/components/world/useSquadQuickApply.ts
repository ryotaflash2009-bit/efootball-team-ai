"use client";

import { useState } from "react";
import { getSquad, saveSquad } from "@/lib/squad/squad-storage";
import { placeCardInSlot } from "@/lib/squad/place-card";
import type { StoredSquad } from "@/lib/squad/types";

export interface SquadQuickApplied {
  squadId: string;
  squadName: string;
}

/**
 * スカッドの編集を開かずに、カードを枠に置いて保存する（選手の詳細・My Team・パック診断の「入れ替える」・2026-10-31）。
 * 直前のスカッドを覚えておき、「元に戻す」で保存し直す。version は保存データを読み直すための数（入れた・戻した後に増える）。
 */
export function useSquadQuickApply() {
  const [version, setVersion] = useState(0);
  const [applied, setApplied] = useState<SquadQuickApplied | null>(null);
  const [previous, setPrevious] = useState<StoredSquad | null>(null);
  const apply = (squadId: string, slotId: string, worldCardId: string) => {
    const sq = getSquad(squadId);
    if (!sq) return;
    const r = placeCardInSlot(sq, slotId, worldCardId);
    if (!r.ok || !saveSquad(r.squad).ok) return;
    setPrevious(sq);
    setApplied({ squadId, squadName: sq.squadName });
    setVersion((v) => v + 1);
  };
  const undo = () => {
    if (!previous || !saveSquad(previous).ok) return;
    setPrevious(null);
    setApplied(null);
    setVersion((v) => v + 1);
  };
  return { version, applied, apply, undo };
}
