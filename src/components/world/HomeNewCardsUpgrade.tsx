"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";
import { useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { fetchNewCardsOnce, type NewCardForClient } from "@/lib/new-cards/fetch-new-cards";
import { newCardTeamImpact } from "@/lib/new-cards/team-impact";

/**
 * トップ: 新しいカードのうち、あなたの My Team（所持）の同じポジションの最高より強いものの枚数（2026-10-17）。
 * My Team に所持のカードが無い・該当が 0 枚なら何も出さない（初めての人の見た目は変えない）。
 */
export function HomeNewCardsUpgrade() {
  const t = useT();
  const { ownedIds, owned, scopeStatus } = useOwnedCards();
  const [newCards, setNewCards] = useState<NewCardForClient[] | null>(null);
  const hasOwned = ownedIds.length > 0;
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
  const count = useMemo(() => (newCards && owned.length ? newCardTeamImpact(newCards, owned).filter((x) => x.delta != null && x.delta > 0).length : 0), [newCards, owned]);

  if (scopeStatus === "loading" || !hasOwned || count === 0) return null;
  return (
    <Link
      href="/players/new"
      className="flex w-fit items-center gap-2 rounded-md border border-accent/50 bg-accent/5 px-3 py-2 text-xs text-accent hover:underline"
      data-testid="home-new-cards-upgrade"
    >
      {fillMessage(t("provisionalCards", "homeUpgradeTemplate"), { count: String(count) })}
    </Link>
  );
}
