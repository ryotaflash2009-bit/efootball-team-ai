"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useT } from "@/lib/i18n/LocaleContext";
import { usePageTitle } from "@/lib/i18n/use-page-title";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { WorldPlayerCard, type WorldPlayerCardData } from "@/components/world/WorldPlayerCard";

const GRID = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";

/** 新しいカード（2026-10-15 暫定・2026-10-17 最近追加された正式なカード）。 */
export function ProvisionalCardsView({ cards, recent, recentDays }: { cards: WorldPlayerCardData[]; recent: WorldPlayerCardData[]; recentDays: number }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  usePageTitle(tp("newCardsPageTitle"));
  return (
    <div className="flex flex-col gap-5" data-testid="provisional-cards">
      <PageHeader title={tp("newCardsPageTitle")} icon="players" description={tp("newCardsIntro")} />

      <section className="flex flex-col gap-3" data-testid="recently-added">
        <SectionHeader title={tp("recentHeadingTemplate").replace("{days}", String(recentDays)).replace("{count}", String(recent.length))} as="h2" />
        <p className="text-xs text-text-dim">{tp("recentIntro")}</p>
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
