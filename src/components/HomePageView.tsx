"use client";

import Link from "next/link";
import { WorldCardImage } from "@/components/world/WorldCardImage";
import { PageContainer } from "@/components/ui/PageContainer";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";

export interface HomePageWorldSummary {
  totalCount: number;
  source: string;
  syncFinishedAt: string | null;
}

/**
 * ホーム画面のミニカード表示に必要な最小限のフィールドだけを持つ型。
 * `imageUrlCandidate` 等の生 CDN URL は含めない（Client Component への props は
 * サーバー側で解決済みの `imageSources`（同一オリジンのプロキシ経路）だけを渡し、
 * cloudfront 等の外部 URL をブラウザへ露出しない）。
 */
export interface HomeMiniCardData {
  worldCardId: string;
  nameJa: string | null;
  nameEn: string | null;
  ovrMax: number | null;
  ovrBase: number | null;
  registeredPosition: string | null;
  imageSources: string[];
}

function MiniCard({ p }: { p: HomeMiniCardData }) {
  const { locale } = useLocale();
  const t = useT();
  const fallback = t("squadBuildPanel", "cardFallbackNameTemplate").replace("{id}", p.worldCardId);
  const name = resolvePlayerDisplayName(p, locale, fallback);
  return (
    <Link
      href={`/players/world/${encodeURIComponent(p.worldCardId)}`}
      className="group w-[116px] shrink-0 overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-accent sm:w-[132px]"
    >
      <div className="relative">
        <WorldCardImage sources={p.imageSources} alt={name} size="card" />
        <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-sm font-black leading-none text-accent">
          {p.ovrMax ?? p.ovrBase ?? "–"}
        </span>
        {p.registeredPosition ? (
          <span className="absolute right-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-2xs font-bold text-text">
            {p.registeredPosition}
          </span>
        ) : null}
      </div>
      <p className="truncate px-2 py-1.5 text-xs font-semibold" title={name}>
        {name}
      </p>
    </Link>
  );
}

