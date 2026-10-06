"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { coreTitleFor } from "@/lib/i18n/page-titles";
import { keepDocumentTitle } from "@/lib/i18n/use-page-title";

/**
 * 日本語以外の表示言語で、核の名前空間（nav）だけで題名が決まる画面のタブの題名を表示言語にする（2026-10-07）。
 * それ以外の画面は各 view の `usePageTitle`。日本語ではサーバーの題名のまま（何もしない）。描画には何も出さない。
 */
export function PageTitleSync() {
  const pathname = usePathname();
  const { displayLocale } = useLocale();
  const t = useT();
  useEffect(() => {
    if (displayLocale === "ja" || typeof document === "undefined") return;
    const desired = coreTitleFor(pathname ?? "/", t);
    if (!desired) return;
    return keepDocumentTitle(desired);
  }, [pathname, displayLocale, t]);
  return null;
}
