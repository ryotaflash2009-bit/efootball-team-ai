"use client";

import "@/lib/i18n/dictionaries/ja-ns/progressionTab";
import { fillMessage } from "@/lib/i18n/message-format";
import { useState, type ReactNode } from "react";
import {
  valuePercentile,
  type PlayerAnalysis,
  type AnalysisPositionCell,
  type AnalysisMetric,
} from "@/lib/world/player-analysis";
import { Badge } from "@/components/ui/Badge";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { formatNumber } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries/ja";

type PTKey = keyof Dictionary["progressionTab"];

/** 表示ラベル（lib 側の日本語ラベル）を安定キーから辞書キーへ引く。未知キーは lib のラベルをそのまま使う。 */
const METRIC_LABEL_KEY: Record<string, PTKey> = {
  legCoverageRadius: "anMetricLegCoverageRadius",
  armCoverageRadius: "anMetricArmCoverageRadius",
  jumpingHeight: "anMetricJumpingHeight",
  torsoCollision: "anMetricTorsoCollision",
  dribbleHeight: "anMetricDribbleHeight",
};
const MODEL_LABEL_KEY: Record<string, PTKey> = {
  armLength: "anModelArmLength",
  shoulderWidth: "anModelShoulderWidth",
  neckLength: "anModelNeckLength",
  chestMeasurement: "anModelChestMeasurement",
  neckSize: "anModelNeckSize",
  shoulderHeight: "anModelShoulderHeight",
  legLength: "anModelLegLength",
  thighSize: "anModelThighSize",
  waistSize: "anModelWaistSize",
  armSize: "anModelArmSize",
  calfSize: "anModelCalfSize",
};
const TRAIT_LABEL_KEY: Record<string, PTKey> = {
  preferredFoot: "anTraitPreferredFoot",
  height: "anTraitHeight",
  weight: "anTraitWeight",
  age: "anTraitAge",
  weakFootUsage: "anTraitWeakFootUsage",
  weakFootAccuracy: "anTraitWeakFootAccuracy",
  form: "anTraitForm",
  conditionValue: "anTraitConditionValue",
  injuryResistance: "anTraitInjuryResistance",
};

/**
 * 選手分析レール（育成画面の右カラム）。**選手固有分析**に整理:
 *  1. ポジション適性  2. 物理データ  3. プレーヤーモデル  4. その他特性
 * 選手スキル / AI・COM プレースタイルは中央カラム（能力値の下）へ移動済み。ここには出さない。
 *
 *  - 表示は `buildPlayerAnalysis` の整形結果のみ（育成/ブースター/監督計算には触れない）。
 *  - データが無い項目は「ソース未収録」等と明示（架空値・0 埋め・推測をしない）。
 *  - 折りたたみセクション（`<details>`）。独立した長いスクロールは作らない。
 */