export function HomePageView({
  world,
  efhubTotal,
  managerCount,
  topOvr,
  recent,
}: {
  world: HomePageWorldSummary | null;
  efhubTotal: number | null;
  managerCount: number | null;
  topOvr: HomeMiniCardData[];
  recent: HomeMiniCardData[];
}) {
  const t = useT();
  const { locale } = useLocale();
  const th = (k: keyof Dictionary["homePage"]) => t("homePage", k);
  const fillH = (s: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((acc, [key, val]) => acc.replace(`{${key}}`, val), s);

  const worldCountText = world ? formatNumber(world.totalCount, locale) : "13,009";

  const stats = [
    { label: th("worldCardsLabel"), value: world ? formatNumber(world.totalCount, locale) : "—", icon: "database" as IconName, href: "/players" },
    { label: th("efhubIndexLabel"), value: efhubTotal != null ? formatNumber(efhubTotal, locale) : "—", icon: "list" as IconName, href: null },
    { label: th("managersLabel"), value: managerCount != null ? formatNumber(managerCount, locale) : "—", icon: "managers" as IconName, href: "/managers" },
    {
      label: th("syncedAtLabel"),
      value: world?.syncFinishedAt ? formatDateTime(new Date(world.syncFinishedAt), locale) : "—",
      icon: "refresh" as IconName,
      href: null,
    },
  ];

  const quickLinks: { href: string; label: string; icon: IconName; desc: string }[] = [
    { href: "/players", label: th("findPlayersLabel"), icon: "players", desc: fillH(th("findPlayersDescTemplate"), { count: worldCountText }) },
    { href: "/compare", label: th("comparePlayersLabel"), icon: "compare", desc: th("comparePlayersDesc") },
    { href: "/squads", label: th("buildSquadLabel"), icon: "squad", desc: th("buildSquadDesc") },
    {
      href: "/managers",
      label: th("exploreManagersLabel"),
      icon: "managers",
      desc: fillH(th("exploreManagersDescTemplate"), { count: managerCount != null ? formatNumber(managerCount, locale) : "—" }),
    },
  ];

  const developmentFeatures = [
    th("featureTierList"),
    th("featurePackDiagnosis"),
    th("featureAiCoach"),
    th("featureCommunity"),
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        {/* ヒーロー */}
        <section className="relative overflow-hidden rounded-lg border border-border-strong bg-surface p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <Badge tone="accent">
              <Icon name="sparkles" size={12} />
              {th("heroBadge")}
            </Badge>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {th("heroTitlePrefix")}
              <span className="text-accent">{th("heroTitleAccent")}</span>
              {th("heroTitleSuffix")}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-text-dim sm:text-base">
              {fillH(th("heroDescriptionTemplate"), { count: worldCountText })}
            </p>
            <form action="/players" className="mt-5 flex max-w-md items-center gap-2 rounded-md border border-border bg-surface-2 px-3 focus-within:border-accent">
              <Icon name="search" size={18} className="shrink-0 text-text-dim" />
              <input
                type="search"
                name="q"
                maxLength={100}
                placeholder={th("searchPlaceholder")}
                aria-label={th("searchAriaLabel")}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
              />
              <button type="submit" className={buttonClasses("primary", "sm")}>
                {th("searchButton")}
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/compare" className={buttonClasses("secondary", "md")}>
                <Icon name="compare" size={16} />
                {th("compareButton")}
              </Link>
              <Link href="/squads" className={buttonClasses("secondary", "md")}>
                <Icon name="squad" size={16} />
                {th("createSquadButton")}
              </Link>
            </div>
          </div>
        </section>

        {/* データ指標 */}
        <section>
          <SectionHeader title={th("dataStatusHeading")} as="h2" hint={world ? world.source : undefined} />
          {world ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map((s) => {
                const body = (
                  <Surface tone="raised" padding="sm" className="h-full" interactive={!!s.href}>
                    <div className="flex items-center gap-2 text-text-dim">
                      <Icon name={s.icon} size={15} />
                      <span className="text-xs">{s.label}</span>
                    </div>
                    <p className="mt-1.5 text-xl font-bold tabular-nums">{s.value}</p>
                  </Surface>
                );
                return s.href ? (
                  <Link key={s.label} href={s.href}>
                    {body}
                  </Link>
                ) : (
                  <div key={s.label}>{body}</div>
                );
              })}
            </div>
          ) : (
            <Surface tone="outline">
              <p className="text-sm font-semibold">{th("worldUnavailableTitle")}</p>
              <p className="mt-1 text-sm text-text-dim">
                {th("worldUnavailableCommandPrefix")}
                <code className="rounded bg-surface-2 px-1">node scripts/sync-world-players-initial.mjs</code>
                {th("worldUnavailableCommandSuffix")}
              </p>
            </Surface>
          )}
        </section>

        {/* 高OVRカード */}
        {topOvr.length > 0 ? (
          <section>
            <SectionHeader
              title={th("topOvrHeading")}
              as="h2"
              action={
                <Link href="/players?sort=ovr_max_desc" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  {th("viewAllLink")} <Icon name="arrow-right" size={13} />
                </Link>
              }
            />
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {topOvr.map((p) => (
                <MiniCard key={p.worldCardId} p={p} />
              ))}
            </div>
          </section>
        ) : null}

        {/* 最近更新 */}
        {recent.length > 0 ? (
          <section>
            <SectionHeader
              title={th("recentHeading")}
              as="h2"
              action={
                <Link href="/players?sort=updated_desc" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  {th("viewAllLink")} <Icon name="arrow-right" size={13} />
                </Link>
              }
            />
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {recent.map((p) => (
                <MiniCard key={p.worldCardId} p={p} />
              ))}
            </div>
          </section>
        ) : null}

        {/* クイックリンク */}
        <section>
          <SectionHeader title={th("quickLinksHeading")} as="h2" />
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((q) => (
              <Link key={q.href} href={q.href}>
                <Surface tone="raised" interactive className="flex h-full items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                    <Icon name={q.icon} size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{q.label}</p>
                    <p className="mt-0.5 text-xs text-text-dim">{q.desc}</p>
                  </div>
                  <Icon name="chevron-right" size={16} className="ml-auto mt-1 shrink-0 text-text-muted" />
                </Surface>
              </Link>
            ))}
          </div>
        </section>

        {/* 開発中 */}
        <section>
          <SectionHeader title={th("inDevelopmentHeading")} as="h2" hint={th("inDevelopmentHint")} />
          <div className="flex flex-wrap gap-2">
            {developmentFeatures.map((f) => (
              <Badge key={f} tone="outline" size="sm">
                {f}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-muted">{th("designDocNote")}</p>
        </section>
      </div>
    </PageContainer>
  );
}
