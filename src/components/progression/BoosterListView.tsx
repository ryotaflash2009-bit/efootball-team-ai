"use client";

import "@/lib/i18n/dictionaries/ja-ns/boosterList";
import { fillMessage } from "@/lib/i18n/message-format";
import "@/lib/i18n/dictionaries/ja-ns/abilityEditor";

import { useMemo, useState } from "react";
import { BOOSTER_CATALOG_VERSION, type BoosterEvidenceLevel } from "@/lib/progression/booster-catalog";
import { boosterStats, buildBoosterList } from "@/lib/progression/booster-list";
import { abilityName } from "@/lib/progression/ability-editor-labels";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { usePageTitle } from "@/lib/i18n/use-page-title";

type BKey = keyof Dictionary["boosterList"];
const EVIDENCE_TONE: Record<BoosterEvidenceLevel, "success" | "info" | "warning" | "outline"> = {
  game_client_verified: "success",
  screenshot_verified: "success",
  external_cross_verified: "info",
  effect_provisional: "warning",
  conditional_unverified: "outline",
};

/** ブースター一覧（NEW-24・2026-10-07）。カタログの効果と証拠の段階をそのまま表示する（新しい判定はしない）。 */
export function BoosterListView() {
  const t = useT();
  // 日本語以外の表示言語では、タブの題名も表示言語にする（2026-10-07）。
  usePageTitle(t("boosterList", "pageTitle"));
  const { displayLocale } = useLocale();
  const b = (k: BKey) => t("boosterList", k);
  const [query, setQuery] = useState("");
  const [stat, setStat] = useState("");
  const groups = useMemo(() => buildBoosterList({ stat: stat || null, query }), [stat, query]);
  const stats = useMemo(() => boosterStats().map((k) => ({ key: k, label: abilityName(k, displayLocale) })).sort((x, y) => x.label.localeCompare(y.label, displayLocale)), [displayLocale]);
  const total = groups.reduce((n, g) => n + g.boosters.length, 0);
  const category = (c: string) => b(c === "special" ? "categorySpecial" : c === "single" ? "categorySingle" : "categoryStandard");

  return (
    <div className="flex flex-col gap-4" data-testid="booster-list">
      <PageHeader title={b("heading")} description={b("intro")} meta={fillMessage(b("countTemplate"), { count: String(total) })} />
      <p className="text-2xs text-text-muted">{b("nameNote")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-dim">{b("searchLabel")}</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={b("searchPlaceholder")} className="min-h-[44px] rounded-md border border-border bg-surface px-3 text-sm" maxLength={60} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-dim">{b("abilityFilterLabel")}</span>
          <select value={stat} onChange={(e) => setStat(e.target.value)} className="min-h-[44px] rounded-md border border-border bg-surface px-3 text-sm">
            <option value="">{b("abilityFilterAll")}</option>
            {stats.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-text-muted" role="status">
          {b("empty")}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.level} className="flex flex-col gap-2" aria-labelledby={`booster-level-${g.level}`}>
            <h2 id={`booster-level-${g.level}`} className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <Badge tone={EVIDENCE_TONE[g.level]} size="xs">
                {b(`evidence_${g.level}` as BKey)}
              </Badge>
              <span className="text-text-dim">{fillMessage(b("countTemplate"), { count: String(g.boosters.length) })}</span>
            </h2>
            <p className="text-2xs text-text-muted">{b(`evidenceNote_${g.level}` as BKey)}</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.boosters.map((x) => (
                <li key={x.key} className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface p-2.5 text-xs" data-booster={x.key}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words font-semibold" lang="en">
                      {x.nameEn}
                    </span>
                    <span className="shrink-0 tabular-nums text-accent">{b("maxLevelTemplate").replace("{level}", String(x.maxLevel))}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="outline" size="xs">
                      {category(x.category)}
                    </Badge>
                    {x.conditional ? (
                      <Badge tone="warning" size="xs">
                        {b("conditionalBadge")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-text-dim">{x.affectedStats.map((k) => abilityName(k, displayLocale)).join(" / ")}</p>
                  {x.conditional && x.conditionEvaluable === false ? <p className="text-2xs text-warning">{b("conditionNotEvaluable")}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="text-2xs text-text-muted">{b("versionTemplate").replace("{version}", BOOSTER_CATALOG_VERSION)}</p>
    </div>
  );
}
