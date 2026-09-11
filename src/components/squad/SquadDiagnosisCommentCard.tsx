"use client";

import { useMemo, useState } from "react";
import type { SquadDiagnosisResult } from "@/lib/squad/squad-diagnosis";
import { analyzeSquadDiagnosis, type SquadDiagnosisCommentMode } from "@/lib/squad/squad-diagnosis-comments";
import {
  generateSquadDiagnosisCommentsLocalized,
  getImprovementPrioritiesLocalized,
} from "@/lib/squad/squad-diagnosis-comments-i18n";
import {
  buildTacticalReview,
  type TacticalPlacementInput,
  type TacticalFinding,
  type FindingSeverity,
  type FindingConfidence,
  type TacticalCoverage,
} from "@/lib/squad/squad-tactical-review";
import { Badge } from "@/components/ui/Badge";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";

/**
 * スカッド診断の「通常コメント」「辛口コメント」表示。
 *
 * - 通常コメントは既存の `CommentAnalysis`（`analyzeSquadDiagnosis`）だけから生成する（従来どおり）。
 *   詳細な配置構造分析は表示しない。
 * - 辛口コメントは、既存の複数段落コメントに加えて、辛口モードのときだけ「配置構造・戦術監査」を表示する。
 *   これは選手固有のプレースタイル連携・発動可否・AI挙動を分析するものではなく、配置ポジションと
 *   既存の確認済み診断カテゴリにもとづく構造分析であることを、見出しと対象範囲の説明で明示する。
 * - 先発配置が極端に不足している場合は、`buildTacticalReview` 側の安全ゲートにより、
 *   高信頼度の断定的なfindingは生成されない（配置充足状況に応じた信頼度上限が適用される）。
 * - `tacticalPlacements` が渡されない場合も、通常/辛口とも既存の表示のまま正常に動作する
 *   （新しい戦術分析を必須入力にしない）。
 * - すべて既存の診断結果・配置情報からの `useMemo` 純粋な派生表示。モード切替は診断エンジンの再実行・
 *   能力値の再計算を一切行わない。モードは localStorage / SQLite / URL のいずれにも保存しない。
 * - 改善優先順位（最大3件）は番号付きリストとして別途表示する。
 * - 免責文言はこのカードの親（`SquadDiagnosisPanel`）で既に表示済みのため、ここでは重複表示しない。
 */
