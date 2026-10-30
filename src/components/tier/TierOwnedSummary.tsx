"use client";

import "@/lib/i18n/dictionaries/ja-ns/tierList";
import { useMemo } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { useMyTeam } from "@/lib/user-cards/hooks";
import type { OwnTierRank } from "@/lib/tier/own-tier";

const TIERS: OwnTierRank[] = ["S", "A", "B", "C"];

/** Tier に入っている所持のカードの数（2026-10-28）。ブラウザーの中だけ（呼び出し側が next/dynamic で読み込む・2026-10-30）。 */
export function TierOwnedSummary({ entries }: { entries: readonly { worldCardId: string; tier: OwnTierRank }[] }) {
  const t = useT();
  const { myTeam } = useMyTeam();
  const summary = useMemo(() => {
    const owned = new Set(myTeam.filter((r) => r.ownershipStatus === "owned" && !r.deletedAt).map((r) => r.worldCardId));
    return TIERS.map((tier) => ({ tier, n: entries.filter((e) => e.tier === tier && owned.has(e.worldCardId)).length })).filter((x) => x.n > 0);
  }, [myTeam, entries]);
  if (summary.length === 0) return null;
  return (
    <span className="text-success" data-testid="tier-owned-summary">
      {fillMessage(t("tierList", "ownedSummaryTemplate"), { list: summary.map((x) => `${x.tier} ${x.n}`).join(" / ") })}
    </span>
  );
}
