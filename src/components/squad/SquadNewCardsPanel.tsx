"use client";

import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { Surface } from "@/components/ui/Surface";
import { ProvisionalBadge } from "@/components/world/ProvisionalCardNotice";
import { squadNewCardSuggestions, type SquadSlotForSuggestion } from "@/lib/new-cards/squad-suggestions";
import type { ImpactCard } from "@/lib/new-cards/team-impact";
import { fetchNewCardsOnce } from "@/lib/new-cards/fetch-new-cards";

type NewCard = ImpactCard & { provisional?: boolean };

/**
 * このスカッドを強くする新しいカード（2026-10-17）。/api/world/new-cards（最近 7 日の追加＋暫定）を 1 回読み、ブラウザーの中で比べる。
 */
export function SquadNewCardsPanel({ slots, inSquad }: { slots: SquadSlotForSuggestion[]; inSquad: ReadonlySet<string> }) {
  const t = useT();
  const { locale } = useLocale();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const [newCards, setNewCards] = useState<NewCard[] | null>(null);

  // 欄が画面に近づいたときだけ読む（編集を開くだけでは要求しない・2026-10-17）
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void fetchNewCardsOnce().then((cards) => {
        if (!cancelled) setNewCards(cards);
      });
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  const suggestions = useMemo(() => (newCards ? squadNewCardSuggestions(slots, newCards, inSquad) : []), [slots, newCards, inSquad]);
  if (!newCards || newCards.length === 0) return <div ref={sentinel} aria-hidden="true" data-testid="squad-new-cards-sentinel" />;
  const name = (c: ImpactCard) => resolvePlayerDisplayName(c, locale);
  const basis = (b: "max" | "base") => tp(b === "max" ? "impactBasisMax" : "impactBasisBase");

  return (
    <Surface padding="md" className="flex flex-col gap-2 text-sm" data-testid="squad-new-cards">
      <h2 className="font-semibold">{tp("squadSuggestHeading")}</h2>
      <p className="text-xs text-text-dim">{tp("squadSuggestIntro")}</p>
      {suggestions.length === 0 ? (
        <p className="text-xs text-text-muted" data-testid="squad-new-cards-none">
          {tp("squadSuggestNone")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border" data-testid="squad-new-cards-list">
          {suggestions.map((s) => (
            <li key={s.slotId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
              <span className="w-10 shrink-0 text-xs font-bold text-text-dim">{s.position}</span>
              <Link href={`/players/world/${s.suggestion.worldCardId}`} className="font-semibold text-accent hover:underline">
                {name(s.suggestion)}
              </Link>
              {(s.suggestion as NewCard).provisional ? <ProvisionalBadge /> : null}
              <span className="text-xs text-text-dim">
                {s.delta == null
                  ? tp("squadSuggestEmptySlotTemplate").replace("{basis}", basis(s.basis)).replace("{newOvr}", String(s.newOvr))
                  : tp("squadSuggestRowTemplate")
                      .replace("{basis}", basis(s.basis))
                      .replace("{newOvr}", String(s.newOvr))
                      .replace("{currentName}", s.current ? name(s.current) : "—")
                      .replace("{currentOvr}", String(s.currentOvr))
                      .replace("{delta}", String(s.delta))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/players/new" className="w-fit text-xs text-accent hover:underline">
        {tp("squadSuggestSeeAll")}
      </Link>
    </Surface>
  );
}
