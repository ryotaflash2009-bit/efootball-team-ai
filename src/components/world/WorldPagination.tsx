"use client";

import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { formatNumber } from "@/lib/i18n/format";

/**
 * サーバー側ページネーション。前へ / 次へ / 現在ページ / 総ページ / 表示範囲。
 * href は現在のクエリを引き継いで page だけ差し替える。
 */
export function WorldPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  searchParams,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const fmt = (n: number) => formatNumber(n, locale);
  const hrefFor = (p: number): string => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string" && v !== "" && k !== "page") sp.set(k, v);
    }
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/players?${s}` : "/players";
  };

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const btn =
    "rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors";
  const enabled = "bg-surface text-text hover:border-accent";
  const disabled = "cursor-not-allowed bg-surface-2 text-text-dim/50";

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
      aria-label={t("worldPagination", "ariaLabel")}
    >
      <p className="text-xs text-text-dim">
        {t("worldPagination", "rangeTemplate")
          .replace("{total}", fmt(totalCount))
          .replace("{from}", fmt(from))
          .replace("{to}", fmt(to))}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={`${btn} ${enabled}`} rel="prev">
            {t("worldPagination", "prevLabel")}
          </Link>
        ) : (
          <span className={`${btn} ${disabled}`} aria-disabled="true">
            {t("worldPagination", "prevLabel")}
          </span>
        )}
        <span className="px-1 text-sm tabular-nums text-text-dim">
          {t("worldPagination", "pageOfTemplate").replace("{page}", fmt(page)).replace("{totalPages}", fmt(totalPages))}
        </span>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={`${btn} ${enabled}`} rel="next">
            {t("worldPagination", "nextLabel")}
          </Link>
        ) : (
          <span className={`${btn} ${disabled}`} aria-disabled="true">
            {t("worldPagination", "nextLabel")}
          </span>
        )}
      </div>
    </nav>
  );
}
