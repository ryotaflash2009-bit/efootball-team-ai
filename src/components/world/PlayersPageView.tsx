"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { ProvisionalCardsLink } from "@/components/world/ProvisionalCardsLink";
import "@/lib/i18n/dictionaries/ja-ns/playersPage";
import "@/lib/i18n/dictionaries/ja-ns/searchInput";
import { Suspense } from "react";
import Link from "next/link";
import type { WorldFacets, WorldListResult, WorldSourceMeta } from "@/lib/world/types";
import { WorldPlayerCard, type WorldPlayerCardData } from "@/components/world/WorldPlayerCard";
import { WorldFilters } from "@/components/world/WorldFilters";
import { WorldPagination } from "@/components/world/WorldPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { buttonClasses } from "@/components/ui/Button";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";

type SP = Record<string, string | string[] | undefined>;

export function PlayersPageUnavailable() {
  const t = useT();
  return (
    <div className="mt-6">
      <PageHeader title={t("playersPage", "title")} icon="players" />
      <div className="mt-6">
        <EmptyState icon="database" title={t("playersPage", "noDataTitle")} description={t("playersPage", "noDataDescription")} />
      </div>
    </div>
  );
}

export function PlayersPageFailed() {
  const t = useT();
  return (
    <div className="mt-6">
      <PageHeader title={t("playersPage", "title")} icon="players" />
      <div className="mt-6">
        <EmptyState variant="error" icon="warning" title={t("playersPage", "loadErrorTitle")} description={t("playersPage", "loadErrorDescription")} />
      </div>
    </div>
  );
}

/** 検索語が拒否された(制御文字等、または上流の防御による拒否)ときの安全な表示。内部情報は出さない。 */
export function PlayersPageSearchRejected() {
  const t = useT();
  return (
    <div className="mt-6">
      <PageHeader title={t("playersPage", "title")} icon="players" />
      <div className="mt-6">
        <EmptyState
          variant="no-results"
          icon="search"
          title={t("searchInput", "rejectedTitle")}
          description={t("searchInput", "rejectedDescription")}
          action={
            <Link href="/players" className={buttonClasses("secondary", "sm")}>
              {t("searchInput", "clearSearch")}
            </Link>
          }
        />
      </div>
    </div>
  );
}

export function PlayersPageView({
  result,
  facets,
  sourceMeta,
  hasFilters,
  searchParams,
  provisionalCount = 0,
  provisionalMatches = [],
}: {
  result: Omit<WorldListResult, "players"> & { players: WorldPlayerCardData[] };
  facets: WorldFacets;
  sourceMeta: WorldSourceMeta | null;
  hasFilters: boolean;
  searchParams: SP;
  /** 新しいカード（暫定）の枚数（2026-10-15）。 */
  provisionalCount?: number;
  /** 検索に合う暫定のカード（2026-10-24・World の取り込みが止まっている間も新しいカードを見つけられるように）。 */
  provisionalMatches?: WorldPlayerCardData[];
}) {
  const t = useT();
  const { locale, displayLocale } = useLocale();
  const fmt = (n: number) => formatNumber(n, displayLocale);
  const from = result.totalCount === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.totalCount);
  const importedAt = sourceMeta
    ? `${t("playersPage", "importedAtPrefix")}${sourceMeta.syncFinishedAt ? formatDateTime(new Date(sourceMeta.syncFinishedAt), displayLocale) : "—"}`
    : "";

  return (
    <div className="flex flex-col gap-5">
      <ProvisionalCardsLink count={provisionalCount} />
      {provisionalMatches.length > 0 ? (
        <section className="flex flex-col gap-2" data-testid="provisional-search-results">
          <h2 className="text-sm font-semibold">{t("provisionalCards", "searchHeadingTemplate").replace("{count}", String(provisionalMatches.length))}</h2>
          <p className="text-xs text-text-dim">{t("provisionalCards", "searchNote")}</p>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {provisionalMatches.map((p) => (
              <li key={p.worldCardId}>
                <WorldPlayerCard player={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <PageHeader
        title={t("playersPage", "title")}
        icon="players"
        meta={t("playersPage", "metaTemplate").replace("{count}", fmt(result.totalCount))}
        description={t("playersPage", "descriptionTemplate").replace("{importedAt}", importedAt)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/compare" className={buttonClasses("secondary", "sm")}>
              {t("playersPage", "compareLink")}
            </Link>
            <Link href="/boosters" className={buttonClasses("ghost", "sm")}>
              {t("playersPage", "boosterListLink")}
            </Link>
          </div>
        }
      />

      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <WorldFilters facets={facets} />
      </Suspense>

      {result.players.length === 0 ? (
        hasFilters ? (
          <EmptyState
            variant="no-results"
            title={t("playersPage", "noResultsTitle")}
            description={t("playersPage", "noResultsDescription")}
            action={
              <Link href="/players" className={buttonClasses("primary", "sm")}>
                {t("playersPage", "clearAllFiltersButton")}
              </Link>
            }
          />
        ) : (
          <EmptyState icon="database" title={t("playersPage", "noCardsTitle")} description={t("playersPage", "noCardsDescription")} />
        )
      ) : (
        <>
          <p className="text-xs text-text-dim">
            {t("playersPage", "showingRangeTemplate")
              .replace("{total}", fmt(result.totalCount))
              .replace("{from}", fmt(from))
              .replace("{to}", fmt(to))}
          </p>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {result.players.map((p, i) => (
              <li key={p.worldCardId}>
                {/* 最初の画面の数枚だけすぐに読み込む（残りは画面の近くに来てから。WorldCardImage） */}
                <WorldPlayerCard player={p} imagePriority={i < 4} />
              </li>
            ))}
          </ul>

          <WorldPagination
            page={result.page}
            totalPages={result.totalPages}
            totalCount={result.totalCount}
            pageSize={result.pageSize}
            searchParams={searchParams}
          />
        </>
      )}

      <p className="text-2xs text-text-muted">
        {t("playersPage", "dataSourcePrefix")}
        {sourceMeta?.source ?? t("playersPage", "defaultSourceName")} / {sourceMeta?.sourceUrl}
      </p>
    </div>
  );
}
