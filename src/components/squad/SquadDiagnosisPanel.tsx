"use client";

import type {
  SquadDiagnosisResult,
  SquadDiagnosisCategory,
  SquadDiagnosisFinding,
  SquadDiagnosisTier,
} from "@/lib/squad/squad-diagnosis";
import { Badge } from "@/components/ui/Badge";
import { SquadDiagnosisImageSaveButton } from "./SquadDiagnosisImageSaveButton";
import { SquadDiagnosisShareUrlButton } from "./SquadDiagnosisShareUrlButton";
import { tierBadgeTone, tierBarClass } from "./diagnosis-tier-style";
import { SquadDiagnosisCommentCard } from "./SquadDiagnosisCommentCard";
import type { TacticalPlacementInput } from "@/lib/squad/squad-tactical-review";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import type { Locale } from "@/lib/i18n/locale";

/**
 * スカッド診断（スカッド構成評価）の表示。読み取り専用（このパネルの表示だけでスカッド・保存ビルド・
 * My Team・SQLite への書き込みは一切発生しない）。
 *
 * 表示構造は「無料版候補（basicSummary）」と「詳細（categories/strengths/weaknesses/suggestions 全件）」を
 * コード上分離している（`docs/milestones/2026-09-06-squad-diagnosis-foundation.md` §11）。
 * 今回は認証・会員判定を実装しないため、両方を同じ画面に表示する（開発用の全表示）。
 *
 * 国際化について（`docs`の国際化タスクで追加）:
 *  - `squad-diagnosis.ts`のスコア・ランク・`category.label`・`category.note`・`evidence`・
 *    `SquadDiagnosisFinding.label/detail`・`result.suggestions`・`result.overall.note`は日本語固定のまま
 *    変更していない（診断ロジックは不変）。
 *  - 画面側では、カテゴリ名（id基準）・見出し・固定ラベル・件数ベースの警告文だけを言語別に表示する。
 *  - 長所/弱点のうち`kind === "ability"`（カテゴリ起因）は、カテゴリIDとスコア/ランクから英語文を
 *    再構成できるため翻訳する。選手名を含むfinding（参照エラー・配置適性等）と改善候補
 *    （`result.suggestions`）は選手名を安全に英訳する手段が無いため、今回は日本語のまま表示する
 *    （既知の限定事項。最終報告に明記）。
 */

const CATEGORY_LABEL_EN: Record<string, string> = {
  attack: "Attack",
  defense: "Defense",
  aerial: "Aerial",
  speed: "Speed",
  passBuildUp: "Pass & Build-up",
  dribblePossession: "Dribbling & Possession",
  pressResistance: "Press Resistance",
  counterAttack: "Counter-attack",
  squadCompleteness: "Squad Placement Completeness",
};

function categoryDisplayLabel(category: SquadDiagnosisCategory, locale: Locale): string {
  if (locale === "en") return CATEGORY_LABEL_EN[category.id] ?? category.label;
  return category.label;
}

function overallNoteLocalized(result: SquadDiagnosisResult, ratedCount: number, total: number, locale: Locale): string {
  if (locale !== "en") return result.overall.note;
  return result.overall.score != null
    ? `Simple average of ${ratedCount}/${total} ratable items`
    : "Not ratable (no valid evaluation items — place field players in the starting line-up)";
}

/** カテゴリ起因（kind==="ability"）のfindingだけ英訳を再構成する。選手名を含む他kindは日本語のまま返す。 */
function findingDisplay(
  f: SquadDiagnosisFinding,
  result: SquadDiagnosisResult,
  locale: Locale,
  variant: "strength" | "weakness",
): { label: string; detail: string } {
  if (locale !== "en" || f.kind !== "ability" || !f.categoryId) return { label: f.label, detail: f.detail };
  const category = result.categories.find((c) => c.id === f.categoryId);
  if (!category || category.score == null) return { label: f.label, detail: f.detail };
  const label = CATEGORY_LABEL_EN[category.id] ?? f.label;
  const detail =
    variant === "strength"
      ? `${label} is rated at a high level (grade ${category.tier}, ${category.score} pts).`
      : `${label} is rated at a low level (grade ${category.tier}, ${category.score} pts).`;
  return { label, detail };
}

