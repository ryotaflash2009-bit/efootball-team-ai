"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { formatDate } from "@/lib/i18n/format";
import { fillMessage } from "@/lib/i18n/message-format";
import type { AddedBatch } from "@/lib/new-cards/added-batches";
import { usePageTitle } from "@/lib/i18n/use-page-title";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { WorldPlayerCard, type WorldPlayerCardData } from "@/components/world/WorldPlayerCard";
import { NewCardsTeamImpact } from "@/components/world/NewCardsTeamImpact";

const GRID = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";

/** 新しいカード（2026-10-15 暫定・2026-10-17 最近追加された正式なカード）。 */
export function ProvisionalCardsView({
  cards,
  recent,
  recentDays,
  batches = [],
  packCheckLimit = 30,
}: {
  cards: WorldPlayerCardData[];
  recent: WorldPlayerCardData[];
  recentDays: number;
  batches?: AddedBatch[];
  packCheckLimit?: number;
}) {
  const t = useT();
  const { displayLocale } = useLocale();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  usePageTitle(tp("newCardsPageTitle"));
  return (
    <div className="flex flex-col gap-5" data-testid="provisional-cards">
      <PageHeader title={tp("newCardsPageTitle")} icon="players" description={tp("newCardsIntro")} />

      <NewCardsTeamImpact newCards={[...recent, ...cards]} />

      <section className="flex flex-col gap-3" data-testid="recently-added">
        <SectionHeader title={tp("recentHeadingTemplate").replace("{days}", String(recentDays)).replace("{count}", String(recent.length))} as="h2" />
        <p className="text-xs text-text-dim">{tp("recentIntro")}</p>
        {batches.length > 0 ? (
          <Surface padding="sm" className="flex flex-col gap-1.5 text-sm" data-testid="added-batches">
            <p className="font-semibold">{tp("batchesHeading")}</p>
            <p className="text-xs text-text-dim">{tp("batchesIntro")}</p>
            <ul className="flex flex-col divide-y divide-border">
              {batches.map((b) => (
                <li key={b.date} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                  <span>{fillMessage(tp("batchRowTemplate"), { date: formatDate(new Date(`${b.date}T12:00:00+09:00`), displayLocale), count: String(b.count) })}</span>
                  <Link href={`/pack-check?ids=${b.ids.join(",")}`} className="text-accent hover:underline" data-testid="added-batch-pack-check">
                    {tp("batchOpenPackCheck")}
                  </Link>
                  {b.truncated ? <span className="text-xs text-text-muted">{fillMessage(tp("batchTruncatedTemplate"), { limit: String(packCheckLimit) })}</span> : null}
                </li>
              ))}
            </ul>
          </Surface>
        ) : null}
        {recent.length === 0 ? (
          <Surface padding="md" className="text-sm text-text-dim" data-testid="recently-added-empty">
            {tp("recentEmpty")}
          </Surface>
        ) : (
          <ul className={GRID} data-testid="recently-added-grid">
            {recent.map((c) => (
              <li key={c.worldCardId}>
                <WorldPlayerCard player={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title={tp("provisionalHeading")} as="h2" />
        <Surface tone="outline" padding="sm" className="text-xs text-text-dim">
          <p>{tp("noticeBody")}</p>
          <p className="mt-1">{tp("maxLevelUnknown")}</p>
        </Surface>
        {cards.length === 0 ? (
          <Surface padding="md" className="text-sm text-text-dim" data-testid="provisional-cards-empty">
            {tp("newCardsEmpty")}
          </Surface>
        ) : (
          <ul className={GRID} data-testid="provisional-cards-grid">
            {cards.map((c) => (
              <li key={c.worldCardId}>
                <WorldPlayerCard player={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
