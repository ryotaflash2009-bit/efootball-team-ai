"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n/LocaleContext";

export function PlayerDetailWorldDataUnavailable() {
  const t = useT();
  return (
    <EmptyState
      variant="error"
      icon="database"
      title={t("playerDetailPage", "worldDataUnavailableTitle")}
      description={t("playerDetailPage", "worldDataUnavailableDescription")}
      action={
        <Link href="/players" className="text-sm text-accent">
          {t("playerDetailPage", "backToPlayerList")}
        </Link>
      }
    />
  );
}