export function SquadDiagnosisCommentCard({
  result,
  tacticalPlacements,
}: {
  result: SquadDiagnosisResult;
  tacticalPlacements?: TacticalPlacementInput[] | null;
}) {
  const [mode, setMode] = useState<SquadDiagnosisCommentMode>("normal");
  const { locale } = useLocale();
  const t = useT();
  const analysis = useMemo(() => analyzeSquadDiagnosis(result), [result]);
  const comments = useMemo(() => generateSquadDiagnosisCommentsLocalized(result, locale), [result, locale]);
  const priorities = useMemo(() => getImprovementPrioritiesLocalized(analysis, locale), [analysis, locale]);
  const review = useMemo(
    () => buildTacticalReview(result, tacticalPlacements ?? null),
    [result, tacticalPlacements],
  );
  const text = mode === "normal" ? comments.normal : comments.harsh;

  return (
    <div className="mt-3 rounded-md border border-border/60 bg-surface-2/20 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text-dim">{t("diagnosis", "commentSectionHeading")}</p>
        <div
          role="group"
          aria-label={`${t("diagnosis", "commentModeNormal")}/${t("diagnosis", "commentModeHarsh")}`}
          className="inline-flex overflow-hidden rounded-md border border-border"
        >
          <button
            type="button"
            aria-pressed={mode === "normal"}
            onClick={() => setMode("normal")}
            className={`min-h-[36px] px-3 text-2xs font-semibold transition-colors ${
              mode === "normal" ? "bg-accent text-accent-ink" : "bg-surface-2 text-text-dim hover:text-text"
            }`}
          >
            {t("diagnosis", "commentModeNormal")}
            {mode === "normal" ? t("diagnosis", "commentModeDisplayingSuffix") : ""}
          </button>
          <button
            type="button"
            aria-pressed={mode === "harsh"}
            onClick={() => setMode("harsh")}
            className={`min-h-[36px] border-l border-border px-3 text-2xs font-semibold transition-colors ${
              mode === "harsh" ? "bg-danger text-text" : "bg-surface-2 text-text-dim hover:text-text"
            }`}
          >
            {t("diagnosis", "commentModeHarsh")}
            {mode === "harsh" ? t("diagnosis", "commentModeDisplayingSuffix") : ""}
          </button>
        </div>
      </div>

      {mode === "harsh" ? (
        <div className="mt-1.5">
          <Badge tone="danger" size="xs">
            {t("diagnosis", "commentModeHarshBadge")}
          </Badge>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="mt-1.5 max-w-3xl whitespace-pre-wrap text-xs leading-relaxed text-text">
        {text}
      </p>

      {priorities.length > 0 ? (
        <div className="mt-2 border-t border-border/40 pt-2">
          <p className="text-2xs font-semibold text-text-dim">{t("diagnosis", "improvementPrioritiesHeading")}</p>
          <ol className="mt-1 flex flex-col gap-1">
            {priorities.map((p) => (
              <li key={p.rank} className="flex gap-1.5 rounded border border-border/50 bg-surface-2/30 px-2 py-1 text-2xs">
                <span className="shrink-0 font-semibold text-text-dim">{p.rank}.</span>
                <span className="min-w-0">
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-text-muted"> — {p.reason}</span>
                  {p.keepStrength ? (
                    <span className="block text-text-muted">
                      （{t("diagnosis", "keepStrengthPrefix")}: {p.keepStrength}）
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {mode === "harsh" ? <TacticalReviewSection review={review} /> : null}
    </div>
  );
}

function TacticalReviewSection({ review }: { review: ReturnType<typeof buildTacticalReview> }) {
  const t = useT();
  const SEVERITY_LABEL: Record<FindingSeverity, string> = {
    high: t("tactical", "severityHigh"),
    medium: t("tactical", "severityMedium"),
    low: t("tactical", "severityLow"),
    info: t("tactical", "severityInfo"),
  };
  const SEVERITY_TONE: Record<FindingSeverity, "danger" | "warning" | "info" | "neutral"> = {
    high: "danger",
    medium: "warning",
    low: "info",
    info: "neutral",
  };
  const CONFIDENCE_LABEL: Record<FindingConfidence, string> = {
    high: t("tactical", "confidenceHigh"),
    medium: t("tactical", "confidenceMedium"),
    low: t("tactical", "confidenceLow"),
    insufficient: t("tactical", "confidenceInsufficient"),
  };
  const COVERAGE_LABEL: Record<TacticalCoverage, string> = {
    insufficient: t("tactical", "coverageInsufficient"),
    limited: t("tactical", "coverageLimited"),
    partial: t("tactical", "coveragePartial"),
    full: t("tactical", "coverageFull"),
  };
  const { findings, coverage, placedFieldPlayerCount, expectedFieldPlayerCount, limitations } = review;
  if (findings.length === 0) return null;
  return (
    <div className="mt-2 border-t border-border/40 pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-2xs font-semibold text-text-dim">{t("tactical", "sectionHeading")}</p>
        <Badge tone="outline" size="xs">
          {COVERAGE_LABEL[coverage]}
        </Badge>
        {expectedFieldPlayerCount > 0 ? (
          <span className="text-2xs text-text-muted">
            {t("tactical", "placementCountLabel")} {placedFieldPlayerCount}/{expectedFieldPlayerCount}
            {t("tactical", "placementCountUnit")}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-2xs text-text-muted">{t("tactical", "scopeDescription")}</p>
      {limitations.length > 0 ? (
        <p className="mt-1 rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
          {limitations.join(" ")}
        </p>
      ) : null}
      <ul className="mt-1.5 grid grid-cols-1 gap-1.5 lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))] lg:items-start">
        {findings.map((f) => (
          <li key={f.id} className="rounded border border-border/50 bg-surface-2/30 p-2 text-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-text">{f.title}</span>
              <Badge tone={SEVERITY_TONE[f.severity]} size="xs">
                {SEVERITY_LABEL[f.severity]}
              </Badge>
              <Badge tone="outline" size="xs">
                {CONFIDENCE_LABEL[f.confidence]}
              </Badge>
            </div>
            <p className="mt-1 text-text-muted">{f.summary}</p>
            {f.explanation ? <p className="mt-0.5 text-text-muted">{f.explanation}</p> : null}
            {f.evidence.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-text-muted">
                {f.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : null}
            {f.potentialRisk ? (
              <p className="mt-1 text-warning">
                {t("tactical", "potentialRiskPrefix")}: {f.potentialRisk}
              </p>
            ) : null}
            {f.recommendations.length > 0 ? (
              <ol className="mt-1 list-decimal pl-4 text-text-muted">
                {f.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            ) : null}
            {f.limitations ? (
              <p className="mt-1 text-text-dim">
                {t("tactical", "limitationsPrefix")}: {f.limitations}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
