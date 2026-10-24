"use client";

import "@/lib/i18n/dictionaries/ja-ns/myTeam";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";
import { fetchNewCardsOnce, type NewCardForClient } from "@/lib/new-cards/fetch-new-cards";
import { positionSummary } from "@/lib/user-cards/position-summary";

/**
 * My Team のポジション別のまとめ（2026-10-25）。所持のカードが無ければ何も出さない。
 * 持っていないポジションは選手の一覧（そのポジション・最大 OVR の高い順）へ、強化できる新しいカードは新しいカードの画面へ。
 */
export function MyTeamPositionSummary() {
  const t = useT();
  const { locale } = useLocale();
  const tm = (k: Parameters<typeof t<"myTeam">>[1]) => t("myTeam", k);
  const { owned, scopeStatus } = useOwnedCards();
  const [newCards, setNewCards] = useState<NewCardForClient[]>([]);
  const hasOwned = owned.length > 0;
  useEffect(() => {
    if (!hasOwned) return;
    let cancelled = false;
    void fetchNewCardsOnce().then((c) => {
      if (!cancelled) setNewCards(c);
    });
    return () => {
      cancelled = true;
    };
  }, [hasOwned]);
  const rows = useMemo(() => positionSummary(owned, newCards), [owned, newCards]);

  if (scopeStatus === "loading" || !hasOwned) return null;
  return (
    <details className="rounded-card border border-border bg-surface p-3" data-testid="my-team-position-summary" open>
      <summary className="flex min-h-[36px] cursor-pointer items-center text-sm font-semibold">{tm("positionSummaryHeading")}</summary>
      <p className="mt-1 text-2xs text-text-dim">{tm("positionSummaryIntro")}</p>
      <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.position} className="flex min-w-0 flex-col gap-0.5 rounded border border-border/60 px-2 py-1.5 text-xs" data-position={r.position} data-count={r.count}>
            <span className="flex items-baseline gap-2">
              <span className="w-10 shrink-0 font-bold text-text-dim">{r.position}</span>
              <span className="text-text-dim">{fillMessage(tm("positionCountTemplate"), { count: String(r.count) })}</span>
              {r.upgrades > 0 ? (
                <Link href="/players/new" className="ms-auto shrink-0 text-accent hover:underline">
                  {fillMessage(tm("positionUpgradesTemplate"), { count: String(r.upgrades) })}
                </Link>
              ) : null}
            </span>
            {r.best ? (
              <span className="flex min-w-0 items-baseline gap-1.5">
                <Link href={`/players/world/${r.best.worldCardId}`} className="min-w-0 truncate text-accent hover:underline">
                  {resolvePlayerDisplayName(r.best, locale)}
                </Link>
                <span className="shrink-0 tabular-nums text-text-dim">{r.bestOvr ?? "—"}</span>
              </span>
            ) : (
              <span className="flex items-baseline gap-2 text-text-muted">
                {tm("positionNone")}
                <Link href={`/players?position=${r.position}&sort=ovr_max_desc`} className="text-accent hover:underline">
                  {tm("positionFind")}
                </Link>
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
