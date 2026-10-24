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
import { POSITION_ORDER } from "@/lib/tier/own-tier";
import { useOwnedCards } from "@/lib/new-cards/use-owned-cards";

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
  lastImportAt = null,
  staleDays = null,
}: {
  cards: WorldPlayerCardData[];
  recent: WorldPlayerCardData[];
  recentDays: number;
  batches?: AddedBatch[];
  packCheckLimit?: number;
  /** このページに出ている最も新しいカードの追加時刻（「見た」の時刻にする）。 */
  latestAddedAt?: string | null;
  /** 正式なデータの最後の取り込みの時刻（7 日より前なら案内を出す）。 */
  lastImportAt?: string | null;
  /** 正式なデータの取り込みが止まっている日数（7 日より長いときだけ・サーバーで数える）。 */
  staleDays?: number | null;
}) {
  const t = useT();
  const { displayLocale } = useLocale();
  // このページを開いたら「見た」にする（サイドメニューの件数を 0 に戻す）
  useEffect(() => {
    if (latestAddedAt) markNewCardsSeen(new Date(latestAddedAt));
  }, [latestAddedAt]);
  const tp = (k: Parameters<typeof t<"provisionalCards">>[1]) => t("provisionalCards", k);
  usePageTitle(tp("newCardsPageTitle"));
  // ポジションで絞る（2026-10-25）。チームへの影響は絞らない全体で出す。保存はしない（ページの中だけ）。
  const [position, setPosition] = useState<string | null>(null);
  // ?position=CF で開いたら、そのポジションで絞った状態にする（My Team のまとめからのリンク・2026-10-25）。
  // ISR のページのため useSearchParams は使わず、描画のあとに URL を読む（サーバーの HTML と食い違わない）。
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("position");
    if (p && POSITION_ORDER.includes(p)) setPosition(p);
  }, []);
  // まだ持っていないカードだけ（My Team の「所持」を除く・2026-10-25）。所持のカードが無ければボタンを出さない。
  const [unownedOnly, setUnownedOnly] = useState(false);
  const { ownedIds } = useOwnedCards();
  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);
  const positionCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of [...recent, ...cards]) if (c.registeredPosition) m.set(c.registeredPosition, (m.get(c.registeredPosition) ?? 0) + 1);
    return POSITION_ORDER.filter((p) => m.has(p)).map((p) => ({ position: p, count: m.get(p) ?? 0 }));
  }, [recent, cards]);
  const inPosition = (c: WorldPlayerCardData) => (position == null || c.registeredPosition === position) && !(unownedOnly && ownedSet.has(c.worldCardId));
  const shownRecent = useMemo(() => recent.filter(inPosition), [recent, position, unownedOnly, ownedSet]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownCards = useMemo(() => cards.filter(inPosition), [cards, position, unownedOnly, ownedSet]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtering = position != null || unownedOnly;
  const ownedAmongNew = useMemo(() => [...recent, ...cards].some((c) => ownedSet.has(c.worldCardId)), [recent, cards, ownedSet]);
  // 日ごとに並べる（日付の無いものは最後に「その他」として 1 つ）
  const dayGroups = useMemo(() => {
    const byId = new Map(shownRecent.map((c) => [c.worldCardId, c]));
    const used = new Set<string>();
    const groups: DayGroupData[] = batches.flatMap((b) => {
      const list = b.allIds.map((id) => byId.get(id)).filter((c): c is WorldPlayerCardData => c != null);
      list.forEach((c) => used.add(c.worldCardId));
      if (list.length === 0) return [];
      return [{ key: b.date, title: fillMessage(tp("batchRowTemplate"), { date: formatDate(new Date(`${b.date}T12:00:00+09:00`), displayLocale), count: String(filtering ? list.length : b.count) }), cards: list, packCheckIds: b.ids, truncated: b.truncated }];
    });
    const rest = shownRecent.filter((c) => !used.has(c.worldCardId));
    if (rest.length > 0) groups.push({ key: "rest", title: null, cards: rest, packCheckIds: [], truncated: false });
    return groups;
    // tp は辞書の参照（locale で変わる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownRecent, batches, displayLocale, t]);
  const recentSection = (
    <section className="flex flex-col gap-3" data-testid="recently-added">
      <SectionHeader title={tp("recentHeadingTemplate").replace("{days}", String(recentDays)).replace("{count}", String(shownRecent.length))} as="h2" />
      <p className="text-xs text-text-dim">{tp("recentIntro")}</p>
      {shownRecent.length === 0 ? (
        <Surface padding="md" className="text-sm text-text-dim" data-testid="recently-added-empty">
          {filtering ? tp("filterEmpty") : tp("recentEmpty")}
        </Surface>
      ) : (
        dayGroups.map((g) => <DayGroup key={g.key} group={g} packCheckLimit={packCheckLimit} />)
      )}
    </section>
  );
  const provisionalSection = (
    <section className="flex flex-col gap-3">
      <SectionHeader title={tp("provisionalHeading")} as="h2" />
      {shownCards.length === 0 ? (
        <p className="text-xs text-text-muted" data-testid="provisional-cards-empty">
          {filtering ? tp("filterEmpty") : tp("newCardsEmpty")}
        </p>
      ) : (
        <>
          <Surface tone="outline" padding="sm" className="text-xs text-text-dim">
            <p>{tp("noticeBody")}</p>
            <p className="mt-1">{tp("maxLevelUnknown")}</p>
          </Surface>
          <ul className={GRID} data-testid="provisional-cards-grid">
            {shownCards.map((c) => (
              <li key={c.worldCardId}>
                <WorldPlayerCard player={c} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
  // 正式なデータの追加が無い間（取得元の停止など）は、暫定のカードを先に出す（2026-10-24）
  const provisionalFirst = recent.length === 0 && cards.length > 0;

  return (
    <div className="flex flex-col gap-5" data-testid="provisional-cards">
      <PageHeader title={tp("newCardsPageTitle")} icon="players" description={tp("newCardsIntro")} />
      <GlossaryLink anchor="provisional-card" />
      {staleDays != null ? (
        <Surface tone="outline" padding="sm" className="border-warning/50 text-xs text-text-dim" data-testid="official-data-stale">
          {fillMessage(tp("staleNoticeTemplate"), { days: String(staleDays), date: formatDate(new Date(lastImportAt as string), displayLocale) })}
        </Surface>
      ) : null}

      <NewCardsTeamImpact newCards={[...recent, ...cards]} />

      {ownedAmongNew ? (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-text-dim">
          <input type="checkbox" checked={unownedOnly} onChange={(e) => setUnownedOnly(e.target.checked)} data-testid="new-cards-unowned-only" />
          {tp("unownedOnlyLabel")}
        </label>
      ) : null}

      {positionCounts.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={tp("positionFilterLabel")} data-testid="new-cards-position-filter">
          {[{ position: null as string | null, count: recent.length + cards.length }, ...positionCounts].map((o) => {
            const active = o.position === position;
            return (
              <button
                key={o.position ?? "all"}
                type="button"
                aria-pressed={active}
                data-position={o.position ?? "all"}
                onClick={() => setPosition(o.position)}
                className={`min-h-[32px] rounded-full border px-3 text-xs ${active ? "border-accent bg-accent/15 font-semibold text-accent" : "border-border text-text-dim hover:bg-surface-2"}`}
              >
                {o.position ?? tp("positionFilterAll")} <span className="tabular-nums text-text-muted">{o.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {provisionalFirst ? provisionalSection : recentSection}

      {provisionalFirst ? recentSection : provisionalSection}
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