function ScoreLine({
  label,
  score,
  tier,
  notRatedLabel,
}: {
  label: string;
  score: number | null;
  tier: SquadDiagnosisTier | null;
  notRatedLabel: string;
}) {
  return (
    <div className="rounded border border-border/60 bg-surface-2/30 px-2 py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">{label}</span>
        {score != null ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="tabular-nums font-semibold">{score}</span>
            <Badge tone={tierBadgeTone(tier)} size="xs">
              {tier}
            </Badge>
          </span>
        ) : (
          <Badge tone="outline" size="xs">
            {notRatedLabel}
          </Badge>
        )}
      </div>
      {score == null ? (
        <div className="mt-1 h-2 w-full rounded-full border border-dashed border-border" aria-hidden="true" />
      ) : (
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <div
            className={`h-full rounded-full ${tierBarClass(tier)}`}
            style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function CategoryDetail({ category, locale }: { category: SquadDiagnosisCategory; locale: Locale }) {
  const t = useT();
  return (
    <li className="rounded border border-border/60 bg-surface-2/20 p-2">
      <ScoreLine
        label={categoryDisplayLabel(category, locale)}
        score={category.score}
        tier={category.tier}
        notRatedLabel={t("diagnosis", "notRated")}
      />
      <p className="mt-1 text-2xs text-text-muted">{category.note}</p>
      <details className="mt-1 text-2xs text-text-muted">
        <summary className="cursor-pointer text-text-dim hover:text-text">{t("diagnosis", "evidenceToggle")}</summary>
        <dl className="mt-1 flex flex-col gap-0.5">
          {category.evidence.map((e, i) => (
            <div key={i} className="flex flex-wrap justify-between gap-1">
              <dt className="text-text-dim">{e.label}</dt>
              <dd className="min-w-0 break-words text-right">{e.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}

function useFindingBadge() {
  const t = useT();
  return (f: SquadDiagnosisFinding): { text: string; tone: "danger" | "warning" } => {
    switch (f.kind) {
      case "referenceError":
        return { text: t("diagnosis", "findingBadgeReferenceError"), tone: "danger" };
      case "compatibility":
        return { text: t("diagnosis", "findingBadgeCompatibility"), tone: "warning" };
      case "config":
        return { text: t("diagnosis", "findingBadgeConfig"), tone: "warning" };
      default:
        return { text: "", tone: "warning" };
    }
  };
}

function FindingList({
  items,
  emptyLabel,
  result,
  locale,
  variant,
}: {
  items: SquadDiagnosisFinding[];
  emptyLabel: string;
  result: SquadDiagnosisResult;
  locale: Locale;
  variant: "strength" | "weakness";
}) {
  const findingBadge = useFindingBadge();
  if (items.length === 0) return <p className="text-2xs text-text-muted">{emptyLabel}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((f) => {
        const badge = findingBadge(f);
        const display = findingDisplay(f, result, locale, variant);
        return (
          <li key={f.id} className="rounded border border-border/60 bg-surface-2/20 px-2 py-1 text-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold">{display.label}</span>
              {f.kind !== "ability" ? (
                <Badge tone={badge.tone} size="xs">
                  {badge.text}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-text-muted">{display.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** 配置・参照状態に関する重要な警告（最優先情報として先頭付近に出す）。件数ベースのため両言語に対応。 */
function CriticalWarnings({ result, locale }: { result: SquadDiagnosisResult; locale: Locale }) {
  const t = useT();
  const dq = result.dataQuality;
  const items: string[] = [];
  if (locale === "en") {
    if (dq.brokenSavedBuildRefCount > 0) {
      items.push(
        `There ${dq.brokenSavedBuildRefCount === 1 ? "is" : "are"} ${dq.brokenSavedBuildRefCount} saved build reference error(s) (possibly outdated references from deletion or replacement).`,
      );
    }
    if (dq.gkMismatchCount > 0) {
      items.push(`There ${dq.gkMismatchCount === 1 ? "is" : "are"} ${dq.gkMismatchCount} possible placement mismatch(es).`);
    }
    if (dq.unresolvedCardCount > 0) {
      items.push(`${dq.unresolvedCardCount} slot(s) have player data that could not be resolved.`);
    }
    if (dq.unresolvedManager) {
      items.push("Manager information could not be resolved.");
    }
  } else {
    if (dq.brokenSavedBuildRefCount > 0) {
      items.push(`保存ビルドの参照エラーが ${dq.brokenSavedBuildRefCount} 件あります（削除・付け替え等で古くなった参照の可能性）。`);
    }
    if (dq.gkMismatchCount > 0) {
      items.push(`配置の不適性の可能性が ${dq.gkMismatchCount} 件あります。`);
    }
    if (dq.unresolvedCardCount > 0) {
      items.push(`選手データを解決できていない枠が ${dq.unresolvedCardCount} 件あります。`);
    }
    if (dq.unresolvedManager) {
      items.push("監督情報を解決できていません。");
    }
  }
  if (items.length === 0) return null;
  return (
    <div role="alert" className="mt-2 rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-2xs text-warning">
      <p className="font-semibold">{t("diagnosis", "criticalWarningsHeading")}</p>
      <ul className="mt-0.5 list-disc pl-4">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function SquadDiagnosisPanel({
  result,
  squadName,
  formationLabel,
  tacticalPlacements,
}: {
  result: SquadDiagnosisResult | null;
  squadName: string;
  formationLabel: string;
  /** 辛口モードの詳細戦術監査用（既存 `buildSquad()` 出力から組み立てた読み取り専用の配置情報）。未指定なら戦術監査は省略される。 */
  tacticalPlacements?: TacticalPlacementInput[];
}) {
  const t = useT();
  const { locale } = useLocale();

  if (!result) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-sm">
        <h3 className="font-semibold">{t("diagnosis", "unavailableTitle")}</h3>
        <p role="alert" className="mt-2 text-xs text-warning">
          {t("diagnosis", "unavailableMessage")}
        </p>
      </div>
    );
  }

  const abilityCategories = result.categories.filter((c) => c.id !== "squadCompleteness");
  const completeness = result.categories.find((c) => c.id === "squadCompleteness") ?? null;
  const ratedAbilityCount = abilityCategories.filter((c) => c.score != null).length;
  const missingSavedBuildCount = result.dataQuality.missingSavedBuildCount;
  const filledStartingSlots = result.dataQuality.filledStartingSlots;

  return (
    <section className="rounded-md border border-border bg-surface p-3 text-sm" aria-label={t("diagnosis", "unavailableTitle")}>
      <h3 className="font-semibold">{t("diagnosis", "heading")}</h3>
      <p role="status" aria-live="polite" className="mt-1 max-w-3xl text-2xs text-text-muted">
        {locale === "en" ? t("diagnosis", "mainDisclaimer") : result.disclaimer}
      </p>
      <CriticalWarnings result={result} locale={locale} />

      <div className="mt-2.5 flex flex-wrap items-start gap-3 rounded-md border border-border-strong bg-surface-2/40 p-2.5">
        <div>
          <p className="text-2xs text-text-dim">{t("diagnosis", "overallScore")}</p>
          {result.overall.score != null ? (
            <p className="text-2xl font-black tabular-nums text-accent">
              {result.overall.score}
              <span className="text-sm font-normal text-text-dim"> / 100</span>
            </p>
          ) : (
            <p className="text-sm text-warning">{t("diagnosis", "notRated")}</p>
          )}
        </div>
        {result.overall.tier ? (
          <Badge tone={tierBadgeTone(result.overall.tier)} size="sm">
            {t("diagnosis", "tierBadgePrefix")} {result.overall.tier}
          </Badge>
        ) : null}
        <div className="ml-auto text-right">
          <p className="text-2xs text-text-dim">{t("diagnosis", "ratedItems")}</p>
          <p className="text-sm font-semibold tabular-nums">
            {ratedAbilityCount} / {abilityCategories.length}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xs text-text-dim">{t("diagnosis", "placementCoverage")}</p>
          <p className="text-sm font-semibold tabular-nums">{result.dataQuality.coveragePercent}%</p>
        </div>
        {missingSavedBuildCount > 0 ? (
          <div className="text-right">
            <p className="text-2xs text-text-dim">{t("diagnosis", "savedBuildMissingStat")}</p>
            <p className="text-sm font-semibold tabular-nums text-warning">
              {missingSavedBuildCount} / {filledStartingSlots}
              {t("diagnosis", "savedBuildMissingUnitSuffix")}
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-1 max-w-3xl text-2xs text-text-muted">
        {overallNoteLocalized(result, ratedAbilityCount, abilityCategories.length, locale)}
      </p>
      {missingSavedBuildCount > 0 ? (
        <p className="mt-0.5 max-w-3xl text-2xs text-text-muted">{t("diagnosis", "coverageMetricsNote")}</p>
      ) : null}

      <SquadDiagnosisCommentCard result={result} tacticalPlacements={tacticalPlacements ?? null} />

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {abilityCategories.map((c) => (
          <ScoreLine
            key={c.id}
            label={categoryDisplayLabel(c, locale)}
            score={c.score}
            tier={c.tier}
            notRatedLabel={t("diagnosis", "notRated")}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-text-dim">{t("diagnosis", "strengthsHeading")}</p>
          <div className="mt-1">
            <FindingList
              items={result.strengths}
              emptyLabel={t("diagnosis", "strengthsEmpty")}
              result={result}
              locale={locale}
              variant="strength"
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-text-dim">{t("diagnosis", "weaknessesHeading")}</p>
          <div className="mt-1">
            <FindingList
              items={result.weaknesses}
              emptyLabel={t("diagnosis", "weaknessesEmpty")}
              result={result}
              locale={locale}
              variant="weakness"
            />
          </div>
        </div>
      </div>

      {result.suggestions.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-text-dim">{t("diagnosis", "suggestionsHeading")}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {result.suggestions.map((s) => (
              <li key={s.id} className="rounded border border-info/30 bg-info/5 px-2 py-1 text-2xs">
                <span className="font-semibold">{s.label}</span>
                <p className="mt-0.5 text-text-muted">{s.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SquadDiagnosisImageSaveButton result={result} squadName={squadName} formationLabel={formationLabel} />
      <SquadDiagnosisShareUrlButton result={result} formationLabel={formationLabel} />

      <details className="mt-3 rounded-md border border-border/60 bg-surface-2/20">
        <summary className="cursor-pointer px-2.5 py-2 text-xs font-semibold text-text-dim hover:text-text">
          {t("diagnosis", "detailsToggle")}（{result.categories.length}
          {t("diagnosis", "categoriesHeadingSuffix")}）
        </summary>
        <div className="border-t border-border/60 p-2.5">
          <ul className="flex flex-col gap-2">
            {abilityCategories.map((c) => (
              <CategoryDetail key={c.id} category={c} locale={locale} />
            ))}
            {completeness ? <CategoryDetail category={completeness} locale={locale} /> : null}
          </ul>
          {result.dataQuality.unratedCategoryLabels.length > 0 ? (
            <p className="mt-2 text-2xs text-warning">
              {t("diagnosis", "unratedCategoriesPrefix")}: {result.dataQuality.unratedCategoryLabels.join(" / ")}
            </p>
          ) : null}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-2xs text-text-muted">
            <div className="flex justify-between gap-2">
              <dt>{t("diagnosis", "dataQualityStarters")}</dt>
              <dd className="tabular-nums">{result.dataQuality.filledStartingSlots} / {result.dataQuality.totalStartingSlots}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("diagnosis", "dataQualityBench")}</dt>
              <dd className="tabular-nums">{result.dataQuality.benchCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("diagnosis", "dataQualityMissingBuild")}</dt>
              <dd className="tabular-nums">{result.dataQuality.missingSavedBuildCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("diagnosis", "dataQualityBrokenRef")}</dt>
              <dd className="tabular-nums">{result.dataQuality.brokenSavedBuildRefCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("diagnosis", "dataQualityUnresolvedCard")}</dt>
              <dd className="tabular-nums">{result.dataQuality.unresolvedCardCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("diagnosis", "dataQualityManagerUnresolved")}</dt>
              <dd className="tabular-nums">
                {result.dataQuality.unresolvedManager ? t("diagnosis", "dataQualityYes") : t("diagnosis", "dataQualityNo")}
              </dd>
            </div>
          </dl>
        </div>
      </details>

      <p className="mt-2 text-2xs text-text-muted">{t("diagnosis", "footerNote")}</p>
    </section>
  );
}
