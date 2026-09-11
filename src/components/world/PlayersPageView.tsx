"use client";

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

export function PlayersPageView({
  result,
  facets,
  sourceMeta,
  hasFilters,
  searchParams,
}: {
  result: Omit<WorldListResult, "players"> & { players: WorldPlayerCardData[] };
  facets: WorldFacets;
  sourceMeta: WorldSourceMeta | null;
  hasFilters: boolean;
  searchParams: SP;
}) {
  const t = useT();
  const { locale } = useLocale();
  const fmt = (n: number) => formatNumber(n, locale);
  const from = result.totalCount === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.totalCount);
  const importedAt = sourceMeta
    ? `${t("playersPage", "importedAtPrefix")}${sourceMeta.syncFinishedAt ? formatDateTime(new Date(sourceMeta.syncFinishedAt), locale) : "—"}`
    : "";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("playersPage", "title")}
        icon="players"
        meta={t("playersPage", "metaTemplate").replace("{count}", fmt(result.totalCount))}
        description={t("playersPage", "descriptionTemplate").replace("{importedAt}", importedAt)}
        actions={
          <Link href="/compare" className={buttonClasses("secondary", "sm")}>
            {t("playersPage", "compareLink")}
          </Link>
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
            {result.players.map((p) => (
              <li key={p.worldCardId}>
                <WorldPlayerCard player={p} />
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
