"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";

/** 新しいカード（最近追加された正式なカード＋暫定）への案内（0 枚なら出さない・2026-10-15・2026-10-17）。 */
export function ProvisionalCardsLink({ count }: { count: number }) {
  const t = useT();
  if (count <= 0) return null;
  return (
    <Link href="/players/new" className="flex w-fit items-center gap-2 rounded-md border border-warning/50 bg-warning/5 px-3 py-2 text-xs text-accent hover:underline" data-testid="provisional-cards-link">
      {t("provisionalCards", "newCardsLinkTemplate").replace("{count}", String(count))}
    </Link>
  );
}