function Section({
  title,
  status,
  defaultOpen = false,
  children,
}: {
  title: string;
  status?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-md border border-border bg-surface">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
        <span>{title}</span>
        {status ? <span className="min-w-0 text-end text-2xs font-normal">{status}</span> : null}
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}

const CELL_STYLE: Record<AnalysisPositionCell["kind"], string> = {
  registered: "border-accent bg-accent-soft text-text",
  suitable: "border-info/50 bg-info/10 text-text",
  partial: "border-warning/50 border-dashed bg-warning/5 text-text-dim",
  none: "border-border bg-surface-2/30 text-text-muted",
};
const CELL_TAG: Record<AnalysisPositionCell["kind"], PTKey | null> = {
  registered: "anCellRegistered",
  suitable: "anCellSuitable",
  partial: "anCellPartial",
  none: null,
};

function PositionGrid({ a }: { a: PlayerAnalysis["positions"] }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const withEfhub = a.confirmation === "suitability_only";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {a.grid.flat().map((cell, i) =>
          cell == null ? (
            <div key={i} aria-hidden="true" />
          ) : (
            <div
              key={i}
              className={`flex flex-col items-center rounded border px-1 py-1.5 text-center ${CELL_STYLE[cell.kind]}`}
            >
              <span className="text-xs font-bold">{cell.code}</span>
              <span className="text-[9px] leading-tight">{CELL_TAG[cell.kind] ? tp(CELL_TAG[cell.kind]!) : "—"}</span>
            </div>
          ),
        )}
      </div>
      <p className="text-2xs text-text-dim">
        {tp("anRegisteredLabel")}<b className="text-accent">{a.registered ?? "—"}</b>
        {a.suitableCodes.length > 0 ? <>{tp("anSuitableLabel")}{a.suitableCodes.join(" · ")}</> : null}
      </p>
      <p className="text-2xs text-text-muted">{tp("anOvrByPosLabel")}<b>—</b>{tp("anOvrByPosPending")}</p>
      <details className="text-2xs text-text-muted">
        <summary className="cursor-pointer">{tp("anOvrSummary")}</summary>
        <p className="mt-1">{tp("anOvrNote")}</p>
        <p className="mt-1">{tp(withEfhub ? "anSuitNoteEfhub" : "anSuitNoteNone")}</p>
        <p className="mt-1">{tp("anSourcePrefix")}{tp(withEfhub ? "anSrcWithEfhub" : "anSrcWorldOnly")}</p>
        {a.familiarityRows.length > 0 ? (
          <table className="mt-1.5 w-full">
            <thead className="text-text-muted">
              <tr>
                <th className="py-0.5 pe-2 text-start font-medium">{tp("anColPosition")}</th>
                <th className="py-0.5 pe-2 text-start font-medium">{tp("anColCategory")}</th>
                <th className="py-0.5 text-start font-medium">{tp("anColFamiliarity")}</th>
              </tr>
            </thead>
            <tbody className="text-text-dim">
              {a.familiarityRows.map((r) => (
                <tr key={r.code} className="border-t border-border/40">
                  <td className="py-0.5 pe-2 font-semibold">{r.code}</td>
                  <td className="py-0.5 pe-2">{r.isRegistered ? tp("anRegistered") : tp("anSubPosition")}</td>
                  <td className="py-0.5 tabular-nums">{r.isRegistered ? "—" : (r.familiarity ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </details>
    </div>
  );
}

function MetricRow({ m }: { m: AnalysisMetric }) {
  const t = useT();
  const { displayLocale } = useLocale();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const labelKey = METRIC_LABEL_KEY[m.key];
  const label = labelKey ? tp(labelKey) : m.label;
  if (m.value == null) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-border/40 py-1.5 text-xs first:border-t-0">
        <span className="text-text-dim">{label}</span>
        <span className="text-text-muted">{tp("anNotInSource")}</span>
      </div>
    );
  }
  const ov = m.overallRank;
  const pctl = ov ? valuePercentile(ov) : null;
  return (
    <div className="border-t border-border/40 py-2 text-xs first:border-t-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-text-dim">{label}</span>
        <span className="text-sm font-bold tabular-nums">{m.value.toFixed(1)}</span>
      </div>
      {ov ? (
        <>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] text-text-muted">
            <span>{tp("anSizeRank")}</span>
            <span className="tabular-nums text-text-dim">
              {formatNumber(ov.rank, displayLocale)} / {formatNumber(ov.total, displayLocale)}
            </span>
            {m.positionRank ? (
              <>
                <span>{tp("anSamePosition")}</span>
                <span className="tabular-nums text-text-dim">
                  {formatNumber(m.positionRank.rank, displayLocale)} / {formatNumber(m.positionRank.total, displayLocale)}
                </span>
              </>
            ) : null}
            <span>{tp("anPercentile")}</span>
            <span className="tabular-nums text-text-dim">{pctl}{tp("anPercentileHint")}</span>
          </div>
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={tp("anPercentileAria").replace("{value}", String(pctl))}
          >
            <div className="h-full rounded-full bg-info/70" style={{ width: `${Math.max(2, pctl ?? 0)}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-0.5 text-[10px] text-text-muted">{tp("anRelativePending")}</p>
      )}
    </div>
  );
}

const MODEL_PRIMARY = new Set(["armLength", "legLength", "shoulderWidth", "chestMeasurement", "thighSize"]);

function ModelPanel({ a }: { a: PlayerAnalysis["model"] }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const [all, setAll] = useState(false);
  const shown = all ? a.fields : a.fields.filter((f) => MODEL_PRIMARY.has(f.key));
  if (a.source === "none") {
    return <p className="text-xs text-text-muted">{tp("anModelNoteNone")}</p>;
  }
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {shown.map((f) => (
          <div key={f.key} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-text-dim">{MODEL_LABEL_KEY[f.key] ? tp(MODEL_LABEL_KEY[f.key]) : f.label}</dt>
            <dd className={f.value == null ? "text-text-muted" : "font-bold tabular-nums"}>
              {f.value == null ? tp("anNotRecorded") : f.value}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={() => setAll((v) => !v)}
        aria-expanded={all}
        className="min-h-[36px] rounded border border-border px-2 py-1 text-2xs text-text-dim hover:border-accent"
      >
        {all ? tp("anShowPrimary") : fillMessage(tp("anShowAll"), { n: String(a.fields.length) })}
      </button>
      <p className="text-[10px] text-text-muted">
        {tp("anModelCaveat")}
      </p>
    </div>
  );
}

const TRAIT_INTERNAL = new Set(["weakFootUsage", "weakFootAccuracy", "form", "conditionValue", "injuryResistance"]);

function TraitsPanel({ a }: { a: PlayerAnalysis["traits"] }) {
  const t = useT();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const traitLabel = (tr: PlayerAnalysis["traits"]["fields"][number]) =>
    TRAIT_LABEL_KEY[tr.key] ? tp(TRAIT_LABEL_KEY[tr.key]) : tr.label;
  const facts = a.fields.filter((tr) => !TRAIT_INTERNAL.has(tr.key));
  const internal = a.fields.filter((tr) => TRAIT_INTERNAL.has(tr.key));
  return (
    <div className="space-y-2.5">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {facts.map((tr) => (
          <div key={tr.key} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-text-dim">{traitLabel(tr)}</dt>
            <dd className={tr.confirmation === "missing" ? "text-text-muted" : "font-medium tabular-nums"}>
              {tr.confirmation === "missing" ? tp("anNotRecorded") : tr.value}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="mb-1 text-2xs font-semibold text-text-dim">{tp("anInternalTraitsHeading")}</p>
        <ul className="space-y-0.5">
          {internal.map((tr) => (
            <li key={tr.key} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-text-dim">{traitLabel(tr)}</span>
              <span className="text-text-muted">
                {tr.confirmation === "missing" ? (
                  tp("anNotInSource")
                ) : (
                  <>
                    {tp("anInternalValue")}<b className="text-text-dim tabular-nums">{tr.value}</b>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-text-muted">{tp("anTraitsNote")}</p>
    </div>
  );
}

export function PlayerAnalysisRail({
  analysis,
  scopeLabel,
}: {
  analysis: PlayerAnalysis;
  /** 「World データ」または「World + eFHUB 詳細」。 */
  scopeLabel: string;
}) {
  const t = useT();
  const { displayLocale } = useLocale();
  const tp = (k: Parameters<typeof t<"progressionTab">>[1]) => t("progressionTab", k);
  const p = analysis.positions;
  return (
    <aside aria-label={tp("anAriaLabel")} className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{tp("anHeading")}</h3>
        <span className="text-2xs text-text-muted">{scopeLabel}</span>
      </div>

      <Section
        title={tp("anSecPositions")}
        defaultOpen
        status={
          <Badge tone={p.confirmation === "suitability_only" ? "info" : "warning"} size="xs">
            {p.confirmation === "suitability_only" ? tp("anSuitOnly") : tp("anSuitUnconfirmed")}
          </Badge>
        }
      >
        <PositionGrid a={p} />
      </Section>

      <Section
        title={tp("anSecPhysical")}
        defaultOpen
        status={
          analysis.physical.hasRanks ? (
            <span className="text-text-muted">
              {tp("anRankTotal").replace(
                "{n}",
                analysis.physical.metrics[0]?.overallRank?.total != null
                  ? formatNumber(analysis.physical.metrics[0].overallRank.total, displayLocale)
                  : "?",
              )}
            </span>
          ) : undefined
        }
      >
        <div>
          {analysis.physical.metrics.map((m) => (
            <MetricRow key={m.key} m={m} />
          ))}
          <p className="mt-2 border-t border-border/40 pt-2 text-[10px] text-text-muted">
            {tp(analysis.physical.hasRanks ? "anPhysNoteRanks" : "anPhysNoteNoRanks")}
          </p>
        </div>
      </Section>

      <Section
        title={tp("anSecModel")}
        status={
          <span className="text-text-muted">
            {analysis.model.source === "none"
              ? tp("anNotRecorded")
              : tp("anModelCount").replace("{n}", String(analysis.model.availableCount))}
          </span>
        }
      >
        <ModelPanel a={analysis.model} />
      </Section>

      <Section title={tp("anSecTraits")}>
        <TraitsPanel a={analysis.traits} />
      </Section>

      <p className="text-[10px] text-text-muted/80">
        {tp("anFooter")}
      </p>
    </aside>
  );
}
