"use client";

import "@/lib/i18n/dictionaries/ja-ns/diagnosis";

import { useMemo, useState } from "react";
import type { SquadDiagnosisInput } from "@/lib/squad/squad-diagnosis";
import { rankBenchSwaps } from "@/lib/squad/improvement-simulation";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { formatNumber } from "@/lib/i18n/format";
import { diagnosisCategoryLabel } from "./SharedDiagnosisView";

/**
 * 改善シミュレーション（2026-10-07）: 控えと先発の入れ替えを同じ診断エンジンで試し、総合の改善が大きい順に 3 件。
 * 開いたときだけ計算する（11×控えの数の診断・約 16 ms）。保存しない・自動で適用しない。
 */
export function ImprovementSimulationPanel({ input }: { input: SquadDiagnosisInput }) {
  const t = useT();
  const { displayLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => (open ? rankBenchSwaps(input, 3) : []), [open, input]);
  const nameOf = (key: string) => {
    const p = [...input.starters, ...input.bench].find((x) => x.key === key);
    if (!p) return key;
    return (displayLocale === "ja" ? p.nameJa ?? p.nameEn : p.nameEn ?? p.nameJa) ?? key;
  };
  const posOf = (key: string) => input.starters.find((x) => x.key === key)?.assignedPosition ?? "";
  const signed = (n: number) => (n > 0 ? "+" : "") + formatNumber(n, displayLocale);
  const list = (cs: { id: string; delta: number | null }[]) =>
    cs.slice(0, 3).map((c) => `${diagnosisCategoryLabel(c.id as Parameters<typeof diagnosisCategoryLabel>[0], displayLocale)} ${signed(c.delta ?? 0)}`).join(" / ");

  return (
    <details className="mt-3 rounded-md border border-border/60 bg-surface-2/20" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} data-testid="improvement-simulation">
      <summary className="cursor-pointer px-2.5 py-2 text-xs font-semibold text-text-dim hover:text-text">{t("diagnosis", "simulationHeading")}</summary>
      <div className="border-t border-border/60 p-2.5 text-2xs">
        <p className="text-text-muted">{t("diagnosis", "simulationIntro")}</p>
        {open && candidates.length === 0 ? <p className="mt-1.5 text-text-dim">{t("diagnosis", "simulationEmpty")}</p> : null}
        <ul className="mt-1.5 flex flex-col gap-1">
          {candidates.map((c) => (
            <li key={`${c.starterKey}:${c.benchKey}`} className="rounded border border-success/30 bg-success/5 px-2 py-1">
              <p className="font-semibold">
                {t("diagnosis", "simulationSwapTemplate").replace("{bench}", nameOf(c.benchKey)).replace("{starter}", nameOf(c.starterKey)).replace("{position}", posOf(c.starterKey))}
              </p>
              <p className="mt-0.5">
                {t("diagnosis", "simulationOverallTemplate").replace("{delta}", signed(c.overallDelta))}
                {c.improved.length ? ` · ${t("diagnosis", "simulationImprovedLabel")}: ${list(c.improved)}` : ""}
              </p>
              {c.worsened.length ? <p className="mt-0.5 text-warning">{t("diagnosis", "simulationWorsenedLabel")}: {list(c.worsened)}</p> : null}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-text-muted">{t("diagnosis", "simulationNote")}</p>
      </div>
    </details>
  );
}
