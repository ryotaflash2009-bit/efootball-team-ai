"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import "@/lib/i18n/dictionaries/ja-ns/packCheck";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { fillMessage } from "@/lib/i18n/message-format";
import { Surface } from "@/components/ui/Surface";
import { squadNewCardSuggestions, type SquadSlotForSuggestion } from "@/lib/new-cards/squad-suggestions";
import type { ImpactCard } from "@/lib/new-cards/team-impact";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";

/** 最初に出す行数（残りは「すべて表示」・新しいカードの欄と同じ）。 */
const INITIAL_ROWS = 5;

/**
 * 所持カードで強くできる枠（2026-10-26）。My Team で「所持」のカードのうちスカッドにいないものを、新しいカードの欄と同じ規則
 * （同じ登録ポジション・OVR が今の選手より高い・同じ選手を 2 つの枠に出さない）で枠に当てる。当てられる枠が無ければ何も出さない。
 */
export function SquadOwnedUpgradesPanel({ slots, inSquad }: { slots: SquadSlotForSuggestion[]; inSquad: ReadonlySet<string> }) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const { owned } = useOwnedCards();
  const [all, setAll] = useState(false);
  const suggestions = useMemo(() => squadNewCardSuggestions(slots, owned, inSquad), [slots, owned, inSquad]);
  if (suggestions.length === 0) return null;
  const name = (c: ImpactCard) => resolvePlayerDisplayName(c, locale);
  const basis = (b: "max" | "base") => tp(b === "max" ? "impactBasisMax" : "impactBasisBase");

  return (
    <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="squad-owned-upgrades">
      <h2 className="font-semibold">{tp("squadOwnedHeading")}</h2>
      <p className="text-xs text-text-dim">{tp("squadOwnedIntro")}</p>
      <ul className="flex flex-col divide-y divide-border" data-testid="squad-owned-upgrades-list">
        {(all ? suggestions : suggestions.slice(0, INITIAL_ROWS)).map((s) => (
          <li key={s.slotId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5" data-world-card-id={s.suggestion.worldCardId}>
            <span className="w-10 shrink-0 text-xs font-bold text-text-dim">{s.position}</span>
            <Link href={`/players/world/${s.suggestion.worldCardId}`} className="font-semibold text-accent hover:underline">
              {name(s.suggestion)}
            </Link>
            <span className="text-xs text-text-dim">
              {s.delta == null
                ? fillMessage(tp("squadSuggestEmptySlotTemplate"), { basis: basis(s.basis), newOvr: String(s.newOvr) })
                : fillMessage(tp("squadSuggestRowTemplate"), {
                    basis: basis(s.basis),
                    newOvr: String(s.newOvr),
                    currentName: s.current ? name(s.current) : "—",
                    currentOvr: String(s.currentOvr),
                    delta: String(s.delta),
                  })}
            </span>
            {s.current ? (
              <Link href={`/compare?ids=${s.suggestion.worldCardId},${s.current.worldCardId}`} className="text-xs text-accent hover:underline">
                {t("packCheck", "compareAbilities")}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      {suggestions.length > INITIAL_ROWS ? (
        <button type="button" className="w-fit rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2" onClick={() => setAll((v) => !v)}>
          {all ? tp("showLess") : fillMessage(tp("showAllTemplate"), { count: String(suggestions.length) })}
        </button>
      ) : null}
    </Surface>
  );
}
