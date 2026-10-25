"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { routePathname } from "@/lib/navigation/route-pathname";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { fetchNewCardsOnce } from "@/lib/new-cards/fetch-new-cards";
import { addedTimesOf, cacheNewCardTimes, freshCachedTimes, readNewCardsSeenState, unseenNewCardCount } from "@/lib/new-cards/seen";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type NavKey = keyof Dictionary["nav"];

type NavItem = {
  href: string;
  labelKey: NavKey;
  icon: IconName;
  status: "ready" | "soon";
};

const GROUPS: { titleKey: NavKey; items: NavItem[] }[] = [
  {
    titleKey: "groupMain",
    items: [
      { href: "/", labelKey: "home", icon: "home", status: "ready" },
      { href: "/players", labelKey: "players", icon: "players", status: "ready" },
      { href: "/players/new", labelKey: "newCards", icon: "sparkles", status: "ready" },
      { href: "/managers", labelKey: "managers", icon: "managers", status: "ready" },
      { href: "/compare", labelKey: "compare", icon: "compare", status: "ready" },
      { href: "/squads", labelKey: "squads", icon: "squad", status: "ready" },
      { href: "/best-xi", labelKey: "bestXi", icon: "trophy", status: "ready" },
      { href: "/tier", labelKey: "tierLists", icon: "tier", status: "ready" },
      { href: "/pack-check", labelKey: "packCheck", icon: "pack", status: "ready" },
    ],
  },
  {
    titleKey: "groupMyData",
    items: [
      { href: "/favorites", labelKey: "favorites", icon: "star", status: "ready" },
      { href: "/my-team", labelKey: "myTeam", icon: "shirt", status: "ready" },
      { href: "/my-builds", labelKey: "myBuilds", icon: "sliders", status: "ready" },
      { href: "/build-inventory", labelKey: "buildInventory", icon: "database", status: "ready" },
      { href: "/diagnosis-history", labelKey: "diagnosisHistory", icon: "list", status: "ready" },
    ],
  },
  // TeamAIXI v1.0（2026-10-04）: Tier・Pack（権利未確認）と Community（未公開）は、準備中の表示も含めてナビに出さない。
  // 将来の公開時は、ここへ "ready" の項目として戻す（ページ・設計は残している）。
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const NEW_CARDS_HREF = "/players/new";
const READY_HREFS = GROUPS.flatMap((g) => g.items.filter((i) => i.status === "ready").map((i) => i.href));

/** 最も具体的に一致する項目だけを「現在のページ」にする（/players/new では「選手」ではなく「新しいカード」）。 */
function activeHrefOf(pathname: string): string | null {
  let best: string | null = null;
  for (const h of READY_HREFS) if (isActive(pathname, h) && (!best || h.length > best.length)) best = h;
  return best;
}

/** 前回「新しいカード」を見たあとに追加されたカードの枚数（2026-10-17）。表示はブラウザーの中だけ（hydration の後）。 */
function useUnseenNewCards(pathname: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (isActive(pathname, NEW_CARDS_HREF)) {
      setCount(0);
      return;
    }
    // 5 分以内に取った一覧があれば API を呼ばない（ページの読み込みごとに要求しない）
    const state = readNewCardsSeenState();
    const cached = freshCachedTimes(state);
    if (cached) {
      setCount(unseenNewCardCount(cached, state.seenAt));
      return;
    }
    let cancelled = false;
    void fetchNewCardsOnce().then((cards) => {
      const times = addedTimesOf(cards);
      cacheNewCardTimes(times);
      if (!cancelled) setCount(unseenNewCardCount(times, readNewCardsSeenState().seenAt));
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  return count;
}

export function SidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  // Vercel の ISR の作り直しでは "/index" になるため "/" にそろえる（サーバーとブラウザーで印を一致させる・React #418 の対策）
  const pathname = routePathname(usePathname());
  const t = useT();
  const activeHref = activeHrefOf(pathname);
  const unseen = useUnseenNewCards(pathname);

  return (
    <nav className="flex flex-col gap-5 py-4" aria-label={t("nav", "ariaSidebar")}>
      {GROUPS.map((group) => (
        <div key={group.titleKey}>
          {!collapsed ? (
            <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              {t("nav", group.titleKey)}
            </p>
          ) : (
            <div className="mx-3 mb-1.5 h-px bg-border" />
          )}
          <ul className="flex flex-col gap-0.5 px-2">
            {group.items.map((item) => {
              const label = t("nav", item.labelKey);
              const active = item.status === "ready" && item.href === activeHref;
              const badge = item.href === NEW_CARDS_HREF && unseen > 0 ? (unseen > 99 ? "99+" : String(unseen)) : null;
              if (item.status === "soon") {
                return (
                  <li key={item.href}>
                    <span
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted ${
                        collapsed ? "justify-center" : ""
                      }`}
                      title={`${label}（${t("nav", "comingSoon")}）`}
                      aria-disabled="true"
                    >
                      <Icon name={item.icon} size={18} className="shrink-0 opacity-60" />
                      {!collapsed ? (
                        <>
                          <span className="flex-1">{label}</span>
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs">{t("nav", "comingSoon")}</span>
                        </>
                      ) : null}
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${
                      active
                        ? "bg-accent-soft font-semibold text-accent"
                        : "text-text-dim hover:bg-surface-2 hover:text-text"
                    }`}
                  >
                    {active ? (
                      <span className="absolute start-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-e bg-accent" />
                    ) : null}
                    <Icon name={item.icon} size={18} className="shrink-0" />
                    {!collapsed ? <span>{label}</span> : null}
                    {badge ? (
                      <span
                        className={
                          collapsed
                            ? "absolute end-1.5 top-1 h-2 w-2 rounded-full bg-accent"
                            : "ms-auto rounded-full bg-accent px-1.5 py-0.5 text-2xs font-bold leading-none text-accent-ink tabular-nums"
                        }
                        aria-label={fillMessage(t("nav", "newCardsBadgeAriaTemplate"), { count: String(unseen) })}
                        data-testid="nav-new-cards-badge"
                      >
                        {collapsed ? null : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
