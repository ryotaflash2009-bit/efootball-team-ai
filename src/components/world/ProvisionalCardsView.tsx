"use client";

import { GlossaryLink } from "@/components/public-info/GlossaryLink";
import "@/lib/i18n/dictionaries/ja-ns/provisionalCards";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { markNewCardsSeen } from "@/lib/new-cards/seen";
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
/** 日ごとに最初に出す枚数（残りは「残り N 枚を表示」・2026-10-17 画面の整理）。 */
const DAY_INITIAL = 12;

/** 新しいカード（2026-10-15 暫定・2026-10-17 最近追加された正式なカード）。 */
export function ProvisionalCardsView({
  cards,
  recent,
  recentDays,
  batches = [],
  packCheckLimit = 30,
  latestAddedAt = null,
}: {
  cards: WorldPlayerCardData[];
  recent: WorldPlayerCardData[];
  recentDays: number;
  batches?: AddedBatch[];
  packCheckLimit?: number;
  /** このページに出ている最も新しいカードの追加時刻（「見た」の時刻にする）。 */
  latestAddedAt?: string | null;
}) {
  const t = useT();
  const { displayLocale } = useLocale();
  // このページを開いたら「見た」にする（サイドメニューの件数を 0 に戻す）
  useEffect(() => {
    if (latestAddedAt) markNewCardsSeen(new Date(latestAddedAt));
  }, [latestAddedAt]);
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  usePageTitle(tp("newCardsPageTitle"));
  // 日ごとに並べる（日付の無いものは最後に「その他」として 1 つ）
  const dayGroups = useMemo(() => {
    const byId = new Map(recent.map((c) => [c.worldCardId, c]));
    const used = new Set<string>();
    const groups: DayGroupData[] = batches.map((b) => {
      const list = b.allIds.map((id) => byId.get(id)).filter((c): c is WorldPlayerCardData => c != null);
      list.forEach((c) => used.add(c.worldCardId));
      return { key: b.date, title: fillMessage(tp("batchRowTemplate"), { date: formatDate(new Date(`${b.date}T12:00:00+09:00`), displayLocale), count: String(b.count) }), cards: list, packCheckIds: b.ids, truncated: b.truncated };
    });
    const rest = recent.filter((c) => !used.has(c.worldCardId));
    if (rest.length > 0) groups.push({ key: "rest", title: null, cards: rest, packCheckIds: [], truncated: false });
    return groups;
    // tp は辞書の参照（locale で変わる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent, batches, displayLocale, t]);
  return (
    <div className="flex flex-col gap-5" data-testid="provisional-cards">
      <PageHeader title={tp("newCardsPageTitle")} icon="players" description={tp("newCardsIntro")} />
      <GlossaryLink anchor="provisional-card" />

      <NewCardsTeamImpact newCards={[...recent, ...cards]} />

      <section className="flex flex-col gap-3" data-testid="recently-added">
        <SectionHeader title={tp("recentHeadingTemplate").replace("{days}", String(recentDays)).replace("{count}", String(recent.length))} as="h2" />
        <p className="text-xs text-text-dim">{tp("recentIntro")}</p>
        {recent.length === 0 ? (
          <Surface padding="md" className="text-sm text-text-dim" data-testid="recently-added-empty">
            {tp("recentEmpty")}
          </Surface>
        ) : (
          dayGroups.map((g) => <DayGroup key={g.key} group={g} packCheckLimit={packCheckLimit} />)
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title={tp("provisionalHeading")} as="h2" />
        {cards.length === 0 ? (
          <p className="text-xs text-text-muted" data-testid="provisional-cards-empty">
            {tp("newCardsEmpty")}
          </p>
        ) : (
          <>
            <Surface tone="outline" padding="sm" className="text-xs text-text-dim">
              <p>{tp("noticeBody")}</p>
              <p className="mt-1">{tp("maxLevelUnknown")}</p>
            </Surface>
            <ul className={GRID} data-testid="provisional-cards-grid">
              {cards.map((c) => (
                <li key={c.worldCardId}>
                  <WorldPlayerCard player={c} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

interface DayGroupData {
  key: string;
  title: string | null;
  cards: WorldPlayerCardData[];
  packCheckIds: string[];
  truncated: boolean;
}

/** 追加された日の見出し（枚数・パック診断へ）と、その日のカード（最初の 12 枚・残りはボタンで）。 */
function DayGroup({ group, packCheckLimit }: { group: DayGroupData; packCheckLimit: number }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  const [all, setAll] = useState(false);
  const shown = all ? group.cards : group.cards.slice(0, DAY_INITIAL);
  const hidden = group.cards.length - shown.length;
  return (
    <div className="flex flex-col gap-2" data-testid="added-day">
      {group.title ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-1.5">
          <h3 className="text-sm font-semibold">{group.title}</h3>
          {group.packCheckIds.length > 0 ? (
            <Link href={`/pack-check?ids=${group.packCheckIds.join(",")}`} className="text-xs text-accent hover:underline" data-testid="added-batch-pack-check">
              {tp("batchOpenPackCheck")}
            </Link>
          ) : null}
          {group.truncated ? <span className="text-2xs text-text-muted">{fillMessage(tp("batchTruncatedTemplate"), { limit: String(packCheckLimit) })}</span> : null}
        </div>
      ) : null}
      <ul className={GRID} data-testid="recently-added-grid">
        {shown.map((c) => (
          <li key={c.worldCardId}>
            <WorldPlayerCard player={c} />
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <button type="button" className="w-fit rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2" onClick={() => setAll(true)} data-testid="added-day-more">
          {fillMessage(tp("showMoreCardsTemplate"), { count: String(hidden) })}
        </button>
      ) : null}
    </div>
  );
}
