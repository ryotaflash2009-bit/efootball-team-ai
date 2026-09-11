"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WorldFacets, WorldSortKey } from "@/lib/world/types";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

function useSortOptions(): { value: WorldSortKey; label: string }[] {
  const t = useT();
  const key = (k: keyof Dictionary["worldFilters"]) => t("worldFilters", k);
  return [
    { value: "ovr_max_desc", label: key("sortOvrMaxDesc") },
    { value: "ovr_max_asc", label: key("sortOvrMaxAsc") },
    { value: "ovr_base_desc", label: key("sortOvrBaseDesc") },
    { value: "ovr_base_asc", label: key("sortOvrBaseAsc") },
    { value: "name", label: key("sortName") },
    { value: "updated_desc", label: key("sortUpdatedDesc") },
  ];
}

function useFilterLabels(): Record<string, string> {
  const t = useT();
  const key = (k: keyof Dictionary["worldFilters"]) => t("worldFilters", k);
  return {
    q: key("filterLabelQ"),
    position: key("filterLabelPosition"),
    cardType: key("filterLabelCardType"),
    playingStyle: key("filterLabelPlayingStyle"),
    playingStyleDef: key("filterLabelPlayingStyleDef"),
    minOvr: key("filterLabelMinOvr"),
    maxOvr: key("filterLabelMaxOvr"),
    hasBooster: key("filterLabelBooster"),
  };
}

/**
 * 検索・並べ替え・フィルタ。すべて URL クエリへ反映し、サーバー側の一覧が読み直す。
 * 検索入力は 300ms デバウンス。条件変更時は page=1 へ戻す。
 */
export function WorldFilters({ facets }: { facets: WorldFacets }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();
  const twf = (k: keyof Dictionary["worldFilters"]) => t("worldFilters", k);
  const SORT_OPTIONS = useSortOptions();
  const FILTER_LABELS = useFilterLabels();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qFromUrl = params.get("q") ?? "";

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  const paramString = params.toString();

  function push(next: Record<string, string | null>, opts: { resetPage?: boolean } = {}) {
    const sp = new URLSearchParams(paramString);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    if (opts.resetPage !== false) sp.delete("page");
    const query = sp.toString();
    router.push(query ? `/players?${query}` : "/players");
  }

  // 検索デバウンス
  function onQueryChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      push({ q: value.trim() || null });
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const sort = (params.get("sort") as WorldSortKey) ?? "ovr_max_desc";
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; value: string }[] = [];
    for (const key of ["q", "position", "cardType", "playingStyle", "playingStyleDef", "minOvr", "maxOvr", "hasBooster"]) {
      const v = params.get(key);
      if (v) chips.push({ key, label: FILTER_LABELS[key] ?? key, value: v });
    }
    return chips;
  }, [params, FILTER_LABELS]);

  const selectClass =
    "min-w-0 rounded-md border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent";

  return (
    <div className="flex flex-col gap-2">
      {/* 1行目: 検索 + 並べ替え + モバイル用フィルタトグル */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          inputMode="search"
          value={q}
          maxLength={100}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={twf("searchPlaceholder")}
          aria-label={twf("searchAriaLabel")}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim/70 focus:border-accent"
        />
        <div className="flex gap-2">
          <select
            value={sort}
            onChange={(e) => push({ sort: e.target.value })}
            aria-label={twf("sortAriaLabel")}
            className={`${selectClass} shrink-0`}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text lg:hidden"
          >
            {twf("filterToggleTemplate").replace(
              "{count}",
              activeChips.filter((c) => c.key !== "q").length ? ` (${activeChips.filter((c) => c.key !== "q").length})` : "",
            )}
          </button>
        </div>
      </div>

      {/* 2行目: フィルタ（PC は常時 / モバイルは折りたたみ） */}
      <div className={`${open ? "grid" : "hidden"} grid-cols-2 gap-2 sm:grid-cols-3 lg:grid lg:grid-cols-4 xl:grid-cols-6`}>
        <select
          value={params.get("position") ?? ""}
          onChange={(e) => push({ position: e.target.value || null })}
          aria-label={twf("positionAriaLabel")}
          className={selectClass}
        >
          <option value="">{twf("positionAll")}</option>
          {facets.positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={params.get("cardType") ?? ""}
          onChange={(e) => push({ cardType: e.target.value || null })}
          aria-label={twf("cardTypeAriaLabel")}
          className={selectClass}
        >
          <option value="">{twf("cardTypeAll")}</option>
          {facets.cardTypes.map((ct) => (
            <option key={ct} value={ct}>
              {ct}
            </option>
          ))}
        </select>

        <select
          value={params.get("playingStyle") ?? ""}
          onChange={(e) => push({ playingStyle: e.target.value || null })}
          aria-label={twf("playingStyleAriaLabel")}
          className={selectClass}
        >
          <option value="">{twf("playingStyleAll")}</option>
          {facets.playingStyles.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={params.get("playingStyleDef") ?? ""}
          onChange={(e) => push({ playingStyleDef: e.target.value || null })}
          aria-label={twf("playingStyleDefAriaLabel")}
          className={selectClass}
        >
          <option value="">{twf("playingStyleDefAll")}</option>
          {facets.playingStyleDefensives.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          max={120}
          inputMode="numeric"
          placeholder={twf("minOvrPlaceholder")}
          aria-label={twf("minOvrAriaLabel")}
          defaultValue={params.get("minOvr") ?? ""}
          onBlur={(e) => push({ minOvr: e.target.value || null })}
          onKeyDown={(e) => {
            if (e.key === "Enter") push({ minOvr: (e.target as HTMLInputElement).value || null });
          }}
          className={selectClass}
        />
        <input
          type="number"
          min={1}
          max={120}
          inputMode="numeric"
          placeholder={twf("maxOvrPlaceholder")}
          aria-label={twf("maxOvrAriaLabel")}
          defaultValue={params.get("maxOvr") ?? ""}
          onBlur={(e) => push({ maxOvr: e.target.value || null })}
          onKeyDown={(e) => {
            if (e.key === "Enter") push({ maxOvr: (e.target as HTMLInputElement).value || null });
          }}
          className={selectClass}
        />
      </div>

      {/* アクティブ条件チップ */}
      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => push({ [c.key]: null })}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-text hover:border-accent"
            >
              <span className="text-text-dim">{c.label}:</span>
              <span className="font-medium">{c.value}</span>
              <span aria-hidden className="text-text-dim">
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              push({
                q: null,
                position: null,
                cardType: null,
                playingStyle: null,
                playingStyleDef: null,
                minOvr: null,
                maxOvr: null,
                hasBooster: null,
              })
            }
            className="rounded-full px-2 py-0.5 text-xs text-accent hover:underline"
          >
            {twf("clearAllButton")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
