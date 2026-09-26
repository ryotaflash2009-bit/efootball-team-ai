"use client";

import { Badge } from "@/components/ui/Badge";
import { tierBadgeTone } from "./diagnosis-tier-style";
import { diagnosisCategoryLabel } from "./SharedDiagnosisView";
import type { DiagnosisComparison, ScoreChange, Trend } from "@/lib/squad/diagnosis-compare";
import type { ShareFinding } from "@/lib/squad/squad-diagnosis-share-url";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type CompareKey = keyof Dictionary["diagnosisCompare"];

export function useCompareTexts(): { c: (k: CompareKey) => string; trend: Record<Trend, string> } {
  const t = useT();
  const c = (k: CompareKey): string => t("diagnosisCompare", k);
  const trend: Record<Trend, string> = {
    improved: c("trendImproved"),
    worsened: c("trendWorsened"),
    unchanged: c("trendUnchanged"),
    not_comparable: c("trendNotComparable"),
  };
  return { c, trend };
}

const TREND_CLASS: Record<Trend, string> = {
  improved: "text-success",
  worsened: "text-danger",
  unchanged: "text-text-dim",
  not_comparable: "text-text-muted",
};
const TREND_MARK: Record<Trend, string> = { improved: "▲", worsened: "▼", unchanged: "＝", not_comparable: "—" };

function delta(ch: ScoreChange): string {
  if (ch.delta == null) return "—";
  return ch.delta > 0 ? `+${ch.delta}` : ch.delta < 0 ? `−${Math.abs(ch.delta)}` : "±0";
}

/**
 * 改善前後の比較カード（F-043）。差だけを示し、原因は判定しない（免責を常に表示）。
 * 変化は色だけでなく記号と文字（改善/悪化/変化なし/比較不可）でも示す。内部ID・名前は表示しない。
 */
export function DiagnosisComparisonCard({ comparison }: { comparison: DiagnosisComparison }) {
  const { locale } = useLocale();
  const t = useT();
  const { c, trend } = useCompareTexts();
  const score = (s: number | null, tier: ScoreChange["beforeTier"]) =>
    s == null ? (
      <span className="text-text-muted">{c("notRated")}</span>
    ) : (
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold tabular-nums">{s}</span>
        <Badge tone={tierBadgeTone(tier)} size="xs">
          {tier}
        </Badge>
      </span>
    );
  const findingText = (f: ShareFinding | null, strong: boolean): string => {
    if (!f) return t("diagnosisShare", "none");
    const [kind, cat] = f;
    if (kind === "ability" && cat) return t("diagnosisShare", strong ? "findingAbilityHigh" : "findingAbilityLow").replace("{category}", diagnosisCategoryLabel(cat, locale));
    if (kind === "compatibility") return t("diagnosisShare", "findingCompatibility");
    if (kind === "referenceError") return t("diagnosisShare", "findingReferenceError");
    return t("diagnosisShare", "findingConfig");
  };
  const k = comparison.counts;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-label={c("title")} data-compare-card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{c("title")}</h2>
        <p className="text-xs text-text-dim" data-compare-dates>
          {c("before")} {comparison.beforeDate} → {c("after")} {comparison.afterDate}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2/50 p-3" data-compare-overall>
        <span className="text-sm font-semibold">{c("overall")}</span>
        <span className="flex items-center gap-2 text-sm">
          {score(comparison.overall.before, comparison.overall.beforeTier)}
          <span aria-hidden>→</span>
          {score(comparison.overall.after, comparison.overall.afterTier)}
          <span className={`font-bold ${TREND_CLASS[comparison.overall.trend]}`}>
            {TREND_MARK[comparison.overall.trend]} {delta(comparison.overall)} {trend[comparison.overall.trend]}
          </span>
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-border/50 text-xs">
        {comparison.categories.map(({ id, change }) => (
          <li key={id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2" data-compare-row={change.trend}>
            <span className="min-w-[8rem] text-text-dim">{diagnosisCategoryLabel(id, locale)}</span>
            <span className="flex items-center gap-2">
              {score(change.before, change.beforeTier)}
              <span aria-hidden>→</span>
              {score(change.after, change.afterTier)}
              <span className={`min-w-[7rem] text-right font-semibold ${TREND_CLASS[change.trend]}`}>
                {TREND_MARK[change.trend]} {delta(change)} {trend[change.trend]}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-text-dim" data-compare-summary>
        {c("summaryTemplate")
          .replace("{improved}", String(k.improved))
          .replace("{worsened}", String(k.worsened))
          .replace("{unchanged}", String(k.unchanged))
          .replace("{notComparable}", String(k.notComparable))}
      </p>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        {([
          ["strengthHeading", comparison.strength, true],
          ["weaknessHeading", comparison.weakness, false],
        ] as const).map(([key, f, strong]) => (
          <div key={key} className="rounded-md border border-border/60 p-2">
            <p className="font-semibold">
              {c(key)}（{f.changed ? c("changed") : c("notChanged")}）
            </p>
            <p className="mt-1 text-text-dim">
              {c("before")}: {findingText(f.before, strong)}
            </p>
            <p className="text-text-dim">
              {c("after")}: {findingText(f.after, strong)}
            </p>
          </div>
        ))}
      </div>

      <p className="text-2xs text-text-muted">{c("disclaimer")}</p>
    </section>
  );
}
