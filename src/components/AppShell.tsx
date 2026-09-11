"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";

const COLLAPSE_KEY = "efb:sidebar-collapsed";

/**
 * 全画面共通の外枠。
 * - サイドバー: PC は画面左端に固定表示（折りたたみ可）。狭い画面はドロワー。
 * - ヘッダー: 本文カラム上部に固定。
 * - 本文は各ページが PageContainer で最大幅を制御する。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const t = useT();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen">
      {/* PC サイドバー */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface lg:flex ${
          collapsed ? "w-[64px]" : "w-sidebar"
        }`}
      >
        <div className={`flex h-header items-center border-b border-border ${collapsed ? "justify-center" : "px-4"}`}>
          <Link href="/" className="flex items-center gap-2.5" aria-label={t("nav", "ariaHome")}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-sm font-black leading-none text-accent-ink">
              27
            </span>
            {!collapsed ? <span className="text-sm font-bold tracking-wide">Team AI</span> : null}
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-text-dim hover:bg-surface-2 hover:text-text"
            aria-label={collapsed ? t("nav", "ariaExpand") : t("nav", "ariaCollapse")}
          >
            <Icon name={collapsed ? "expand" : "collapse"} size={16} />
            {!collapsed ? <span>{t("nav", "collapseLabel")}</span> : null}
          </button>
        </div>
      </aside>

      {/* モバイルドロワー */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div
            className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-border bg-surface shadow-pop"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav", "ariaMobileMenu")}
          >
            <div className="flex h-header items-center justify-between border-b border-border px-4">
              <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-sm font-black text-accent-ink">27</span>
                <span className="text-sm font-bold">{t("nav", "brand")}</span>
              </Link>
              <IconButton icon="close" label={t("nav", "ariaMobileMenuClose")} onClick={() => setMobileOpen(false)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      {/* 本文カラム */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
