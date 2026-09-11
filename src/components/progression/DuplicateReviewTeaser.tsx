"use client";

import Link from "next/link";
import { Surface } from "@/components/ui/Surface";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * My Builds 上部の小さな案内（重複候補の本体は /build-inventory 側にある）。
 * ここでは再計算・再取得をしない（情報過多を避けるため静的な案内のみ）。
 */
export function DuplicateReviewTeaser() {
  const t = useT();
  return (
    <Surface tone="inset" padding="sm" className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-2xs text-text-muted">
        {t("duplicateReviewTeaser", "bodyPrefix")}
        <b>{t("duplicateReviewTeaser", "duplicateCandidatesLabel")}</b>
        {t("duplicateReviewTeaser", "bodySuffix")}
      </p>
      <Link
        href="/build-inventory"
        className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 text-2xs hover:border-accent"
      >
        <Icon name="database" size={12} />
        {t("duplicateReviewTeaser", "openInventoryLink")}
      </Link>
    </Surface>
  );
}
