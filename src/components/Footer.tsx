"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { areInternalPagesVisible, isInternalPagePath } from "@/lib/public-info/internal-pages";

const LINKS: { href: string; labelKey: "aboutLink" | "termsLink" | "privacyLink" | "disclaimerLink" | "dataManagementLink" | "supportLink" | "releaseReadinessLink" }[] = [
  { href: "/about", labelKey: "aboutLink" },
  { href: "/terms", labelKey: "termsLink" },
  { href: "/privacy", labelKey: "privacyLink" },
  { href: "/disclaimer", labelKey: "disclaimerLink" },
  { href: "/data-management", labelKey: "dataManagementLink" },
  { href: "/support", labelKey: "supportLink" },
  { href: "/release-readiness", labelKey: "releaseReadinessLink" },
];

/**
 * 全ページ共通のフッター。サービス概要・利用規約・プライバシー・免責事項・データ管理・
 * 問い合わせ・公開準備状況への導線と、短い非公式サービス表記をまとめる。
 * 390px幅でも横スクロールが発生しないよう、リンクは折り返す。
 */
export function Footer() {
  const t = useT();
  // 内部ページ(公開準備状況)への導線は、そのページが表示される環境でだけ出す。
  const links = areInternalPagesVisible() ? LINKS : LINKS.filter((l) => !isInternalPagePath(l.href));

  return (
    <footer aria-label={t("footer", "ariaLandmark")} className="mt-8 border-t border-border bg-surface px-4 py-5 sm:px-6 lg:px-8">
      <nav aria-label={t("footer", "ariaLandmark")} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="inline-flex min-h-[24px] items-center text-text-dim underline-offset-2 hover:text-accent hover:underline">
            {t("footer", link.labelKey)}
          </Link>
        ))}
      </nav>
      <p className="mt-3 max-w-3xl text-2xs leading-relaxed text-text-muted">{t("footer", "unofficialNotice")}</p>
      <p className="mt-1 text-2xs text-text-muted">{t("footer", "draftBadge")}</p>
    </footer>
  );
}
