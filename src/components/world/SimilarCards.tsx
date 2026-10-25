"use client";

import "@/lib/i18n/dictionaries/ja-ns/playerDetailPage";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { useMyTeam } from "@/lib/user-cards/hooks";
import "@/lib/i18n/dictionaries/ja-ns/worldPlayerCard";
import { pickSimilarCards, similarCardsQuery, type SimilarCardSummary } from "@/lib/world/similar-cards";

/**
 * 似ているカード（2026-10-25）。同じ登録ポジション・同じプレースタイル・最大 OVR が ±3 のカード（同じ選手の別のカードは除く）。
 * 代わりの選手を探すとき用。見つからなければ何も出さない。「もっと見る」は同じ条件の選手の一覧へ。
 */
export function SimilarCards({
  worldCardId,
  registeredPosition,
  playingStyle,
  ovrMax,
}: {
  worldCardId: string;
  registeredPosition: string | null;
  playingStyle: string | null;
  ovrMax: number | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [cards, setCards] = useState<SimilarCardSummary[] | null>(null);
  const { getByWorldId } = useMyTeam();
  const isOwned = (id: string) => { const r = getByWorldId(id); return !!r && r.ownershipStatus === "owned" && !r.deletedAt; };
  const qs = similarCardsQuery({ registeredPosition, playingStyle, ovrMax });
  useEffect(() => {
    if (!qs || ovrMax == null) {
      setCards([]);
      return;
    }
    const controller = new AbortController();
    (async () => {
      const res = await fetch(`/api/world/players?${qs}`, { signal: controller.signal });
      const json = res.ok ? ((await res.json()) as { players?: unknown[] }) : {};
      setCards(pickSimilarCards(worldCardId, ovrMax, json.players ?? []));
    })().catch(() => {
      if (!controller.signal.aborted) setCards([]);
    });
    return () => controller.abort();
  }, [worldCardId, qs, ovrMax]);

  if (!cards || cards.length === 0 || !qs) return null;
  const more = new URLSearchParams(qs);
  more.delete("pageSize");
  return (
    <Surface data-testid="similar-cards">
      <SectionHeader title={t("playerDetailPage", "similarCardsHeading")} as="h2" hint={t("playerDetailPage", "similarCardsHint")} />
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.worldCardId} className="flex items-stretch gap-1">
            <Link href={`/players/world/${c.worldCardId}`} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded border border-border/60 p-2 text-sm hover:border-accent">
              <span className="min-w-0 truncate">{resolvePlayerDisplayName({ nameEn: c.nameEn, nameJa: c.nameJa }, locale, c.worldCardId)}</span>
              <span className="shrink-0 text-xs text-text-muted">
                {isOwned(c.worldCardId) ? <span className="me-1 rounded bg-success/90 px-1 text-[9px] font-bold text-black" data-testid="similar-owned">{t("worldPlayerCard", "ownedBadge")}</span> : null}
                {c.cardType ?? "—"} · {c.ovrMax ?? "—"}
              </span>
            </Link>
            <Link
              href={`/compare?ids=${worldCardId},${c.worldCardId}`}
              className="flex shrink-0 items-center rounded border border-border/60 px-2 text-xs text-accent hover:border-accent"
              data-testid="similar-cards-compare"
            >
              {t("playerDetailPage", "similarCardsCompare")}
            </Link>
          </li>
        ))}
      </ul>
      <Link href={`/players?${more.toString()}`} className="mt-2 inline-block text-xs text-accent hover:underline" data-testid="similar-cards-more">
        {t("playerDetailPage", "similarCardsMore")}
      </Link>
    </Surface>
  );
}
