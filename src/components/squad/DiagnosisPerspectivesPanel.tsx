"use client";

import "@/lib/i18n/dictionaries/ja-ns/diagnosisPerspectives";
import { perspectiveFactSummary, type PerspectiveConfidence, type PerspectiveResult } from "@/lib/squad/diagnosis-perspectives";
import { Badge } from "@/components/ui/Badge";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { localizePerspectiveText } from "@/lib/squad/diagnosis-perspectives-text-en";
import { swapPlayerNames } from "@/lib/squad/squad-diagnosis-text-en";

/**
 * F-045 診断の追加観点。事実の集計（2026-10-09）は上に常に出し、暫定の式の比較は既定で閉じた折りたたみに置く。総合評価・共有画像とは分ける。
 * 観点ごとに独立して表示し、合計しない。
 */
export function DiagnosisPerspectivesPanel({
  results,
  namePairs = [],
}: {
  results: PerspectiveResult[];
  /** 英語の画面で選手名を英語名にそろえる [日本語名, 英語名]。 */
  namePairs?: readonly (readonly [string, string])[];
}) {
  const t = useT();
  const { locale, displayLocale } = useLocale();
  // 計算ライブラリの日本語は表示するときだけ英語にする（2026-10-04。それまでは英語の画面でも日本語のままだった）。
  const lp = (text: string) => swapPlayerNames(localizePerspectiveText(text, displayLocale), locale, namePairs);
  const confidenceLabel: Record<PerspectiveConfidence, string> = {
    high: t("diagnosisPerspectives", "confidenceHigh"),
    medium: t("diagnosisPerspectives", "confidenceMedium"),
    low: t("diagnosisPerspectives", "confidenceLow"),
    insufficient: t("diagnosisPerspectives", "confidenceInsufficient"),
  };
  if (results.length === 0) return null;
  const facts = perspectiveFactSummary(results);
  return (
    <>
    {facts.length > 0 ? (
      <section className="mt-2 rounded-md border border-border/60 bg-surface p-2.5 text-sm" data-testid="diagnosis-perspective-facts" aria-label={t("diagnosisPerspectives", "factsTitle")}>
        <h3 className="text-xs font-semibold text-text">{t("diagnosisPerspectives", "factsTitle")}</h3>
        <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 text-2xs sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.id} className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-0.5">
              <dt className="min-w-0 text-text-dim">
                {lp(f.label)}
                <span className="ms-1 text-text-muted">（{lp(f.formulaLabel)}）</span>
              </dt>
              <dd className="shrink-0 font-semibold tabular-nums text-text">{f.value === null ? t("diagnosisPerspectives", "notComputed") : `${f.value}${lp(f.unit)}`}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-2xs text-text-muted">{t("diagnosisPerspectives", "factsNote")}</p>
      </section>
    ) : null}
    <details className="mt-2 rounded-md border border-border/60 bg-surface p-0 text-sm" data-testid="diagnosis-perspectives">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-2.5 py-2 text-xs font-semibold text-text-dim hover:text-text">
        {t("diagnosisPerspectives", "title")}（{results.length}）
        <Badge tone="warning">{t("diagnosisPerspectives", "badge")}</Badge>
      </summary>
      <div className="border-t border-border/60 p-2.5">
        <p className="text-2xs text-text-muted">{t("diagnosisPerspectives", "note")}</p>
        <ul className="mt-2 flex flex-col gap-3">
          {results.map((r) => (
            <li key={r.id} className="rounded border border-border/60 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-text">{lp(r.label)}</h4>
                <span className="text-2xs text-text-muted">
                  {t("diagnosisPerspectives", "confidence")}: {confidenceLabel[r.confidence]}
                </span>
              </div>
              <ul className="mt-1 list-disc ps-4 text-2xs text-text-dim">
                {r.facts.map((f, i) => (
                  <li key={i}>{lp(f)}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-2xs font-semibold text-text-dim">{t("diagnosisPerspectives", "formulas")}</p>
              <dl className="mt-0.5 flex flex-col gap-1 text-2xs">
                {r.formulas.map((f) => (
                  <div key={f.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                    <dt className="flex min-w-0 items-center gap-1.5 text-text-dim">
                      <span className="font-mono">{f.id}</span>
                      <span>{lp(f.label)}</span>
                      <Badge tone={f.kind === "fact" ? "neutral" : "outline"}>
                        {f.kind === "fact" ? t("diagnosisPerspectives", "kindFact") : t("diagnosisPerspectives", "kindProvisional")}
                      </Badge>
                    </dt>
                    <dd className="text-text">
                      <span className="tabular-nums">{f.value === null ? t("diagnosisPerspectives", "notComputed") : `${f.value}${lp(f.unit)}`}</span>
                      <span className="ms-2 text-text-muted">{lp(f.description)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {r.causes.length > 0 ? (
                <>
                  <p className="mt-1.5 text-2xs font-semibold text-text-dim">{t("diagnosisPerspectives", "causes")}</p>
                  <ul className="list-disc ps-4 text-2xs text-text-dim">
                    {r.causes.map((c) => (
                      <li key={c.key}>
                        {lp(c.name)}
                        {c.position && c.position !== c.name ? `（${c.position}）` : ""}: {lp(c.detail)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {r.improvements.length > 0 ? (
                <>
                  <p className="mt-1.5 text-2xs font-semibold text-text-dim">{t("diagnosisPerspectives", "improvements")}</p>
                  <ul className="list-disc ps-4 text-2xs text-text-dim">
                    {r.improvements.map((m, i) => (
                      <li key={i}>{lp(m)}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {r.missingData.length > 0 ? (
                <p className="mt-1.5 text-2xs text-warning">
                  {t("diagnosisPerspectives", "missingData")}: {r.missingData.map(lp).join(" / ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-2xs text-text-muted">
          {t("diagnosisPerspectives", "rulesVersion")}: <span className="font-mono">{results[0].rulesVersion}</span>
        </p>
      </div>
    </details>
    </>
  );
}
