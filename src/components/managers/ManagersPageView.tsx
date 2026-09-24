"use client";

import { Suspense } from "react";
import Link from "next/link";
import type { ManagerListItem } from "@/lib/managers/types";
import { ManagerControls } from "@/components/managers/ManagerControls";
import { ManagerCard } from "@/components/managers/ManagerCard";
import { TacticsLegend } from "@/components/managers/ProficiencyBar";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";

export function ManagersUnavailableView() {
  const t = useT();
  const mp = (k: keyof Dictionary["managersPage"]) => t("managersPage", k);
  return (
    <PageContainer>
      <PageHeader title={t("nav", "managers")} icon="managers" />
      <div className="mt-6">
        <EmptyState icon="database" title={mp("dataUnavailableTitle")} description={mp("dataUnavailableDescription")} />
      </div>
    </PageContainer>
  );
}

export function ManagersFailedView() {
  const t = useT();
  const mp = (k: keyof Dictionary["managersPage"]) => t("managersPage", k);
  return (
    <PageContainer>
      <PageHeader title={t("nav", "managers")} icon="managers" />
      <div className="mt-6">
        <EmptyState variant="error" icon="warning" title={mp("failedTitle")} description={mp("failedDescription")} />
      </div>
    </PageContainer>
  );
}

/** 検索語が拒否された(制御文字等、または上流の防御による拒否)ときの安全な表示。内部情報は出さない。 */
export function ManagersSearchRejectedView() {
  const t = useT();
  return (
    <PageContainer>
      <PageHeader title={t("nav", "managers")} icon="managers" />
      <div className="mt-6">
        <EmptyState
          variant="no-results"
          icon="search"
          title={t("searchInput", "rejectedTitle")}
          description={t("searchInput", "rejectedDescription")}
          action={
            <Link href="/managers" className={buttonClasses("secondary", "sm")}>
              {t("searchInput", "clearSearch")}
            </Link>
          }
        />
      </div>
    </PageContainer>
  );
}

export interface ManagersPageResult {
  managers: ManagerListItem[];
  totalCount: number;
  source: string;
  page: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function ManagersPageView({
  result,
  hasFilters,
  prevHref,
  nextHref,
  from,
  to,
  importedAt = null,
}: {
  result: ManagersPageResult;
  hasFilters: boolean;
  prevHref: string;
  nextHref: string;
  from: number;
  to: number;
  /** 監督データの時点(fetched_atの最新値、ISO)。不明ならnull。 */
  importedAt?: string | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const mp = (k: keyof Dictionary["managersPage"]) => t("managersPage", k);
  const fillMp = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);
  const showingCount = fillMp(mp("showingCountTemplate"), {
    total: formatNumber(result.totalCount, locale),
    from: formatNumber(from, locale),
    to: formatNumber(to, locale),
  });

  return (
    <PageContainer>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={t("nav", "managers")}
          icon="managers"
          meta={fillMp(mp("metaTemplate"), { count: formatNumber(result.totalCount, locale) })}
          description={`${fillMp(mp("descriptionTemplate"), { source: result.source })} ${mp("importedAtPrefix")}${importedAt ? formatDateTime(new Date(importedAt), locale) : "—"}`}
        />

        <Suspense fallback={<Skeleton className="h-11 w-full" />}>
          <ManagerControls />
        </Suspense>

        <TacticsLegend />

        {result.managers.length === 0 ? (
          <EmptyState
            variant="no-results"
            title={mp("noResultsTitle")}
            description={mp("noResultsDescription")}
            action={
              hasFilters ? (
                <Link href="/managers" className={buttonClasses("primary", "sm")}>
                  {mp("clearFiltersLink")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="text-xs text-text-dim">{showingCount}</p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {result.managers.map((m) => (
                <li key={m.internalManagerId}>
                  <ManagerCard manager={m} />
                </li>
              ))}
            </ul>

            <nav className="flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label={mp("paginationAriaLabel")}>
              <p className="text-xs text-text-dim">{showingCount}</p>
              <div className="flex items-center gap-2">
                {result.hasPrevious ? (
                  <Link href={prevHref} className={buttonClasses("secondary", "sm")}>
                    <Icon name="arrow-left" size={14} /> {mp("prevPageLink")}
                  </Link>
                ) : (
                  <span className={`${buttonClasses("secondary", "sm")} pointer-events-none opacity-40`}>
                    <Icon name="arrow-left" size={14} /> {mp("prevPageLink")}
                  </span>
                )}
                <span className="px-1 text-sm tabular-nums text-text-dim">
                  {fillMp(mp("pageOfTemplate"), { page: String(result.page), totalPages: String(result.totalPages) })}
                </span>
                {result.hasNext ? (
                  <Link href={nextHref} className={buttonClasses("secondary", "sm")}>
                    {mp("nextPageLink")} <Icon name="arrow-right" size={14} />
                  </Link>
                ) : (
                  <span className={`${buttonClasses("secondary", "sm")} pointer-events-none opacity-40`}>
                    {mp("nextPageLink")} <Icon name="arrow-right" size={14} />
                  </span>
                )}
              </div>
            </nav>
          </>
        )}
      </div>
    </PageContainer>
  );
}
