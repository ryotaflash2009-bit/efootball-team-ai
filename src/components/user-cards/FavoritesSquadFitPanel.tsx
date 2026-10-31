"use client";

import "@/lib/i18n/dictionaries/ja-ns/favoritesView";
import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { useSavedSquadFitInputs } from "@/components/world/useSavedSquadFitInputs";
import { squadsStrengthenedByCard, type SquadFit } from "@/lib/new-cards/card-squad-fit";
import type { WorldPlayerListItem } from "@/lib/world/types";

/** 最初に出す行数（残りは「すべて表示」）。 */
const INITIAL_ROWS = 5;

/**
 * お気に入り: 手に入れると保存スカッドが強くなるカード（2026-11-01）。My Team で所持でないお気に入りを、
 * My Team の欄（#377）と同じ規則で保存スカッドに当てる。まだ持っていないカードなので「入れ替える」は出さない。
 */
export function FavoritesSquadFitPanel({ cards }: { cards: WorldPlayerListItem[] }) {
  const t = useT();
  const { locale } = useLocale();
  const tf = (k: Parameters<typeof t<"favoritesView">>[1]) => t("favoritesView", k);
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const inputs = useSavedSquadFitInputs();
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    if (!inputs || inputs.length === 0) return [];
    const out: { card: WorldPlayerListItem; fits: SquadFit[] }[] = [];
    for (const card of cards) {
      const fits = squadsStrengthenedByCard(card, inputs);
      if (fits.length > 0) out.push({ card, fits });
    }
    const best = (r: (typeof out)[number]) => r.fits[0].delta ?? -1;
    return out.sort((a, b) => best(b) - best(a) || a.card.worldCardId.localeCompare(b.card.worldCardId));
  }, [cards, inputs]);
  if (rows.length === 0) return null;
  return (
    <details className="rounded-card border border-border bg-surface p-3" data-testid="favorites-squad-fit" open>
      <summary className="flex min-h-[36px] cursor-pointer items-center text-sm font-semibold">{tf("squadFitHeading")}</summary>
      <p className="mt-1 text-2xs text-text-dim">{tf("squadFitIntro")}</p>
      <ul className="mt-2 flex flex-col divide-y divide-border">
        {(all ? rows : rows.slice(0, INITIAL_ROWS)).map(({ card, fits }) => (
          <li key={card.worldCardId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-xs" data-world-card-id={card.worldCardId}>
            <Link href={`/players/world/${card.worldCardId}`} className="min-w-0 truncate font-semibold text-accent hover:underline">
              {resolvePlayerDisplayName(card, locale)}
            </Link>
            {fits.map((f) => (
              <span key={f.squadId} className="inline-flex items-baseline gap-1">
                <Link href={`/squads/${encodeURIComponent(f.squadId)}`} className="text-accent hover:underline" data-testid="favorites-squad-fit-link">
                  {f.squadName}
                </Link>
                <span className="font-bold text-text-dim">{f.position}</span>
                {f.delta != null ? <span className="tabular-nums text-success">+{f.delta}</span> : null}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {rows.length > INITIAL_ROWS ? (
        <button type="button" className="mt-1 w-fit rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2" onClick={() => setAll((v) => !v)}>
          {all ? tp("showLess") : fillMessage(tp("showAllTemplate"), { count: String(rows.length) })}
        </button>
      ) : null}
    </details>
  );
}
