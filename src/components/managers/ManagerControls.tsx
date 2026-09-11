"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ManagerSortKey } from "@/lib/managers/types";
import { useT } from "@/lib/i18n/LocaleContext";

function useSortOptions(): { value: ManagerSortKey; label: string }[] {
  const t = useT();
  return [
    { value: "name", label: t("managerControls", "sortNameLabel") },
    { value: "released_desc", label: t("managerControls", "sortReleasedDesc") },
    { value: "released_asc", label: t("managerControls", "sortReleasedAsc") },
    { value: "possession_desc", label: t("managerControls", "sortPossessionDesc") },
    { value: "quick_counter_desc", label: t("managerControls", "sortQuickCounterDesc") },
  ];
}

/** 監督一覧の検索・並べ替え・フィルタ。URL クエリ駆動・300ms デバウンス。 */
export function ManagerControls() {
  const router = useRouter();
  const t = useT();
  const sortOptions = useSortOptions();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qFromUrl = params.get("q") ?? "";
  const paramString = params.toString();

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function push(next: Record<string, string | null>) {
    const sp = new URLSearchParams(paramString);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("page");
    const s = sp.toString();
    router.push(s ? `/managers?${s}` : "/managers");
  }

  function onQuery(v: string) {
    setQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ q: v.trim() || null }), 300);
  }

  const select = "rounded-md border border-border bg-surface px-2 py-2 text-sm text-text focus:border-accent";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={q}
          maxLength={80}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("managerControls", "searchPlaceholder")}
          aria-label={t("managerControls", "searchAriaLabel")}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim/70 focus:border-accent"
        />
        <select
          value={(params.get("sort") as ManagerSortKey) ?? "name"}
          onChange={(e) => push({ sort: e.target.value })}
          aria-label={t("managerControls", "sortAriaLabel")}
          className={`${select} shrink-0`}
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={params.get("hasBooster") ?? ""}
          onChange={(e) => push({ hasBooster: e.target.value || null })}
          aria-label={t("managerControls", "boosterFilterAriaLabel")}
          className={select}
        >
          <option value="">{t("managerControls", "boosterFilterAllOption")}</option>
          <option value="1">{t("managerControls", "boosterFilterHasOption")}</option>
          <option value="0">{t("managerControls", "boosterFilterNoneOption")}</option>
        </select>
        <select
          value={params.get("hasLinkUpPlay") ?? ""}
          onChange={(e) => push({ hasLinkUpPlay: e.target.value || null })}
          aria-label={t("managerControls", "linkUpFilterAriaLabel")}
          className={select}
        >
          <option value="">{t("managerControls", "linkUpFilterAllOption")}</option>
          <option value="1">{t("managerControls", "linkUpFilterHasOption")}</option>
          <option value="0">{t("managerControls", "linkUpFilterNoneOption")}</option>
        </select>
      </div>
    </div>
  );
}
