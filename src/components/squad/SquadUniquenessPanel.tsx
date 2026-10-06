"use client";

import "@/lib/i18n/dictionaries/ja-ns/diagnosis";

import { useMemo } from "react";
import type { PerspectiveInput } from "@/lib/squad/diagnosis-perspectives";
import { evaluateSquadUniqueness, type UniquenessComponentId } from "@/lib/squad/squad-uniqueness";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type DKey = keyof Dictionary["diagnosis"];
const LABEL: Record<UniquenessComponentId, DKey> = {
  formation: "uniquenessFormation",
  playstyleDiversity: "uniquenessPlaystyle",
  unconventionalPlacement: "uniquenessPlacement",
  profileSpecialization: "uniquenessProfile",
  rarePlayerCombination: "uniquenessRarePlayers",
  managerRarity: "uniquenessManager",
};

/**
 * スカッドの独自性（候補・比較用・2026-10-07）。既定で閉じた折りたたみ。総合点・共有カード・称号には使わない。
 * 実際の利用の統計は使わない（フォーメーションは合成の事前分布）。
 */
export function SquadUniquenessPanel({ formationId, perspective }: { formationId: string; perspective: PerspectiveInput }) {
  const t = useT();
  const r = useMemo(() => evaluateSquadUniqueness({ formationId, perspective }), [formationId, perspective]);
  const label = (id: UniquenessComponentId | null) => (id ? t("diagnosis", LABEL[id]) : "—");
  return (
    <details className="mt-2 rounded-md border border-border/60 bg-surface p-0 text-sm" data-testid="squad-uniqueness">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-2.5 py-2 text-xs font-semibold text-text-dim hover:text-text">
        {t("diagnosis", "uniquenessHeading")}
        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-2xs font-normal">{t("diagnosis", "uniquenessBadge")}</span>
      </summary>
      <div className="border-t border-border/60 p-2.5 text-2xs">
        <p className="text-text-muted">{t("diagnosis", "uniquenessIntro")}</p>
        <p className="mt-1.5 font-semibold">
          {t("diagnosis", "uniquenessCandidateLabel")}: {r.candidateScore ?? "—"}
          {r.candidateScore !== null ? " / 100" : ""}
        </p>
        <p className="mt-0.5">
          {t("diagnosis", "uniquenessMostUnique")}: {label(r.mostUnique)} · {t("diagnosis", "uniquenessMostCommon")}: {label(r.mostCommon)}
        </p>
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {r.components.map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span>{t("diagnosis", LABEL[c.id])}</span>
              <span className="tabular-nums text-text-dim">{c.score === null ? t("diagnosis", c.basis === "not-computed" ? "uniquenessNotComputed" : "uniquenessInsufficient") : c.score}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-text-muted">{t("diagnosis", "uniquenessNote")}</p>
        <p className="mt-0.5 text-text-muted">{r.version}</p>
      </div>
    </details>
  );
}
