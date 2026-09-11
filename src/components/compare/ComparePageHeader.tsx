"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LocaleContext";

export function ComparePageDataUnavailable() {
  const t = useT();
  return (
    <>
      <PageHeader title={t("comparePage", "title")} icon="compare" />
      <div className="mt-6">
        <EmptyState
          variant="error"
          icon="database"
          title={t("comparePage", "dataUnavailableTitle")}
          description={t("comparePage", "dataUnavailableDescription")}
        />
      </div>
    </>
  );
}

export function ComparePageHeader() {
  const t = useT();
  return (
    <PageHeader
      title={t("comparePage", "title")}
      icon="compare"
      description={t("comparePage", "description")}
      actions={
        <Link href="/players" className={buttonClasses("secondary", "sm")}>
          {t("comparePage", "backToPlayers")}
        </Link>
      }
    />
  );
}
