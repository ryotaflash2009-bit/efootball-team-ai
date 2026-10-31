"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import "@/lib/i18n/dictionaries/ja-ns/myTeam";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { Surface } from "@/components/ui/Surface";
import { useSyncedStorageScope } from "@/lib/local-storage-scope/resolve-scope";
import { listSquads } from "@/lib/squad/squad-storage";
import { findSquadUsageByWorldCardId, type SquadUsage } from "@/lib/squad/usage";

/**
 * 選手の詳細: このカードを使っている保存スカッド（2026-11-01）。先発（配置ロール・キャプテン）か控えかを出し、スカッドへリンクする。
 * スカッドはブラウザーの中だけ（スコープの解決の後に読む）。使っていなければ何も出さない。
 */
export function SquadUsagePanel({ worldCardId }: { worldCardId: string }) {
  const t = useT();
  const tm = (k: Parameters<typeof t<"myTeam">>[1]) => t("myTeam", k);
  const scopeState = useSyncedStorageScope();
  const [usage, setUsage] = useState<SquadUsage[]>([]);
  useEffect(() => {
    if (scopeState.status === "loading") {
      setUsage([]);
      return;
    }
    setUsage(findSquadUsageByWorldCardId(listSquads(), worldCardId));
  }, [worldCardId, scopeState.status === "resolved" ? scopeState.scope.kind : "loading", scopeState.status === "resolved" && scopeState.scope.kind === "account" ? scopeState.scope.scopeId : null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (usage.length === 0) return null;
  return (
    <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="squad-usage">
      <h2 className="font-semibold">{fillMessage(t("provisionalCards", "squadUsageHeadingTemplate"), { count: String(usage.length) })}</h2>
      <ul className="flex flex-col divide-y divide-border">
        {usage.map((u) => (
          <li key={`${u.squadId}-${u.area}-${u.slotId ?? u.benchIndex}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5" data-squad-id={u.squadId}>
            <Link href={`/squads/${encodeURIComponent(u.squadId)}`} className="min-w-0 truncate font-semibold text-accent hover:underline">
              {u.squadName}
            </Link>
            <span className="text-xs text-text-dim">{u.formationName}</span>
            <span className="text-xs font-bold text-text-dim">
              {u.area === "starter" ? `${fillMessage(tm("starterUsageTemplate"), { role: u.placementRole ?? "?" })}${u.isCaptain ? tm("captainUsageSuffix") : ""}` : tm("benchUsageLabel")}
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
