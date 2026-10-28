"use client";

import "@/lib/i18n/dictionaries/ja-ns/playerDetailPage";
import "@/lib/i18n/dictionaries/ja-ns/worldPlayerCard";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { Surface } from "@/components/ui/Surface";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { personKeyOf } from "@/lib/world/person-identity";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { otherCardsOfSamePlayer, type OtherCardSummary } from "@/lib/world/same-player-cards";
import { useMyTeam } from "@/lib/user-cards/hooks";
import { fetchJsonRetry } from "@/lib/fetch-json-retry";

/**
 * 同じ選手の別のカード（2026-10-11）。同じ選手かどうかはカード ID の下位 20 ビット（人物のキー）で決める。
 * 候補は英語名の検索で絞り、人物のキーで確定する（名前だけで同じ選手と判定しない）。監査では、同じキーのカードは名前が同じ
 * （食い違い 0）なので、英語名で絞っても取りこぼしは無い。最大 3 ページ（300 件）まで読む。
 * My Team で「所持」のカードには印を付ける（似たカードと同じ・2026-10-25）。
 */
export function SamePlayerOtherCards({ worldCardId, nameEn }: { worldCardId: string; nameEn: string | null }) {
  const t = useT();
  const { locale } = useLocale();
  const [cards, setCards] = useState<OtherCardSummary[] | null>(null);
  const { getByWorldId } = useMyTeam();
  const isOwned = (id: string) => { const r = getByWorldId(id); return !!r && r.ownershipStatus === "owned" && !r.deletedAt; };
  useEffect(() => {
    const key = personKeyOf(worldCardId);
    const name = (nameEn ?? "").trim();
    if (!key || !name) {
      setCards([]);
      return;
    }
    const controller = new AbortController();
    (async () => {
      const found: unknown[] = [];
      for (let page = 1; page <= 3; page++) {
        const json = await fetchJsonRetry<{ players?: unknown[]; hasNext?: boolean }>(`/api/world/players?q=${encodeURIComponent(name)}&pageSize=100&page=${page}`, { signal: controller.signal });
        if (!json) break;
        found.push(...(json.players ?? []));
        if (!json.hasNext) break;
      }
      setCards(otherCardsOfSamePlayer(worldCardId, found));
    })().catch(() => {
      if (!controller.signal.aborted) setCards([]);
    });
    return () => controller.abort();
  }, [worldCardId, nameEn]);

  if (!cards || cards.length === 0) return null;
  return (
    <Surface data-testid="same-player-other-cards">
      <SectionHeader title={t("playerDetailPage", "samePlayerOtherCardsHeadingTemplate").replace("{count}", String(cards.length))} as="h2" hint={t("playerDetailPage", "samePlayerOtherCardsHint")} />
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.worldCardId}>
            <Link href={`/players/world/${c.worldCardId}`} className="flex items-center justify-between gap-2 rounded border border-border/60 p-2 text-sm hover:border-accent">
              <span className="min-w-0 truncate">
                {isOwned(c.worldCardId) ? <span className="me-1 rounded bg-success/90 px-1 text-[9px] font-bold text-black" data-testid="same-player-owned">{t("worldPlayerCard", "ownedBadge")}</span> : null}
                {resolvePlayerDisplayName({ nameEn: c.nameEn, nameJa: c.nameJa }, locale, c.worldCardId)}
              </span>
              <span className="shrink-0 text-xs text-text-muted">
                {c.cardType ?? "—"} · {c.ovrMax ?? "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
