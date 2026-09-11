"use client";

import Link from "next/link";
import { PageContainer } from "@/components/ui/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * not-found.tsx（Server Component）から呼ぶ Client Component。
 * LocaleContext（useT）は Client Component からのみ安全に参照できるため、ここで分離する。
 */
export function NotFoundView() {
  const t = useT();
  return (
    <PageContainer width="regular">
      <EmptyState
        icon="search"
        variant="no-results"
        title={t("notFoundPage", "title")}
        description={t("notFoundPage", "description")}
        action={
          <Link href="/players" className={buttonClasses("primary", "md")}>
            {t("notFoundPage", "playersLink")}
          </Link>
        }
        secondaryAction={
          <Link href="/" className={buttonClasses("ghost", "md")}>
            {t("common", "home")}
          </Link>
        }
      />
    </PageContainer>
  );
}
