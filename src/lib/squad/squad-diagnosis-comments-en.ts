import type { SquadDiagnosisResult, SquadDiagnosisCategory, SquadDiagnosisCategoryId } from "./squad-diagnosis";
import {
  analyzeSquadDiagnosis,
  type CommentAnalysis,
  type PrimaryConcern,
  type ImprovementPriority,
  type SquadDiagnosisComments,
  type SquadProfileType,
  type CategoryRelationship,
} from "./squad-diagnosis-comments";

/**
 * 通常/辛口コメントの英語版。日本語文を機械的に単純変換するのではなく、`squad-diagnosis-comments.ts`
 * が既に算出した**言語非依存の`CommentAnalysis`**（懸念の種類・カテゴリID・スコア・ランク・矛盾候補・
 * プロファイル種別 等）から、日本語版と同じ選定ロジック・同じ優先順位で独立に英文を組み立てる。
 *
 * 維持する不変条件（`squad-diagnosis-comments.ts`と共有）:
 *  - スコア・ランク・長所/弱点/改善候補の選出基準は一切再計算しない（`analyzeSquadDiagnosis`をそのまま使う）。
 *  - 日本語版と同じ `primaryConcern` / `secondaryConcern` / `primaryStrength` / `contradictions` /
 *    `profile` を参照するため、両言語は常に同じ診断要素にもとづく（意味の食い違いを作らない）。
 *  - 辛口でもユーザー本人を侮辱しない。試合結果・勝率・全国順位は創作しない。
 *  - プレースタイル発動可否は扱わない。
 *
 * 既知の限定事項（構造上の制約であり、今回の意図的な安全側の判断）:
 *  - 改善優先順位の3件目が、日本語版では `result.suggestions`（squad-diagnosis.ts生成・選手名を含む
 *    日本語の自由文）へフォールバックすることがあるが、このモジュールは選手名を含む自由文を安全に
 *    英訳する手段を持たないため、英語版は常に「懸念ベースの最大2件」までとする（架空の翻訳を作らない）。
 *  - 参照エラー・配置適性など、選手名を含む個別findingの本文（`SquadDiagnosisFinding.label/detail`）は
 *    このモジュールの対象外（UI側で日本語のまま表示する）。
 */

