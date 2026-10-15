"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useT } from "@/lib/i18n/LocaleContext";
import { usePageTitle } from "@/lib/i18n/use-page-title";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { WorldPlayerCard, type WorldPlayerCardData } from "@/components/world/WorldPlayerCard";

/** 新しいカード（暫定）の一覧（2026-10-15）。 */
export function ProvisionalCardsView({ cards }: { cards: WorldPlayerCardData[] }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  usePageTitle(tp("newCardsPageTitle"));
  return (
    <div className="flex flex-col gap-4" data-testid="provisional-cards">
      <PageHeader title={tp("newCardsPageTitle")} icon="players" description={tp("newCardsIntro")} />
      <Surface tone="outline" padding="sm" className="text-xs text-text-dim">
        <p>{tp("noticeBody")}</p>
        <p className="mt-1">{tp("maxLevelUnknown")}</p>
      </Surface>
      {cards.length === 0 ? (
        <Surface padding="md" className="text-sm text-text-dim" data-testid="provisional-cards-empty">
          {tp("newCardsEmpty")}
        </Surface>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7" data-testid="provisional-cards-grid">
          {cards.map((c) => (
            <li key={c.worldCardId}>
              <WorldPlayerCard player={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
