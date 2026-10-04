"use client";

import "@/lib/i18n/dictionaries/ja-ns/diagnosisPerspectives";
import type { PerspectiveConfidence, PerspectiveResult } from "@/lib/squad/diagnosis-perspectives";
import { Badge } from "@/components/ui/Badge";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";

/**
 * F-045 診断の追加観点（暫定 / 比較検証用）。既定で閉じた折りたたみに置き、総合評価・共有画像とは分ける。
 * 観点ごとに独立して表示し、合計しない。
 */
export function DiagnosisPerspectivesPanel({ results }: { results: PerspectiveResult[] }) {
  const t = useT();
  const { locale } = useLocale();
  const confidenceLabel: Record<PerspectiveConfidence, string> = {
    high: t("diagnosisPerspectives", "confidenceHigh"),
    medium: t("diagnosisPerspectives", "confidenceMedium"),
    low: t("diagnosisPerspectives", "confidenceLow"),
    insufficient: t("diagnosisPerspectives", "confidenceInsufficient"),
  };
  if (results.length === 0) return null;
  return (
    <details className="mt-2 rounded-md border border-border/60 bg-surface p-0 text-sm" data-testid="diagnosis-perspectives">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-2.5 py-2 text-xs font-semibold text-text-dim hover:text-text">
        {t("diagnosisPerspectives", "title")}（{results.length}）
        <Badge tone="warning">{t("diagnosisPerspectives", "badge")}</Badge>
      </summary>
      <div className="border-t border-border/60 p-2.5">
        <p className="text-2xs text-text-muted">{t("diagnosisPerspectives", "note")}</p>
        {locale !== "ja" ? <p className="mt-1 text-2xs text-text-muted">{t("diagnosisPerspectives", "jaOnlyNote")}</p> : null}
        <ul className="mt-2 flex flex-col gap-3">
          {results.map((r) => (
            <li key={r.id} className="rounded border border-border/60 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-text">{r.label}</h4>
                <span className="text-2xs text-text-muted">
                  {t("diagnosisPerspectives", "confidence")}: {confidenceLabel[r.confidence]}
                </span>
              </div>
              <ul className="mt-1 list-disc pl-4 text-2xs text-text-dim">
                {r.facts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-2xs font-semibold text-text-dim">{t("diagnosisPerspectives", "formulas")}</p>
              <dl className="mt-0.5 flex flex-col gap-1 text-2xs">
                {r.formulas.map((f) => (
                  <div key={f.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                    <dt className="flex min-w-0 items-center gap-1.5 text-text-dim">
                      <span className="font-mono">{f.id}</span>
                      <span>{f.label}</span>
                      <Badge tone={f.kind === "fact" ? "neutral" : "outline"}>
                        {f.kind === "fact" ? t("diagnosisPerspectives", "kindFact") : t("diagnosisPerspectives", "kindProvisional")}
                      </Badge>
                    </dt>
                    <dd className="text-text">
                      <span className="tabular-nums">{f.value === null ? t("diagnosisPerspectives", "notComputed") : `${f.value}${f.unit}`}</span>
                      <span className="ml-2 text-text-muted">{f.description}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {r.causes.length > 0 ? (
                <>
                  <p className="mt-1.5 text-2xs font-semibold text-text-dim">{t("diagnosisPerspectives", "causes")}</p>
                  <ul className="list-disc pl-4 text-2xs text-text-dim">
                    {r.causes.map((c) => (
                      <li key={c.key}>
                        {c.name}
                        {c.position && c.position !== c.name ? `（${c.position}）` : ""}: {c.detail}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {r.improvements.length > 0 ? (
                <>
                  <p className="mt-1.5 text-2xs font-semibold text-text-dim">{t("diagnosisPerspectives", "improvements")}</p>
                  <ul className="list-disc pl-4 text-2xs text-text-dim">
                    {r.improvements.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {r.missingData.length > 0 ? (
                <p className="mt-1.5 text-2xs text-warning">
                  {t("diagnosisPerspectives", "missingData")}: {r.missingData.join(" / ")}
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
  );
}