const CATEGORY_LABEL_EN: Record<SquadDiagnosisCategoryId, string> = {
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

export function categoryLabelEn(category: SquadDiagnosisCategory): string {
  return CATEGORY_LABEL_EN[category.id] ?? category.id;
}

const PROFILE_LABEL_EN: Record<SquadProfileType, string> = {
  attackOriented: "an attack-oriented build",
  defenseOriented: "a defense-stable build",
  speedOriented: "a speed-oriented build",
  buildUpOriented: "a pass & build-up oriented build",
  possessionOriented: "a dribble & possession oriented build",
  pressOriented: "a press-oriented build",
  counterOriented: "a counter-attack oriented build",
  aerialOriented: "a build with an aerial strength",
  balanced: "a balanced build",
  lackingWeapon: "a build lacking a clear strength",
  unclassified: "a build that cannot yet be classified due to insufficient data",
};

export function profileLabelEn(type: SquadProfileType): string {
  return PROFILE_LABEL_EN[type];
}

// ---------------------------------------------------------------------------
// 懸念 → 改善優先順位ラベル/理由（英語）
// ---------------------------------------------------------------------------

function concernToPriorityEn(concern: PrimaryConcern): { label: string; reason: string } | null {
  switch (concern.kind) {
    case "referenceError":
      return {
        label: "Fix saved build references",
        reason: `There ${concern.count === 1 ? "is" : "are"} ${concern.count} reference error(s). Ability ratings will not be accurate until this is resolved.`,
      };
    case "dataInsufficient":
      return {
        label: "Fill the starting line-up",
        reason: "No field players are placed in the starting line-up, so no evaluation can be produced.",
      };
    case "structural":
      return {
        label: "Review starting line-up completeness",
        reason: `A shortage of starters or a poor positional fit (${concern.category.score} pts) is undermining the whole evaluation.`,
      };
    case "savedBuildMissing":
      return {
        label: "Set up saved builds",
        reason: `${concern.count} starting player(s) out of ${concern.total} have no saved build. Setting one up gives a more realistic evaluation after progression.`,
      };
    case "category":
      return {
        label: `Improve ${categoryLabelEn(concern.category)}`,
        reason: `${categoryLabelEn(concern.category)} is rated ${concern.category.tier} (${concern.category.score} pts), a weak point in the overall build.`,
      };
    case "none":
      return null;
  }
}

function priorityRestatesConcernEn(priority: ImprovementPriority, concern: PrimaryConcern): boolean {
  switch (concern.kind) {
    case "referenceError":
      return priority.label === "Fix saved build references";
    case "structural":
      return priority.label === "Review starting line-up completeness";
    case "savedBuildMissing":
      return priority.label === "Set up saved builds";
    case "category":
      return priority.label === `Improve ${categoryLabelEn(concern.category)}`;
    case "dataInsufficient":
      return priority.label === "Fill the starting line-up";
    case "none":
      return false;
  }
}

/**
 * 改善優先順位（英語）。日本語版と異なり、`result.suggestions`（選手名を含む日本語自由文）への
 * フォールバックは行わない（上記の既知の限定事項を参照）。最大2件（primary/secondary concernベース）。
 */
/** 改善優先順位（英語）。UI側（コメントカード）が通常/辛口どちらのモードでも同じ一覧を表示するため公開する。 */
export function buildImprovementPrioritiesEn(analysis: CommentAnalysis): ImprovementPriority[] {
  const { primaryConcern, secondaryConcern, primaryStrength } = analysis;
  const items: ImprovementPriority[] = [];
  const usedCategoryIds = new Set<string>();
  const keepStrength = primaryStrength.kind === "category" ? categoryLabelEn(primaryStrength.category) : null;

  const first = concernToPriorityEn(primaryConcern);
  if (first) {
    if (primaryConcern.kind === "category") usedCategoryIds.add(primaryConcern.category.id);
    items.push({ rank: 1, label: first.label, reason: first.reason, keepStrength });
  }

  const isDuplicateCategory = secondaryConcern.kind === "category" && usedCategoryIds.has(secondaryConcern.category.id);
  if (!isDuplicateCategory) {
    const second = concernToPriorityEn(secondaryConcern);
    if (second) {
      items.push({ rank: (items.length + 1) as 1 | 2 | 3, label: second.label, reason: second.reason, keepStrength: null });
    }
  }

  return items.slice(0, 3);
}

// ---------------------------------------------------------------------------
// カテゴリ間の矛盾候補（英語）
// ---------------------------------------------------------------------------

function relationshipDescriptionEn(high: SquadDiagnosisCategory, low: SquadDiagnosisCategory): string {
  return `${categoryLabelEn(high)} rates highly, but ${categoryLabelEn(low)} is markedly low, so the build may not be making full use of its ${categoryLabelEn(high)} strength.`;
}

function pickNonRedundantContradictionEn(
  contradictions: CategoryRelationship[],
  primaryConcern: PrimaryConcern,
): CategoryRelationship | null {
  for (const c of contradictions) {
    if (primaryConcern.kind === "category" && c.lowCategory.id === primaryConcern.category.id) continue;
    return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 通常コメント（英語）
// ---------------------------------------------------------------------------

function overallInterpretationSentenceEn(result: SquadDiagnosisResult, analysis: CommentAnalysis): string | null {
  const tier = result.overall.tier;
  if (tier == null) return null;
  const { gapLevel, profile, highest } = analysis;

  if (analysis.confidence === "low") {
    return "Too few categories could be rated yet to clearly judge the overall build tendency.";
  }
  if ((tier === "S" || tier === "A") && (gapLevel === "large" || gapLevel === "extreme")) {
    return "The overall rating is high, but the gap between categories is large, so the build is not evenly well-rounded.";
  }
  if ((tier === "S" || tier === "A") && (gapLevel === "small" || gapLevel === "moderate")) {
    return "The overall rating is high and the gap between categories is small, making this a well-finished, balanced build.";
  }
  if (profile.type === "lackingWeapon") {
    return "The overall rating is low; the build needs an all-round boost rather than leaning on one particular strength.";
  }
  if (tier === "B" && (gapLevel === "large" || gapLevel === "extreme")) {
    return "The overall rating is moderate, but a large gap between categories is pulling the total down.";
  }
  if (tier === "B") {
    return "This is a balanced build — no standout strengths, but no major gaps either.";
  }
  if (highest && (highest.tier === "S" || highest.tier === "A")) {
    return `The overall rating is low, though ${categoryLabelEn(highest)} shows some strength. Raising the other categories should be the priority.`;
  }
  return `The overall rating is low, with room to improve across several categories (${profileLabelEn(profile.type)}).`;
}

function normalStrengthSentenceEn(analysis: CommentAnalysis): string | null {
  const { primaryStrength, secondaryStrength } = analysis;
  if (primaryStrength.kind === "none") return null;
  if (secondaryStrength.kind === "category") {
    return `${categoryLabelEn(primaryStrength.category)} and ${categoryLabelEn(secondaryStrength.category)} stand out as strengths.`;
  }
  return `${categoryLabelEn(primaryStrength.category)} stands out as a strength.`;
}

function normalConcernSentenceEn(analysis: CommentAnalysis): string | null {
  const { primaryConcern: concern, confidence } = analysis;
  const confidenceNote = confidence === "low" ? "This is only a reference given how few categories could be rated, but " : "";
  switch (concern.kind) {
    case "referenceError":
      return `${concern.count} player(s) cannot be evaluated accurately because their saved build reference is broken. Re-selecting a saved build for those slots will give a more accurate diagnosis.`;
    case "dataInsufficient":
      return "No field players are currently placed in the starting line-up, so there is nothing to evaluate yet. Placing starters will make a diagnosis possible.";
    case "structural":
      return `${confidenceNote}there is room to improve starting line-up completeness (the number of starters and how well they fit their positions). Filling empty slots or reviewing positional fit is a good place to start.`;
    case "savedBuildMissing":
      return `${concern.count} starting player(s) out of ${concern.total} have no saved build set. This diagnosis does not yet reflect their state after progression. Re-running the diagnosis after setting up saved builds will give a result closer to actual use.`;
    case "category":
      return `${confidenceNote}${categoryLabelEn(concern.category)} is relatively low, leaving room for improvement.`;
    case "none":
      return null;
  }
}

function normalContradictionSentenceEn(analysis: CommentAnalysis): string | null {
  const c = pickNonRedundantContradictionEn(analysis.contradictions, analysis.primaryConcern);
  return c ? relationshipDescriptionEn(c.highCategory, c.lowCategory) : null;
}

function normalPrioritySentenceEn(analysis: CommentAnalysis, priorities: ImprovementPriority[]): string | null {
  const { primaryConcern } = analysis;
  if (priorities.length === 0) return null;
  const restatesFirst = priorityRestatesConcernEn(priorities[0], primaryConcern);
  const rest = restatesFirst ? priorities.slice(1) : priorities;
  if (restatesFirst) {
    if (rest.length === 0) return null;
    if (rest.length === 1) return `${rest[0].label} is also worth reviewing for further improvement.`;
    return `${rest[0].label}, and then ${rest[1].label}, are worth reviewing for further improvement.`;
  }
  if (rest.length === 1) return `Reviewing ${rest[0].label} first would be effective.`;
  return `Reviewing ${rest[0].label} first, then ${rest[1].label}, would be effective.`;
}

function normalClosingSentenceEn(result: SquadDiagnosisResult, hasBody: boolean): string {
  if (result.overall.score == null) return "";
  if (!hasBody) {
    return "No notable weaknesses stand out right now — this is a well-balanced build.";
  }
  return "This evaluation is based on registered data and does not guarantee actual match results.";
}

export function buildNormalCommentEn(analysis: CommentAnalysis, result: SquadDiagnosisResult): string {
  if (analysis.primaryConcern.kind === "dataInsufficient") {
    return normalConcernSentenceEn(analysis)!;
  }

  const priorities = buildImprovementPrioritiesEn(analysis);
  const parts: string[] = [];
  const overview = overallInterpretationSentenceEn(result, analysis);
  const strengthSentence = normalStrengthSentenceEn(analysis);
  const concernSentence = normalConcernSentenceEn(analysis);
  const contradictionSentence = normalContradictionSentenceEn(analysis);
  const prioritySentence = normalPrioritySentenceEn(analysis, priorities);

  if (overview) parts.push(overview);
  if (strengthSentence) parts.push(strengthSentence);
  if (concernSentence) parts.push(concernSentence);
  if (contradictionSentence) parts.push(contradictionSentence);
  if (prioritySentence) parts.push(prioritySentence);

  const closing = normalClosingSentenceEn(result, parts.length > 0);
  if (closing) parts.push(closing);

  if (parts.length === 0) {
    return "The current data isn't enough to identify clear strengths or weaknesses. Placing more starters or setting up more saved builds will allow for a more specific diagnosis.";
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// 辛口コメント（英語）
// ---------------------------------------------------------------------------

function harshOverallVerdictEn(result: SquadDiagnosisResult, analysis: CommentAnalysis): string | null {
  const tier = result.overall.tier;
  if (tier == null) return null;
  const { gapLevel, profile } = analysis;

  if ((tier === "S" || tier === "A") && (gapLevel === "large" || gapLevel === "extreme")) {
    return "Judging this build as finished from the overall score alone would be premature — it is not as well-rounded as the headline number suggests.";
  }
  if (tier === "B" && (gapLevel === "large" || gapLevel === "extreme")) {
    return "The overall rating sits in the middle, but the category breakdown is lopsided — this is not a well-finished build.";
  }
  if (profile.type === "lackingWeapon") {
    return "The build lacks a clear strength, so a high total score alone is no reason for comfort.";
  }
  return null;
}

function harshConcernSentenceEn(
  analysis: CommentAnalysis,
  result: SquadDiagnosisResult,
): { issue: string; impact: string } | null {
  const { primaryConcern: concern, confidence } = analysis;
  const confidenceNote = confidence === "low" ? "The rated sample is small, so this is a narrow read, but " : "";
  switch (concern.kind) {
    case "referenceError":
      return {
        issue: `${concern.count} player(s) have a broken saved build reference, and that cannot be left as is.`,
        impact: "With reference errors present, refining the ability evaluation any further isn't worthwhile yet. Fix the saved build references first.",
      };
    case "dataInsufficient":
      return {
        issue: "No field players are placed in the starting line-up, so there is nothing to evaluate.",
        impact: "As it stands, neither the overall rating nor any category rating can be produced.",
      };
    case "structural":
      return {
        issue: `${confidenceNote}starting line-up completeness (the number of starters and how well they fit) is a clear weak point.`,
        impact: "The headline overall rating alone does not reveal this placement problem.",
      };
    case "savedBuildMissing": {
      const completeness = result.categories.find((c) => c.id === "squadCompleteness") ?? null;
      const placementNote =
        completeness && (completeness.tier === "S" || completeness.tier === "A")
          ? "The starting line-up is well filled out."
          : "There is no major shortfall in the starting line-up.";
      const scoreText = result.overall.score != null ? `${result.overall.score} pts` : "not available";
      const tierText = result.overall.tier ?? "—";
      return {
        issue: `${placementNote} However, ${concern.count} starting player(s) out of ${concern.total} have no saved build set. Those players are evaluated on their current settings rather than a saved build that reflects their progression.`,
        impact: `The overall rating (${scoreText}, grade ${tierText}) is computed from the categories that could be rated and is not an invalid result. Still, it does not fully reflect the finished state after progression, so treating it as a final verdict would be premature. Set up saved builds for the affected players and re-run the diagnosis before fine-tuning tactics or placement.`,
      };
    }
    case "category":
      return {
        issue: `${confidenceNote}${categoryLabelEn(concern.category)} is rated low, and that's not something to overlook.`,
        impact: `Leaving ${categoryLabelEn(concern.category)} this low risks cancelling out the build's other strengths — this needs attention.`,
      };
    case "none":
      return null;
  }
}

function harshSecondarySentenceEn(secondary: PrimaryConcern): string | null {
  switch (secondary.kind) {
    case "structural":
      return "On top of that, starting line-up completeness still has room to improve.";
    case "category":
      return `On top of that, ${categoryLabelEn(secondary.category)} is also relatively low — a secondary issue that shouldn't be ignored.`;
    default:
      return null;
  }
}

function harshPrioritySentenceEn(analysis: CommentAnalysis, priorities: ImprovementPriority[]): string | null {
  const { primaryConcern } = analysis;
  if (priorities.length === 0) return null;
  const restatesFirst = priorityRestatesConcernEn(priorities[0], primaryConcern);
  const rest = restatesFirst ? priorities.slice(1) : priorities;
  if (restatesFirst) {
    if (rest.length === 0) return null;
    if (rest.length === 1) return `${rest[0].label} should not be left alone either.`;
    return `${rest[0].label} should come next, followed by ${rest[1].label}.`;
  }
  if (rest.length === 1) return `${rest[0].label} should be the top priority.`;
  return `${rest[0].label} should be the top priority, followed by ${rest[1].label}. Raising the lowest-rated category does more for overall balance than pushing an existing strength further.`;
}

function harshStrengthMentionEn(analysis: CommentAnalysis): string | null {
  const { primaryStrength: strength, primaryConcern: concern } = analysis;
  if (strength.kind === "none") return null;
  if (concern.kind !== "none") {
    return `${categoryLabelEn(strength.category)} is at a high level, but the build cannot rely on that alone.`;
  }
  return `${categoryLabelEn(strength.category)} is at a high level.`;
}

export function buildHarshCommentEn(analysis: CommentAnalysis, result: SquadDiagnosisResult): string {
  if (analysis.primaryConcern.kind === "dataInsufficient") {
    const c = harshConcernSentenceEn(analysis, result)!;
    return `${c.issue} ${c.impact}`;
  }

  const priorities = buildImprovementPrioritiesEn(analysis);
  const paragraphs: string[] = [];

  const opening: string[] = [];
  const verdict = harshOverallVerdictEn(result, analysis);
  if (verdict) opening.push(verdict);
  const concernInfo = harshConcernSentenceEn(analysis, result);
  if (concernInfo) {
    opening.push(concernInfo.issue);
    opening.push(concernInfo.impact);
  }
  if (opening.length > 0) paragraphs.push(opening.join(" "));

  const contradiction = pickNonRedundantContradictionEn(analysis.contradictions, analysis.primaryConcern);
  if (contradiction) {
    paragraphs.push(relationshipDescriptionEn(contradiction.highCategory, contradiction.lowCategory));
  }

  const middle: string[] = [];
  const secondary = harshSecondarySentenceEn(analysis.secondaryConcern);
  if (secondary) middle.push(secondary);
  const priority = harshPrioritySentenceEn(analysis, priorities);
  if (priority) middle.push(priority);
  if (middle.length > 0) paragraphs.push(middle.join(" "));

  const strengthMention = harshStrengthMentionEn(analysis);
  if (strengthMention) paragraphs.push(strengthMention);

  if (paragraphs.length === 0) {
    return "No standout weaknesses were found. There is no need to invent flaws — within the scope of the registered data, maintaining the current build while continuing to review progression and build settings is enough.";
  }
  return paragraphs.join("\n\n");
}

export function generateSquadDiagnosisCommentsEn(result: SquadDiagnosisResult): SquadDiagnosisComments {
  const analysis = analyzeSquadDiagnosis(result);
  return {
    normal: buildNormalCommentEn(analysis, result),
    harsh: buildHarshCommentEn(analysis, result),
  };
}
