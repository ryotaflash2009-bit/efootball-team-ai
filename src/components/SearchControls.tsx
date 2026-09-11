"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { SortKey } from "@/lib/types";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "ovr_desc", label: "OVR 高い順" },
  { value: "ovr_asc", label: "OVR 低い順" },
  { value: "name", label: "名前順（日本語）" },
];

/**
 * 検索キーワードと並べ替えの UI。
 * 変更内容は URL のクエリ（?q=&sort=）へ反映し、一覧（サーバー側）が読み直す。
 */
export function SearchControls() {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const sort = (params.get("sort") as SortKey) ?? "ovr_desc";

  // 戻る/進むでクエリが変わったら入力欄も追従
  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function pushQuery(next: { q?: string; sort?: string }) {
    const sp = new URLSearchParams(params.toString());
    if (next.q !== undefined) {
      if (next.q) sp.set("q", next.q);
      else sp.delete("q");
    }
    if (next.sort !== undefined) sp.set("sort", next.sort);
    const query = sp.toString();
    router.push(query ? `/players?${query}` : "/players");
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        pushQuery({ q: q.trim() });
      }}
    >
      <input
        type="search"
        inputMode="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="日本語名・英語名・選手ID で検索"
        aria-label="選手を検索"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim/70 focus:border-accent"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          検索
        </button>
        <select
          value={sort}
          onChange={(e) => pushQuery({ sort: e.target.value })}
          aria-label="並べ替え"
          className="shrink-0 rounded-md border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
