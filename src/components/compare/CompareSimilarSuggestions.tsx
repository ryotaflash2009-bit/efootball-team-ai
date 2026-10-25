"use client";

import "@/lib/i18n/dictionaries/ja-ns/comparisonBoard";
import { useEffect, useState } from "react";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { useMyTeam } from "@/lib/user-cards/hooks";
import "@/lib/i18n/dictionaries/ja-ns/worldPlayerCard";
import { pickSimilarCards, similarCardsQuery, type SimilarCardSummary } from "@/lib/world/similar-cards";

const SUGGEST_LIMIT = 4;

/**
 * 比較が 1 枚のときの「似ているカードを追加」（2026-10-25）。同じポジション・同じプレースタイル・最大 OVR ±3（同じ選手は除く）。
 * 押すと比較に追加する（既存の追加と同じ処理）。見つからなければ何も出さない。
 */
export function CompareSimilarSuggestions({
  base,
  onAdd,
}: {
  base: { worldCardId: string; registeredPosition: string | null; playingStyle: string | null; ovrMax: number | null };
  onAdd: (worldCardId: string) => Promise<boolean>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [cards, setCards] = useState<SimilarCardSummary[] | null>(null);
  const { getByWorldId } = useMyTeam();
  const isOwned = (id: string) => { const r = getByWorldId(id); return !!r && r.ownershipStatus === "owned" && !r.deletedAt; };
  const [busy, setBusy] = useState<string | null>(null);
  const qs = similarCardsQuery(base);
  const { worldCardId, ovrMax } = base;
  useEffect(() => {
    if (!qs || ovrMax == null) {
      setCards([]);
      return;
    }
    const controller = new AbortController();
    (async () => {
      const res = await fetch(`/api/world/players?${qs}`, { signal: controller.signal });
      const json = res.ok ? ((await res.json()) as { players?: unknown[] }) : {};
      setCards(pickSimilarCards(worldCardId, ovrMax, json.players ?? [], SUGGEST_LIMIT));
    })().catch(() => {
      if (!controller.signal.aborted) setCards([]);
    });
    return () => controller.abort();
  }, [worldCardId, qs, ovrMax]);

  if (!cards || cards.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3" data-testid="compare-similar-suggestions">
      <h2 className="text-sm font-semibold">{t("comparisonBoard", "similarSuggestHeading")}</h2>
      <p className="text-2xs text-text-dim">{t("comparisonBoard", "similarSuggestHint")}</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.worldCardId}>
            <button
              type="button"
              disabled={busy != null}
              onClick={async () => {
                setBusy(c.worldCardId);
                await onAdd(c.worldCardId);
                setBusy(null);
              }}
              className="flex w-full items-center justify-between gap-2 rounded border border-border/60 p-2 text-start text-sm hover:border-accent disabled:opacity-60"
              data-world-card-id={c.worldCardId}
            >
              <span className="min-w-0 truncate">{resolvePlayerDisplayName({ nameEn: c.nameEn, nameJa: c.nameJa }, locale, c.worldCardId)}</span>
              <span className="shrink-0 text-xs text-text-muted">
                {isOwned(c.worldCardId) ? <span className="me-1 rounded bg-success/90 px-1 text-[9px] font-bold text-black" data-testid="similar-owned">{t("worldPlayerCard", "ownedBadge")}</span> : null}
                {c.cardType ?? "—"} · {c.ovrMax ?? "—"} <span className="text-accent">＋</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
