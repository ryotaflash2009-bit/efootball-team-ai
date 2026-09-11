"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SavedBuild } from "@/lib/progression/types";
import {
  filterSquadBuildUsage,
  summarizeSquadBuilds,
  type SquadBuildUsageFilter,
  type SquadBuildUsageRowInput,
} from "@/lib/progression/my-builds";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n/LocaleContext";

/**
 * スカッド編集画面の「ビルド使用状況」サマリー（現在の 1 スカッドのみ・表示専用）。
 * - 何人がスカッド用保存ビルドを設定済み / 未設定 / 削除済み参照かを集計表示。
 * - 各枠の「保存ビルドを選ぶ」パネル（M1）への導線のみ。**一括適用・一括解除・自動補完・自動修復はしない。**
 * - 表示しただけで保存しない（updatedAt を変えない）。
 */
export function SquadBuildUsagePanel({
  rows,
  buildsByCard,
  onOpenBuildPanel,
}: {
  rows: SquadBuildUsageRowInput[];
  buildsByCard: Record<string, SavedBuild[]>;
  onOpenBuildPanel: (row: { area: "starter" | "bench"; key: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<SquadBuildUsageFilter>("all");
  const [q, setQ] = useState("");
  const t = useT();
  const ruleLabelFor = (kind: "current" | "legacy" | "unknown" | null) =>
    kind === "current"
      ? t("buildUsage", "ruleCurrentLabel")
      : kind === "legacy"
        ? t("buildUsage", "ruleLegacyLabel")
        : t("buildUsage", "ruleUnknownLabel");

  const summary = useMemo(() => summarizeSquadBuilds(rows, buildsByCard), [rows, buildsByCard]);
  const visible = useMemo(
    () => filterSquadBuildUsage(summary.entries, filter, q),
    [summary.entries, filter, q],
  );

  const filterOptions: [SquadBuildUsageFilter, string][] = [
    ["all", t("buildUsage", "filterAll")],
    ["set", t("buildUsage", "filterSet")],
    ["unset", t("buildUsage", "filterUnset")],
    ["missing", t("buildUsage", "filterMissing")],
    ["starter", t("buildUsage", "filterStarter")],
    ["bench", t("buildUsage", "filterBench")],
  ];

  return (
    <div className="rounded-md border border-border bg-surface p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("buildUsage", "heading")}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-border px-2 py-0.5 text-2xs hover:border-accent"
        >
          {t("buildUsage", "viewDetail")}
        </button>
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-text-dim">
        <span>
          {t("buildUsage", "setCountLabel")} <b className="tabular-nums text-text">{summary.setCount}</b>
          {t("buildUsage", "peopleSuffix")}
        </span>
        <span>
          {t("buildUsage", "unsetCountLabel")} <b className="tabular-nums text-text">{summary.unsetCount}</b>
          {t("buildUsage", "peopleSuffix")}
        </span>
        <span className={summary.missingCount > 0 ? "text-warning" : ""}>
          {t("buildUsage", "missingCountLabel")} <b className="tabular-nums">{summary.missingCount}</b>
          {t("buildUsage", "peopleSuffix")}
        </span>
      </p>
      <p className="mt-0.5 text-2xs text-text-muted">
        {t("buildUsage", "footerTemplate")
          .replace("{starter}", String(summary.starterCount))
          .replace("{bench}", String(summary.benchCount))}
      </p>

      {open ? (
        <Modal open onClose={() => setOpen(false)} title={t("buildUsage", "modalTitle")} size="lg">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-2xs text-text-dim">{t("buildUsage", "modalIntro")}</p>

            {/* 件数 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-border bg-surface-2/40 p-2 text-2xs sm:grid-cols-3">
              <Stat label={t("buildUsage", "statTotal")} value={summary.total} />
              <Stat label={t("buildUsage", "statStarter")} value={summary.starterCount} />
              <Stat label={t("buildUsage", "statBench")} value={summary.benchCount} />
              <Stat label={t("buildUsage", "statSet")} value={summary.setCount} />
              <Stat label={t("buildUsage", "statUnset")} value={summary.unsetCount} />
              <Stat label={t("buildUsage", "statMissing")} value={summary.missingCount} warn={summary.missingCount > 0} />
              <Stat label={t("buildUsage", "statCurrentRules")} value={summary.currentRulesCount} />
              <Stat label={t("buildUsage", "statLegacyRules")} value={summary.legacyRulesCount} warn={summary.legacyRulesCount > 0} />
              <Stat label={t("buildUsage", "statUnknownRules")} value={summary.unknownRulesCount} warn={summary.unknownRulesCount > 0} />
              <Stat label={t("buildUsage", "statPom")} value={summary.pomCount} />
              <Stat label={t("buildUsage", "statExperimental")} value={summary.experimentalCount} />
            </div>

            {/* フィルター・検索 */}
            <div className="flex flex-wrap items-center gap-1.5 text-2xs">
              {filterOptions.map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded border px-2 py-0.5 ${
                    filter === f ? "border-accent bg-accent-soft text-accent" : "border-border text-text-dim hover:border-accent"
                  }`}
                >
                  {label}
                </button>
              ))}
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("buildUsage", "searchPlaceholder")}
                aria-label={t("buildUsage", "searchAriaLabel")}
                className="min-w-[10rem] flex-1 rounded border border-border bg-surface px-2 py-1 text-2xs"
              />
            </div>

            {/* 一覧 */}
            {visible.length === 0 ? (
              <p className="text-2xs text-text-muted">{t("buildUsage", "emptyList")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {visible.map((e) => (
                  <li
                    key={`${e.area}:${e.key}`}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-border/60 bg-surface-2/30 p-2 text-2xs"
                  >
                    <span className="font-semibold">{e.playerName}</span>
                    <Badge tone="neutral" size="xs">
                      {e.area === "starter" ? t("buildUsage", "areaStarter") : t("buildUsage", "areaBench")}
                    </Badge>
                    <span className="text-text-muted">{e.slotLabel}</span>
                    <span className="text-text-muted">World ID {e.worldCardId}</span>
                    <span className="w-full sm:w-auto">
                      {e.status === "unset" ? (
                        <span className="text-text-muted">{t("buildUsage", "buildUnset")}</span>
                      ) : e.status === "missing" ? (
                        <span className="text-warning">
                          {t("buildUsage", "buildMissingTemplate").replace("{id}", String(e.savedBuildId))}
                        </span>
                      ) : (
                        <span className="text-accent">
                          {t("buildUsage", "buildSetPrefix")}
                          {e.build?.buildName}
                          <span className="ml-1 text-text-muted">
                            （{ruleLabelFor(e.ruleKind)}
                            {e.pom ? t("buildUsage", "pomSuffix") : ""}
                            {e.experimental ? t("buildUsage", "experimentalSuffix") : ""}）
                          </span>
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenBuildPanel({ area: e.area, key: e.key });
                        setOpen(false);
                      }}
                      className="ml-auto rounded border border-border px-2 py-0.5 font-semibold hover:border-accent"
                    >
                      {t("buildUsage", "chooseBuildButton")}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2 text-2xs">
              <Link
                href="/my-builds"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border px-2 hover:border-accent"
              >
                <Icon name="sliders" size={12} />
                {t("buildUsage", "manageInMyBuilds")}
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="ml-auto">
                {t("buildUsage", "closeButton")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className="text-text-muted">{label}</p>
      <p className={`font-bold tabular-nums ${warn && value > 0 ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}
