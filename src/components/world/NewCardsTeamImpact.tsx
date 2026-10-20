"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import "@/lib/i18n/dictionaries/ja-ns/packCheck";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { newCardTeamImpact, type ImpactCard } from "@/lib/new-cards/team-impact";

const SHOW = 12;
const SHOW_NEW_POSITIONS = 6;
/** 最初に出す行数（残りは「すべて表示」・2026-10-17 画面の整理）。 */
const INITIAL_ROWS = 5;

/**
 * 新しいカードのうち、あなたの My Team（所持）の同じポジションの最高を上回るもの（2026-10-17）。ブラウザーの中だけで計算する。
 */
export function NewCardsTeamImpact({ newCards }: { newCards: ImpactCard[] }) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const { ownedIds, owned, scopeStatus } = useOwnedCards();
  const impacts = useMemo(() => newCardTeamImpact(newCards, owned), [newCards, owned]);
  const rows = useMemo(() => [...impacts.filter((x) => x.delta != null).slice(0, SHOW), ...impacts.filter((x) => x.delta == null).slice(0, SHOW_NEW_POSITIONS)], [impacts]);
  const [all, setAll] = useState(false);

  if (scopeStatus === "loading" || newCards.length === 0) return null;
  const name = (c: ImpactCard) => resolvePlayerDisplayName(c, locale);
  const basis = (b: "max" | "base") => tp(b === "max" ? "impactBasisMax" : "impactBasisBase");

  return (
    <section className="flex flex-col gap-3" data-testid="new-cards-impact">
      <SectionHeader title={tp("impactHeading")} as="h2" />
      {ownedIds.length === 0 ? (
        <Surface padding="md" className="flex flex-col gap-2 text-sm text-text-dim" data-testid="new-cards-impact-no-team">
          <p>{tp("impactNoTeam")}</p>
          <Link href="/my-team" className="w-fit text-accent hover:underline">
            {tp("impactOpenMyTeam")}
          </Link>
        </Surface>
      ) : (
        <>
          <p className="text-xs text-text-dim">{tp("impactIntro")}</p>
          {impacts.length === 0 ? (
            <Surface padding="md" className="text-sm text-text-dim" data-testid="new-cards-impact-none">
              {tp("impactNone")}
            </Surface>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface text-sm" data-testid="new-cards-impact-list">
              {(all ? rows : rows.slice(0, INITIAL_ROWS)).map((x) => (
                <li key={x.card.worldCardId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2">
                  <span className="w-10 shrink-0 text-xs font-bold text-text-dim">{x.position}</span>
                  <Link href={`/players/world/${x.card.worldCardId}`} className="font-semibold text-accent hover:underline">
                    {name(x.card)}
                  </Link>
                  <span className="text-xs text-text-dim">
                    {x.delta == null
                      ? tp("impactNewPositionTemplate").replace("{basis}", basis(x.basis)).replace("{newOvr}", String(x.newOvr))
                      : tp("impactRowTemplate")
                          .replace("{basis}", basis(x.basis))
                          .replace("{newOvr}", String(x.newOvr))
                          .replace("{ownedName}", x.bestOwned ? name(x.bestOwned) : "—")
                          .replace("{ownedOvr}", String(x.ownedOvr))
                          .replace("{delta}", String(x.delta))}
                  </span>
                  {x.bestOwned ? (
                    <Link href={`/compare?ids=${x.card.worldCardId},${x.bestOwned.worldCardId}`} className="text-xs text-accent hover:underline" data-testid="compare-with-owned">
                      {t("packCheck", "compareAbilities")}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {rows.length > INITIAL_ROWS ? (
            <button type="button" className="w-fit rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2" onClick={() => setAll((v) => !v)} data-testid="new-cards-impact-toggle">
              {all ? tp("showLess") : fillMessage(tp("showAllTemplate"), { count: String(rows.length) })}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
