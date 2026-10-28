"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { listSquads } from "@/lib/squad/squad-storage";
import type { StoredSquad } from "@/lib/squad/types";
import { useOwnedUpgradeCounts } from "@/components/squad/useOwnedUpgradeCounts";

/**
 * トップ: 所持カードで強くできる保存スカッドの数（2026-10-28・スカッドの一覧の印と同じ規則）。
 * スカッド・所持カードが無い、または 0 個なら何も出さない（初めての人の見た目は変えない）。hydration の後にだけ読む。
 */
export function HomeOwnedSquadUpgrades() {
  const t = useT();
  const scopeState = useSyncedStorageScope();
  const [squads, setSquads] = useState<StoredSquad[] | null>(null);
  useEffect(() => {
    if (scopeState.status === "loading") {
      setSquads(null);
      return;
    }
    setSquads(listSquads());
  }, [scopeState.status === "resolved" ? scopeState.scope.kind : "loading", scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope.scopeId : null]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useOwnedUpgradeCounts(squads);
  if (counts.size === 0) return null;
  return (
    <Link
      href="/squads"
      className="flex w-fit items-center gap-2 rounded-md border border-success/50 bg-success/5 px-3 py-2 text-xs text-success hover:underline"
      data-testid="home-owned-squad-upgrades"
    >
      {fillMessage(t("provisionalCards", "homeOwnedSquadsTemplate"), { count: String(counts.size) })}
    </Link>
  );
}
