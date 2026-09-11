"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorldPlayerListItem } from "@/lib/world/types";

/**
 * お気に入り / My Team の worldCardId 一覧から、カード要約をまとめて解決する。
 *  - `/api/world/players/by-ids` を 1 回叩く（全 13,009 カードは走査しない）。
 *  - 解決済みは Map にキャッシュし、ID が増えた分だけ追加取得する。
 *  - localStorage 障害・API エラーでも画面を壊さない（error を返すだけ）。
 */
export function useResolvedCards(worldCardIds: string[]): {
  cards: Map<string, WorldPlayerListItem>;
  loading: boolean;
  error: string | null;
} {
  const [cards, setCards] = useState<Map<string, WorldPlayerListItem>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());

  const key = useMemo(() => [...new Set(worldCardIds)].sort().join(","), [worldCardIds]);

  useEffect(() => {
    const ids = [...new Set(worldCardIds)].filter((id) => /^[0-9]{1,20}$/.test(id));
    const missing = ids.filter((id) => !fetchedRef.current.has(id));
    if (missing.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/world/players/by-ids?ids=${missing.join(",")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: { players?: WorldPlayerListItem[] }) => {
        if (cancelled) return;
        for (const id of missing) fetchedRef.current.add(id);
        setCards((prev) => {
          const next = new Map(prev);
          for (const p of body.players ?? []) next.set(p.worldCardId, p);
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setError("カード情報を読み込めませんでした。時間をおいて再読み込みしてください。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // key で再取得（ID 集合が変わったときだけ）
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { cards, loading, error };
}
