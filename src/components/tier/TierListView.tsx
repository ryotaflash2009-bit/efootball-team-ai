"use client";

import { GlossaryLink } from "@/components/public-info/GlossaryLink";
import "@/lib/i18n/dictionaries/ja-ns/tierList";
import Link from "next/link";
import { useState } from "react";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { fillMessage } from "@/lib/i18n/message-format";
import { resolvePlayerDisplayName } from "@/lib/i18n/display-name";
import { PageHeader } from "@/components/ui/PageHeader";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { usePageTitle } from "@/lib/i18n/use-page-title";
import { OWN_TIER_RULES_VERSION, type OwnTierRank } from "@/lib/tier/own-tier";

export interface TierListEntryView {
  worldCardId: string;
  nameJa: string | null;
  nameEn: string | null;
  cardType: string | null;
  ovrMax: number | null;
  tier: OwnTierRank;
  rank: number;
  topPercent: number;
  /** 最近 7 日に追加されたカード（サーバーで判定・2026-10-24）。 */
  isNew?: boolean;
}

const TIERS: OwnTierRank[] = ["S", "A", "B", "C"];
const TIER_TONE: Record<OwnTierRank, "accent" | "success" | "info" | "neutral"> = { S: "accent", A: "success", B: "info", C: "neutral" };

/** F-090 ポジション別 Tier（自前のデータ・最大 OVR の順位・2026-10-14）。 */
export function TierListView({
  positions,
  position,
  population,
  entries,
  unavailableReason,
  syncFinishedAt,
}: {
  positions: string[];
  position: string;
  population: number;
  entries: TierListEntryView[];
  unavailableReason: "too_few_cards" | "not_sorted" | null;
  syncFinishedAt: string | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tt = (k: Parameters<typeof t<"tierList">>[1]) => t("tierList", k);
  usePageTitle(tt("pageTitle"));

  return (
    <div className="flex flex-col gap-4" data-testid="tier-list">
      <PageHeader title={tt("heading")} icon="tier" description={tt("intro")} />
      <Surface tone="outline" padding="md" className="flex flex-col gap-1 text-xs text-text-dim" data-testid="tier-rules">
        <p>{tt("rulesBody")}</p>
        <p className="font-semibold text-text">{tt("notStrengthNotice")}</p>
        <GlossaryLink anchor="tier" />
        <p className="text-2xs text-text-muted">
          {fillMessage(tt("sourceTemplate"), { version: OWN_TIER_RULES_VERSION, date: syncFinishedAt ? syncFinishedAt.slice(0, 10) : "—" })}
        </p>
      </Surface>

      <nav aria-label={tt("positionNavLabel")} className="flex flex-wrap gap-1.5" data-testid="tier-positions">
        {positions.map((p) => (
          <Link
            key={p}
            href={`/tier/${p}`}
            aria-current={p === position ? "page" : undefined}
            className={`rounded-md border px-2.5 py-1 text-xs ${p === position ? "border-accent bg-accent/10 font-semibold text-accent" : "border-border text-text-dim hover:border-accent/50"}`}
          >
            {p}
          </Link>
        ))}
      </nav>

      <p className="text-xs text-text-muted" data-testid="tier-population">
        {fillMessage(tt("populationTemplate"), { position, count: String(population) })}
      </p>

      {unavailableReason ? (
        <Surface padding="md" className="text-sm text-text-dim" data-testid="tier-unavailable">
          {tt("tooFewCards")}
        </Surface>
      ) : (
        TIERS.map((tier) => {
          const list = entries.filter((e) => e.tier === tier);
          if (list.length === 0) return null;
          return <TierBlock key={tier} tier={tier} list={list} />;
        })
      )}
    </div>
  );
}

export function TierListUnavailableView() {
  const t = useT();
  return (
    <div className="flex flex-col gap-4" data-testid="tier-list">
      <PageHeader title={t("tierList", "heading")} icon="tier" description={t("tierList", "intro")} />
      <Surface padding="md" className="text-sm text-text-dim" data-testid="tier-data-unavailable">
        {t("tierList", "dataUnavailable")}
      </Surface>
    </div>
  );
}

/** 1 つの区分で最初に見せる行数（残りは「残り N 件を表示」・2026-10-18 画面の整理）。リンクは検索エンジンのため HTML に残し、見た目だけ隠す。 */
const TIER_INITIAL = 20;

function TierBlock({ tier, list }: { tier: OwnTierRank; list: TierListEntryView[] }) {
  const t = useT();
  const { locale } = useLocale();
  const tt = (k: Parameters<typeof t<"tierList">>[1]) => t("tierList", k);
  const [all, setAll] = useState(false);
  const hidden = all ? 0 : Math.max(0, list.length - TIER_INITIAL);
  return (
    <Surface padding="md" className="flex flex-col gap-2" data-testid={`tier-${tier}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Badge tone={TIER_TONE[tier]} size="sm">
          {tier}
        </Badge>
        <span className="text-text-dim">{tt(`tierRange${tier}` as Parameters<typeof t<"tierList">>[1])}</span>
      </h2>
      <ol className="grid gap-1 sm:grid-cols-2">
        {list.map((e, i) => (
          <li key={e.worldCardId} className={`flex items-baseline justify-between gap-2 border-b border-border/60 py-1 text-xs ${!all && i >= TIER_INITIAL ? "hidden" : ""}`}>
            <Link href={`/players/world/${e.worldCardId}`} className="min-w-0 truncate text-accent hover:underline">
              {resolvePlayerDisplayName(e, locale)}
              {e.cardType ? <span className="ms-1 text-text-muted">· {e.cardType}</span> : null}
              {e.isNew ? (
                <span className="ms-1 rounded bg-accent px-1 text-[9px] font-black text-accent-ink" data-testid="tier-new-badge">
                  NEW
                </span>
              ) : null}
            </Link>
            <span className="shrink-0 tabular-nums text-text-dim">
              {fillMessage(tt("entryTemplate"), { ovr: String(e.ovrMax ?? "—"), rank: String(e.rank), pct: String(e.topPercent) })}
            </span>
          </li>
        ))}
      </ol>
      {hidden > 0 ? (
        <button type="button" className="w-fit rounded-md border border-border px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2" onClick={() => setAll(true)} data-testid="tier-show-more">
          {fillMessage(tt("showMoreTemplate"), { count: String(hidden) })}
        </button>
      ) : null}
    </Surface>
  );
}
