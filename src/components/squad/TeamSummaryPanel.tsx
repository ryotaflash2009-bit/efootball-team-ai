"use client";

import { useState } from "react";
import type { TeamSummary } from "@/lib/squad/types";
import { useT } from "@/lib/i18n/LocaleContext";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

export function TeamSummaryPanel({
  summary,
  conditionalSummary = null,
  hasAnyConditionalSelection = false,
}: {
  summary: TeamSummary;
  conditionalSummary?: TeamSummary | null;
  hasAnyConditionalSelection?: boolean;
}) {
  const [showConditional, setShowConditional] = useState(false);
  const t = useT();
  const categoryLabel = (id: string) => t("compareCategory", id as keyof Dictionary["compareCategory"]);
  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm">
      <h3 className="font-semibold">{t("teamSummary", "heading")}</h3>
      <p className="mt-1 text-[10px] text-text-dim">{t("teamSummary", "calcNote")}</p>
      <p className="mt-1 text-[10px] text-info">{t("teamSummary", "boosterModeNote")}</p>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Item label={t("teamSummary", "startingBenchLabel")} value={`${summary.startingCount} / ${summary.benchCount}`} />
        <Item label={t("teamSummary", "avgBaseOvrLabel")} value={summary.avgBaseOvr ?? "—"} />
        <Item label={t("teamSummary", "avgDisplayedOvrLabel")} value={summary.avgDisplayedOvr ?? "—"} />
        <Item label={t("teamSummary", "sharedSkillCountLabel")} value={summary.sharedSkillCount} />
        <Item label={t("teamSummary", "managerBoostedLabel")} value={`${summary.managerBoostedCount}${t("teamSummary", "peopleSuffix")}`} />
        <Item label={t("teamSummary", "unresolvedCompatibilityLabel")} value={`${summary.unresolvedCompatibilityCount}${t("teamSummary", "peopleSuffix")}`} />
        <Item label={t("teamSummary", "possibleMismatchLabel")} value={`${summary.gkMismatchCount}${t("teamSummary", "peopleSuffix")}`} />
        <Item label={t("teamSummary", "warningsLabel")} value={`${summary.warningCount}${t("teamSummary", "countSuffix")}`} />
      </dl>

      <div className="mt-2">
        <p className="text-xs text-text-dim">{t("teamSummary", "positionBreakdownHeading")}</p>
        <p className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
          {summary.roleBreakdown.map((r) => (
            <span key={r.role} className="rounded bg-surface-2 px-1.5 py-0.5">
              {r.role} {r.count}
            </span>
          ))}
          {summary.positionBreakdown.map((p) => (
            <span key={p.position} className="rounded bg-surface-2/60 px-1.5 py-0.5 text-text-dim">
              {p.position} {p.count}
            </span>
          ))}
        </p>
      </div>

      <div className="mt-2">
        <p className="text-xs text-text-dim">{t("teamSummary", "categoryAveragesHeading")}</p>
        <ul className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
          {summary.categoryAverages.map((c) => (
            <li key={c.category} className="flex justify-between">
              <span>{categoryLabel(c.categoryId)}</span>
              <span className="tabular-nums font-semibold">{c.avg}</span>
            </li>
          ))}
        </ul>
      </div>

      {summary.sharedSkills.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs text-text-dim">{t("teamSummary", "sharedSkillsHeading")}</p>
          <p className="mt-0.5 flex flex-wrap gap-1">
            {summary.sharedSkills.map((s) => (
              <span key={s} className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] text-lime-300">
                {s}
              </span>
            ))}
          </p>
        </div>
      ) : null}

      {hasAnyConditionalSelection && conditionalSummary ? (
        <div className="mt-3 border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() => setShowConditional((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold text-accent"
            aria-expanded={showConditional}
          >
            <span>
              {t("teamSummary", "conditionalToggleLabel")}
              {showConditional ? "▲" : "▼"}
            </span>
          </button>
          <p className="mt-0.5 text-[10px] text-text-muted">{t("teamSummary", "conditionalNote")}</p>
          {showConditional ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <Item label={t("teamSummary", "conditionalAvgDisplayedOvrLabel")} value={conditionalSummary.avgDisplayedOvr ?? "—"} />
              {conditionalSummary.categoryAverages.map((c, i) => (
                <Item
                  key={c.category}
                  label={`${categoryLabel(c.categoryId)}${t("teamSummary", "conditionalCategoryLabelSuffix")}`}
                  value={t("teamSummary", "conditionalValueTemplate")
                    .replace("{value}", String(c.avg))
                    .replace("{std}", String(summary.categoryAverages[i]?.avg ?? "—"))}
                />
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-text-dim">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}
