"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import "@/lib/i18n/dictionaries/ja-ns/squadEditor";
import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { Surface } from "@/components/ui/Surface";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";
import { benchSuggestions } from "@/lib/squad/bench-suggestions";

/**
 * 控えに入れられる所持カード（2026-11-01）。先発のポジションのうち控えに同じポジションがいないものに、
 * スカッドにいない所持カードで最も強いものを出し、「ベンチへ追加」で控えに入れる。候補が無ければ何も出さない。
 */
export function SquadBenchOwnedPanel({
  starterPositions,
  benchPositions,
  inSquad,
  benchFull,
  onAdd,
}: {
  starterPositions: string[];
  benchPositions: (string | null)[];
  inSquad: ReadonlySet<string>;
  benchFull: boolean;
  onAdd: (worldCardId: string) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const { owned } = useOwnedCards();
  const rows = useMemo(() => benchSuggestions({ starterPositions, benchPositions, inSquad, owned }), [starterPositions, benchPositions, inSquad, owned]);
  if (rows.length === 0 || benchFull) return null;
  return (
    <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="squad-bench-owned">
      <h2 className="font-semibold">{tp("benchOwnedHeading")}</h2>
      <p className="text-xs text-text-dim">{tp("benchOwnedIntro")}</p>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map(({ position, card }) => (
          <li key={position} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5" data-world-card-id={card.worldCardId}>
            <span className="w-10 shrink-0 text-xs font-bold text-text-dim">{position}</span>
            <Link href={`/players/world/${card.worldCardId}`} className="font-semibold text-accent hover:underline">
              {resolvePlayerDisplayName(card, locale)}
            </Link>
            <span className="text-xs tabular-nums text-text-dim">{card.ovrMax ?? card.ovrBase ?? "—"}</span>
            <button
              type="button"
              onClick={() => onAdd(card.worldCardId)}
              className="ms-auto inline-flex min-h-[32px] items-center rounded-md border border-accent px-2 text-xs font-semibold text-accent hover:bg-accent-soft"
              data-testid="squad-bench-owned-add"
            >
              {t("squadEditor", "addToBenchLabel")}
            </button>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
