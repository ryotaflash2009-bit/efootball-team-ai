"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { useT } from "@/lib/i18n/LocaleContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HeaderAccountNav } from "@/components/auth/HeaderAccountNav";

/**
 * グローバルヘッダー。ブランド・グローバル検索・モバイルメニュー・言語選択。
 * 高さは --header-h（56px）。PC はサイドバーと連携、モバイルは固定。
 */
export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const t = useT();

  return (
    <header className="sticky top-0 z-30 flex h-header items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur">
      <IconButton icon="menu" label={t("nav", "ariaMobileMenuOpen")} onClick={onMenuClick} className="lg:hidden" />

      <Link href="/" className="flex items-center gap-2.5 lg:hidden" aria-label={t("header", "ariaHomeLink")}>
        <span className="grid h-8 w-8 place-items-center rounded-md bg-accent font-black text-accent-ink">
          <span className="text-sm leading-none">27</span>
        </span>
        <span className="hidden text-sm font-bold tracking-wide sm:inline">{t("nav", "brand")}</span>
      </Link>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const v = q.trim();
          router.push(v ? `/players?q=${encodeURIComponent(v)}` : "/players");
        }}
        className="ml-auto flex min-w-0 max-w-sm flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 focus-within:border-accent"
      >
        <Icon name="search" size={16} className="shrink-0 text-text-dim" />
        <input
          type="search"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("header", "searchPlaceholder")}
          aria-label={t("header", "searchAriaLabel")}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
        />
      </form>

      <HeaderAccountNav />

      <LanguageSwitcher compact />

      <span className="hidden shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-2xs text-text-dim md:flex">
        <Icon name="database" size={13} className="text-accent" />
        World 13,009
      </span>
    </header>
  );
}
