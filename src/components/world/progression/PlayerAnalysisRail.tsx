"use client";

import { useState, type ReactNode } from "react";
import {
  valuePercentile,
  type PlayerAnalysis,
  type AnalysisPositionCell,
  type AnalysisMetric,
} from "@/lib/world/player-analysis";
import { Badge } from "@/components/ui/Badge";

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
        {status ? <span className="shrink-0 text-2xs font-normal">{status}</span> : null}
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
const CELL_TAG: Record<AnalysisPositionCell["kind"], string> = {
  registered: "登録",
  suitable: "適性",
  partial: "部分",
  none: "—",
};

function PositionGrid({ a }: { a: PlayerAnalysis["positions"] }) {
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
              <span className="text-[9px] leading-tight">{CELL_TAG[cell.kind]}</span>
            </div>
          ),
        )}
      </div>
      <p className="text-2xs text-text-dim">
        登録: <b className="text-accent">{a.registered ?? "—"}</b>
        {a.suitableCodes.length > 0 ? <> ／ 適性: {a.suitableCodes.join(" · ")}</> : null}
      </p>
      <p className="text-2xs text-text-muted">総合値（ポジション別 OVR）: <b>—</b>（計算規則を確認中）</p>
      <details className="text-2xs text-text-muted">
        <summary className="cursor-pointer">ポジション別 OVR と適性について</summary>
        <p className="mt-1">{a.ovrNote}</p>
        <p className="mt-1">{a.suitabilityNote}</p>
        <p className="mt-1">情報源 — {a.source}</p>
        {a.familiarityRows.length > 0 ? (
          <table className="mt-1.5 w-full">
            <thead className="text-text-muted">
              <tr>
                <th className="py-0.5 pr-2 text-left font-medium">ポジション</th>
                <th className="py-0.5 pr-2 text-left font-medium">区分</th>
                <th className="py-0.5 text-left font-medium">適性度 (生値)</th>
              </tr>
            </thead>
            <tbody className="text-text-dim">
              {a.familiarityRows.map((r) => (
                <tr key={r.code} className="border-t border-border/40">
                  <td className="py-0.5 pr-2 font-semibold">{r.code}</td>
                  <td className="py-0.5 pr-2">{r.isRegistered ? "登録" : "副ポジション"}</td>
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
  if (m.value == null) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-border/40 py-1.5 text-xs first:border-t-0">
        <span className="text-text-dim">{m.label}</span>
        <span className="text-text-muted">ソース未収録</span>
      </div>
    );
  }
  const ov = m.overallRank;
  const pctl = ov ? valuePercentile(ov) : null;
  return (
    <div className="border-t border-border/40 py-2 text-xs first:border-t-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-text-dim">{m.label}</span>
        <span className="text-sm font-bold tabular-nums">{m.value.toFixed(1)}</span>
      </div>
      {ov ? (
        <>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] text-text-muted">
            <span>大きさ順位</span>
            <span className="tabular-nums text-text-dim">
              {ov.rank.toLocaleString()} / {ov.total.toLocaleString()}
            </span>
            {m.positionRank ? (
              <>
                <span>同ポジション</span>
                <span className="tabular-nums text-text-dim">
                  {m.positionRank.rank.toLocaleString()} / {m.positionRank.total.toLocaleString()}
                </span>
              </>
            ) : null}
            <span>パーセンタイル</span>
            <span className="tabular-nums text-text-dim">{pctl}（100 に近いほど大）</span>
          </div>
          <div
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={`パーセンタイル ${pctl}`}
          >
            <div className="h-full rounded-full bg-info/70" style={{ width: `${Math.max(2, pctl ?? 0)}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-0.5 text-[10px] text-text-muted">相対評価は準備中</p>
      )}
    </div>
  );
}

const MODEL_PRIMARY = new Set(["armLength", "legLength", "shoulderWidth", "chestMeasurement", "thighSize"]);

function ModelPanel({ a }: { a: PlayerAnalysis["model"] }) {
  const [all, setAll] = useState(false);
  const shown = all ? a.fields : a.fields.filter((f) => MODEL_PRIMARY.has(f.key));
  if (a.source === "none") {
    return <p className="text-xs text-text-muted">{a.note}</p>;
  }
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {shown.map((f) => (
          <div key={f.key} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-text-dim">{f.label}</dt>
            <dd className={f.value == null ? "text-text-muted" : "font-bold tabular-nums"}>
              {f.value == null ? "未収録" : f.value}
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
        {all ? "主要項目だけ表示" : `すべて表示（${a.fields.length} 項目）`}
      </button>
      <p className="text-[10px] text-text-muted">
        内部プレーヤーモデル値です。実寸の cm として確認された値ではありません。0 も実値です（未収録とは区別しています）。
      </p>
    </div>
  );
}

const TRAIT_INTERNAL = new Set(["weakFootUsage", "weakFootAccuracy", "form", "conditionValue", "injuryResistance"]);

function TraitsPanel({ a }: { a: PlayerAnalysis["traits"] }) {
  const facts = a.fields.filter((t) => !TRAIT_INTERNAL.has(t.key));
  const internal = a.fields.filter((t) => TRAIT_INTERNAL.has(t.key));
  return (
    <div className="space-y-2.5">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {facts.map((t) => (
          <div key={t.key} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-text-dim">{t.label}</dt>
            <dd className={t.confirmation === "missing" ? "text-text-muted" : "font-medium tabular-nums"}>
              {t.confirmation === "missing" ? "未収録" : t.value}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="mb-1 text-2xs font-semibold text-text-dim">内部特性値（段階の意味は追加検証中）</p>
        <ul className="space-y-0.5">
          {internal.map((t) => (
            <li key={t.key} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-text-dim">{t.label}</span>
              <span className="text-text-muted">
                {t.confirmation === "missing" ? (
                  "ソース未収録"
                ) : (
                  <>
                    内部値 <b className="text-text-dim tabular-nums">{t.value}</b>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-text-muted">{a.note}</p>
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
  const p = analysis.positions;
  return (
    <aside aria-label="選手分析" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">選手分析（選手固有）</h3>
        <span className="text-2xs text-text-muted">{scopeLabel}</span>
      </div>

      <Section
        title="ポジション適性"
        defaultOpen
        status={
          <Badge tone={p.confirmation === "suitability_only" ? "info" : "warning"} size="xs">
            {p.confirmation === "suitability_only" ? "適性のみ確認済み" : "適性未確認"}
          </Badge>
        }
      >
        <PositionGrid a={p} />
      </Section>

      <Section
        title="物理データ"
        defaultOpen
        status={
          analysis.physical.hasRanks ? (
            <span className="text-text-muted">順位集計時点の全 {analysis.physical.metrics[0]?.overallRank?.total.toLocaleString() ?? "?"} 件中</span>
          ) : undefined
        }
      >
        <div>
          {analysis.physical.metrics.map((m) => (
            <MetricRow key={m.key} m={m} />
          ))}
          <p className="mt-2 border-t border-border/40 pt-2 text-[10px] text-text-muted">{analysis.physical.note}</p>
        </div>
      </Section>

      <Section
        title="プレーヤーモデル"
        status={
          <span className="text-text-muted">
            {analysis.model.source === "none" ? "未収録" : `${analysis.model.availableCount} / 11 項目`}
          </span>
        }
      >
        <ModelPanel a={analysis.model} />
      </Section>

      <Section title="その他特性">
        <TraitsPanel a={analysis.traits} />
      </Section>

      <p className="text-[10px] text-text-muted/80">
        ポジション別・物理・モデル・特性の各値は表示用データです。育成計算・ブースター計算・監督補正には影響しません。
      </p>
    </aside>
  );
}
