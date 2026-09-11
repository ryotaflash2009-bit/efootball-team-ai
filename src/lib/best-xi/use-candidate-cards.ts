"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toProgressionCard } from "@/lib/progression/from-world";
import type { ProgressionCard } from "@/lib/progression/types";
import type { WorldPlayerDetail } from "@/lib/world/types";

const WORLD_ID_RE = /^[0-9]{1,20}$/;

/**
 * AIベスト11の候補構築に必要な26能力値つきカード詳細(WorldPlayerDetail)を、
 * My Team の worldCardId 一覧ぶんだけまとめて解決する。
 *
 * - `/api/world/players/{worldCardId}` を候補カードぶんだけ並行取得する
 *   (`/api/world/players/by-ids` は一覧用の要約のみで26能力値を含まないため使えない)。
 * - 解決済みは Map にキャッシュし、IDが増えた分だけ追加取得する。
 * - localStorage・SQLite・外部APIへは一切書き込まない。読み取り専用。
 * - 取得に失敗したIDは静かにスキップする(呼び出し側が候補不可として扱う)。
 * - `loading` は「取得試行済みID集合(attemptedRef)」と対象ID集合の差分から毎レンダー同期的に
 *   導出する。初回マウント直後(useEffectがまだ1度も走っていない瞬間)にfalseへ誤って倒れると、
 *   呼び出し側が「取得完了」と誤判定して空の候補で選考を確定してしまうため、
 *   useState の既定値だけに頼らず、常に実際の未処理ID有無から計算する。
 */
export function useBestXiProgressionCards(worldCardIds: string[]): {
  cards: Map<string, ProgressionCard>;
  loading: boolean;
  error: string | null;
} {
  const [cards, setCards] = useState<Map<string, ProgressionCard>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef<Set<string>>(new Set());
  // attemptedRefの更新(ref)だけではレンダーが誘発されないため、取得完了ごとに1つインクリメントして
  // このフックの呼び出し側を確実に再レンダーさせる。
  const [attemptedVersion, setAttemptedVersion] = useState(0);

  const key = useMemo(() => [...new Set(worldCardIds)].sort().join(","), [worldCardIds]);
  const validIds = useMemo(() => [...new Set(worldCardIds)].filter((id) => WORLD_ID_RE.test(id)), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = useMemo(
    () => validIds.some((id) => !attemptedRef.current.has(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validIds, attemptedVersion],
  );

  useEffect(() => {
    const missing = validIds.filter((id) => !attemptedRef.current.has(id));
    if (missing.length === 0) return;

    let cancelled = false;
    setError(null);

    Promise.all(
      missing.map(async (id) => {
        try {
          const res = await fetch(`/api/world/players/${encodeURIComponent(id)}`);
          if (!res.ok) return null;
          const body: { player?: WorldPlayerDetail } = await res.json();
          if (!body.player) return null;
          return { id, card: toProgressionCard(body.player) };
        } catch {
          return null;
        }
      }),
    )
      .then((results) => {
        if (cancelled) return;
        for (const id of missing) attemptedRef.current.add(id);
        setCards((prev) => {
          const next = new Map(prev);
          for (const r of results) {
            if (r) next.set(r.id, r.card);
          }
          return next;
        });
        setAttemptedVersion((v) => v + 1);
      })
      .catch(() => {
        if (!cancelled) {
          for (const id of missing) attemptedRef.current.add(id);
          setAttemptedVersion((v) => v + 1);
          setError("選手データを読み込めませんでした。時間をおいて再読み込みしてください。");
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { cards, loading, error };
}
