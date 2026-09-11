"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";
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
      { href: "/managers", labelKey: "managers", icon: "managers", status: "ready" },
      { href: "/compare", labelKey: "compare", icon: "compare", status: "ready" },
      { href: "/squads", labelKey: "squads", icon: "squad", status: "ready" },
      { href: "/best-xi", labelKey: "bestXi", icon: "trophy", status: "ready" },
    ],
  },
  {
    titleKey: "groupMyData",
    items: [
      { href: "/favorites", labelKey: "favorites", icon: "star", status: "ready" },
      { href: "/my-team", labelKey: "myTeam", icon: "shirt", status: "ready" },
      { href: "/my-builds", labelKey: "myBuilds", icon: "sliders", status: "ready" },
      { href: "/build-inventory", labelKey: "buildInventory", icon: "database", status: "ready" },
    ],
  },
  {
    titleKey: "groupAnalysis",
    items: [
      { href: "/tier-lists", labelKey: "tierLists", icon: "tier", status: "soon" },
      { href: "/packs", labelKey: "packs", icon: "pack", status: "soon" },
    ],
  },
  {
    titleKey: "groupCommunity",
    items: [{ href: "/community", labelKey: "community", icon: "community", status: "soon" }],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const t = useT();

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
              const active = item.status === "ready" && isActive(pathname, item.href);
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
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-accent" />
                    ) : null}
                    <Icon name={item.icon} size={18} className="shrink-0" />
                    {!collapsed ? <span>{label}</span> : null}
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
