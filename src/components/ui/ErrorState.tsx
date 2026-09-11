"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Button, buttonClasses } from "./Button";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * エラー表示の統一。安全な説明のみ。SQL 全文・スタックトレース・パス・秘密情報は出さない。
 * ErrorBoundary（app/error.tsx）は元々 Client Component であり、ここでの LocaleContext 参照は安全。
 */
export function ErrorState({
  title,
  description,
  onRetry,
  backHref,
  backLabel,
  homeHref = "/",
  code,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
  homeHref?: string | null;
  code?: string;
}) {
  const t = useT();
  const displayTitle = title ?? t("common", "errorTitle");
  const displayDescription = description ?? t("common", "errorDescription");
  const displayBackLabel = backLabel ?? t("common", "back");

  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-card border border-dashed border-danger/40 bg-surface/60 px-6 py-12 text-center">
      <span
        className="grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger"
        role="img"
        aria-label={t("pageError", "iconAriaLabel")}
      >
        <Icon name="warning" size={26} />
      </span>
      <div className="max-w-md">
        <p className="text-lg font-semibold text-text">{displayTitle}</p>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">{displayDescription}</p>
        {code ? (
          <p className="mt-2 text-2xs text-text-muted">
            {t("pageError", "codeLabelPrefix")}
            {code}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button variant="primary" iconLeft="refresh" onClick={onRetry}>
            {t("common", "retry")}
          </Button>
        ) : null}
        {backHref ? (
          <Link href={backHref} className={buttonClasses("secondary", "md")}>
            {displayBackLabel}
          </Link>
        ) : null}
        {homeHref ? (
          <Link href={homeHref} className={buttonClasses("ghost", "md")}>
            {t("common", "home")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
