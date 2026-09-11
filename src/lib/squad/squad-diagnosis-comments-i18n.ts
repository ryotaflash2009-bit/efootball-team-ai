import type { SquadDiagnosisResult } from "./squad-diagnosis";
import {
  generateSquadDiagnosisComments,
  type SquadDiagnosisComments,
  type CommentAnalysis,
  type ImprovementPriority,
} from "./squad-diagnosis-comments";
import { generateSquadDiagnosisCommentsEn, buildImprovementPrioritiesEn } from "./squad-diagnosis-comments-en";
import type { Locale } from "@/lib/i18n/locale";

/**
 * 表示言語に応じて通常/辛口コメントを生成する。日本語版・英語版とも同一の`SquadDiagnosisResult`から
 * `analyzeSquadDiagnosis`経由で同じ`CommentAnalysis`を導出するため、参照する診断要素は言語間で一致する。
 * 診断スコア・ランクの再計算は行わない。
 */
export function generateSquadDiagnosisCommentsLocalized(
  result: SquadDiagnosisResult,
  locale: Locale,
): SquadDiagnosisComments {
  return locale === "en" ? generateSquadDiagnosisCommentsEn(result) : generateSquadDiagnosisComments(result);
}

/**
 * 改善優先順位（表示言語に応じて日本語/英語）。同じ`CommentAnalysis`（`primaryConcern`/`secondaryConcern`/
 * `primaryStrength`）から導出するため、選ばれる懸念・強み自体は言語間で一致する
 * （英語版は選手名を含む`result.suggestions`へのフォールバックを行わないため、最大2件になる場合がある。
 * `src/lib/squad/squad-diagnosis-comments-en.ts`冒頭の既知の限定事項を参照）。
 */
export function getImprovementPrioritiesLocalized(analysis: CommentAnalysis, locale: Locale): ImprovementPriority[] {
  return locale === "en" ? buildImprovementPrioritiesEn(analysis) : analysis.improvementPriorities;
}
