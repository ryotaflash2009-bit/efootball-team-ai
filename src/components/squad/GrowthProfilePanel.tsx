"use client";

import { useMemo } from "react";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";
import type { DiagnosisHistoryEntry } from "@/lib/squad/diagnosis-history";
import { buildGrowthProfile, GROWTH_PROFILE_RULES_VERSION, type GrowthSquad } from "@/lib/squad/growth-profile";
import { diagnosisCategoryLabel } from "./SharedDiagnosisView";

type GKey = keyof Dictionary["growthProfile"];

/** 総合点の推移（0〜100）の小さな折れ線。読み上げは要約の文で行う。 */
function Sparkline({ points, label }: { points: number[]; label: string }) {
  const w = 120;
  const h = 32;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const d = points.map((p, i) => `${(i * step).toFixed(1)},${(h - (Math.max(0, Math.min(100, p)) / 100) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="shrink-0 text-accent">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * F-061 成長プロフィール（ブラウザー内）。診断履歴から、スカッドごとの総合点の推移と伸びたカテゴリを表示する。
 */
export function GrowthProfilePanel({ entries }: { entries: readonly DiagnosisHistoryEntry[] }) {
  const t = useT();
  const { locale } = useLocale();
  const g = (k: GKey) => t("growthProfile", k);
  const squads = useMemo(() => buildGrowthProfile(entries), [entries]);

  const summary = (s: GrowthSquad) =>
    g("trendTemplate")
      .replace("{count}", String(s.points.length))
      .replace("{first}", String(s.first))
      .replace("{latest}", String(s.latest))
      .replace("{delta}", `${s.delta > 0 ? "+" : ""}${s.delta}`);

  return (
    <section className="rounded-card border border-border bg-surface p-3" aria-labelledby="growth-profile-heading" data-testid="growth-profile">
      <h2 id="growth-profile-heading" className="text-sm font-semibold">
        {g("heading")}
      </h2>
      <p className="mt-0.5 text-2xs text-text-dim">{g("explanation")}</p>
      {squads.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted" data-testid="growth-profile-empty">
          {g("empty")}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {squads.map((s) => (
            <li key={s.squadId} className="rounded border border-border/60 p-2 text-xs" data-growth-squad>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate font-semibold" data-user-content>
                  {s.squadLabel}
                </p>
                <Sparkline points={s.points.map((p) => p.overall)} label={summary(s)} />
              </div>
              <p className="mt-1">
                <span className={s.delta > 0 ? "text-success" : s.delta < 0 ? "text-warning" : "text-text-dim"}>{summary(s)}</span>
              </p>
              {s.mostImproved ? (
                <p className="mt-0.5 text-text-dim">
                  {g("mostImprovedTemplate")
                    .replace("{category}", diagnosisCategoryLabel(s.mostImproved.categoryId, locale))
                    .replace("{from}", String(s.mostImproved.from))
                    .replace("{to}", String(s.mostImproved.to))}
                </p>
              ) : null}
              {s.overcameWeaknesses.length > 0 ? (
                <p className="mt-0.5 text-success">
                  {g("overcameTemplate").replace("{categories}", s.overcameWeaknesses.map((id) => diagnosisCategoryLabel(id, locale)).join(locale === "ja" ? "・" : ", "))}
                </p>
              ) : null}
              {s.excludedOtherRules > 0 ? <p className="mt-0.5 text-2xs text-text-muted">{g("excludedRulesTemplate").replace("{count}", String(s.excludedOtherRules))}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-2xs text-text-muted">{t("titles", "rulesVersionTemplate").replace("{version}", GROWTH_PROFILE_RULES_VERSION)}</p>
    </section>
  );
}
