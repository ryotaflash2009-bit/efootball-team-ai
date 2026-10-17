"use client";

import "@/lib/i18n/dictionaries/ja-ns/packCheck";
import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { Surface } from "@/components/ui/Surface";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { useResolvedCards } from "@/lib/user-cards/use-resolved-cards";
import { packCheck } from "@/lib/new-cards/pack-check";
import type { ImpactCard } from "@/lib/new-cards/team-impact";

/**
 * 選手の詳細: このカードとあなたの My Team（所持）の同じポジションの最高の比較（2026-10-17）。
 * 計算はパック診断と同じ（`packCheck`）。My Team に所持のカードが無ければ何も出さない（公開のページの見た目を変えない）。
 */
export function MyTeamFitPanel({ card }: { card: ImpactCard }) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"packCheck">>[1]) => t("packCheck", k);
  const { myTeam, scopeStatus } = useMyTeam();
  const ownedIds = useMemo(() => myTeam.filter((r) => r.ownershipStatus === "owned" && !r.deletedAt).map((r) => r.worldCardId), [myTeam]);
  const { cards } = useResolvedCards(ownedIds);
  const owned = useMemo(() => ownedIds.map((id) => cards.get(id)).filter((c): c is NonNullable<typeof c> => c != null), [ownedIds, cards]);
  const result = useMemo(() => packCheck([card], owned).results[0] ?? null, [card, owned]);

  if (scopeStatus === "loading" || ownedIds.length === 0 || owned.length === 0 || !result) return null;
  const name = (c: ImpactCard) => resolvePlayerDisplayName(c, locale);
  const basis = t("provisionalCards", result.basis === "max" ? "impactBasisMax" : "impactBasisBase");

  let line: string | null = null;
  if (result.verdict === "already_owned") line = tp("fitAlreadyOwned");
  else if (result.verdict === "new_position" && result.newOvr != null) line = fillMessage(tp("rowNewPositionTemplate"), { basis, newOvr: String(result.newOvr) });
  else if ((result.verdict === "upgrade" || result.verdict === "no_upgrade") && result.newOvr != null)
    line = fillMessage(tp(result.verdict === "upgrade" ? "rowUpgradeTemplate" : "rowNoUpgradeTemplate"), {
      basis,
      newOvr: String(result.newOvr),
      ownedName: result.bestOwned ? name(result.bestOwned) : "—",
      ownedOvr: String(result.ownedOvr ?? "—"),
      delta: String(result.delta ?? 0),
    });
  if (!line) return null;
  const label: Record<string, string> = {
    upgrade: tp("verdictUpgrade"),
    new_position: tp("verdictNewPosition"),
    no_upgrade: tp("verdictNoUpgrade"),
    already_owned: tp("verdictAlreadyOwned"),
  };

  return (
    <Surface padding="sm" className="flex flex-col gap-1 text-sm" data-testid="my-team-fit" data-verdict={result.verdict}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{tp("fitHeading")}</span>
        <span className={`rounded px-1.5 py-0.5 text-2xs ${result.verdict === "upgrade" ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-dim"}`}>{label[result.verdict]}</span>
      </div>
      <p className="text-xs text-text-dim">{line}</p>
      {result.samePlayerOwned && result.verdict !== "already_owned" ? (
        <p className="text-xs text-text-muted">{fillMessage(tp("samePlayerTemplate"), { name: name(result.samePlayerOwned) })}</p>
      ) : null}
      {result.verdict !== "already_owned" ? (
        <Link href={`/pack-check?ids=${card.worldCardId}`} className="w-fit text-xs text-accent hover:underline" data-testid="my-team-fit-pack-check">
          {tp("fitOpenPackCheck")}
        </Link>
      ) : null}
    </Surface>
  );
}
