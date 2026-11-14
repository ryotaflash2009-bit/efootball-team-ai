"use client";

import { useEffect, useState } from "react";
import { isLocalDevHostname } from "@/lib/supabase/local-dev";
import {
  buildSourceRatingsIndex,
  countSameNameOvrCards,
  SOURCE_RATINGS_API,
  sourceRatingsFileSchema,
  type SourceCardRef,
  type SourceRatingsIndex,
} from "@/lib/dev/source-ratings";

export type SourceRatingsState =
  | { kind: "loading" }
  | { kind: "off" }
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "ok"; index: SourceRatingsIndex };

/** 一覧の各カードが同じファイルを何度も読まないよう、ページの中で 1 回だけ読む。 */
let pending: Promise<SourceRatingsState> | null = null;

function load(): Promise<SourceRatingsState> {
  // localhost 以外（LAN の IP など）から開いたときは読みに行かない
  if (!isLocalDevHostname(window.location.hostname)) return Promise.resolve({ kind: "off" });
  pending ??= fetch(SOURCE_RATINGS_API, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { ok?: boolean; error?: string; file?: unknown } | null): SourceRatingsState => {
      if (!j) return { kind: "off" };
      if (!j.ok) return { kind: j.error === "missing" ? "missing" : "invalid" };
      const parsed = sourceRatingsFileSchema.safeParse(j.file);
      return parsed.success ? { kind: "ok", index: buildSourceRatingsIndex(parsed.data) } : { kind: "invalid" };
    })
    .catch((): SourceRatingsState => {
      pending = null; // 開発サーバーの再起動中などは、次の画面で読み直す
      return { kind: "off" };
    });
  return pending;
}

const sameNameOvrCounts = new Map<string, Promise<number | null>>();

/**
 * 同名・同総合値の World カードの枚数（このカードを含む）を、選手一覧の API で数える（SamePlayerOtherCards と同じ探し方）。
 * 1 なら「名前・総合値で一致」をこのカードのものと確定できる。数えられなければ null（確定しない）。
 */
function loadSameNameOvrCount(card: SourceCardRef): Promise<number | null> {
  const name = (card.nameEn ?? card.nameJa ?? "").trim();
  if (!name || card.ovrMax == null) return Promise.resolve(null);
  const key = `${name}\u0000${card.ovrMax}`;
  let p = sameNameOvrCounts.get(key);
  if (!p) {
    p = (async () => {
      const found: { nameJa?: string | null; nameEn?: string | null; ovrMax?: number | null }[] = [];
      for (let page = 1; page <= 3; page++) {
        const res = await fetch(`/api/world/players?q=${encodeURIComponent(name)}&pageSize=100&page=${page}`);
        if (!res.ok) return null;
        const json = (await res.json()) as { players?: typeof found; hasNext?: boolean };
        found.push(...(json.players ?? []));
        if (!json.hasNext) break;
      }
      return countSameNameOvrCards(found, card);
    })().catch(() => null);
    sameNameOvrCounts.set(key, p);
  }
  return p;
}

/** 詳細ページ用: 同名・同総合値のカードの枚数。`enabled` が false のあいだは数えない（一覧では使わない）。 */
export function useSameNameOvrCount(card: SourceCardRef, enabled: boolean): number | null | "loading" {
  const [count, setCount] = useState<number | null | "loading">("loading");
  const { worldCardId, nameJa, nameEn, registeredPosition, ovrMax } = card;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setCount("loading");
    loadSameNameOvrCount({ worldCardId, nameJa, nameEn, registeredPosition, ovrMax }).then((n) => {
      if (alive) setCount(n);
    });
    return () => {
      alive = false;
    };
  }, [enabled, worldCardId, nameJa, nameEn, registeredPosition, ovrMax]);
  return count;
}

/** 開発用: 外部ソースの受け渡しファイル（呼び出し側が `next dev` のときだけ置く）。 */
export function useSourceRatings(): SourceRatingsState {
  const [state, setState] = useState<SourceRatingsState>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    load().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
