import type {
  SquadDiagnosisResult,
  SquadDiagnosisCategory,
  SquadDiagnosisCategoryId,
  SquadDiagnosisTier,
} from "./squad-diagnosis";

/**
 * スカッド診断の「通常コメント」「辛口コメント」を生成する、決定的なルールベースの純関数レイヤー。
 *
 * 設計原則:
 *  - 入力は既存の `SquadDiagnosisResult`（診断エンジンが既に算出した結果）だけ。
 *    生成AI・外部API・HTTP通信・localStorage/SQLite/DOMアクセス・Math.random・日時分岐は一切使用しない。
 *  - `squad-diagnosis.ts` のスコア計算・ランク判定・長所/弱点/改善候補の既存選出基準は再評価しない
 *    （このモジュールは既存結果を「読んで比較・整理し、文章に組み立てる」だけの後段レイヤー）。
 *  - 同じ `SquadDiagnosisResult` からは、常に同じ分析結果（`CommentAnalysis`）・同じコメントを返す。
 *  - 判定対象外（null）を弱点として扱わない。データ不足・参照エラーは能力上の弱点と混同しない。
 *  - 存在しない長所・弱点・改善候補・カテゴリ間の矛盾を創作しない。
 *  - 全国順位・勝率・プレイヤースキル・他ユーザーとの比較は一切含めない。
 *  - 通常/辛口の両方が同一の `CommentAnalysis`（分析結果）から文章を組み立てる二段構成とし、
 *    将来の多言語化・無料/Pro分離の際も「分析」と「文章生成」の責務を分離したまま拡張できるようにする
 *    （今回、国際化・認証・課金は実装しない）。
 */

// ---------------------------------------------------------------------------
// 定数（優先順位・閾値を明示する。マジックナンバーを式へ直書きしない）
// ---------------------------------------------------------------------------

/**
 * 判定可能カテゴリ数がこの値未満の場合、「参考情報」であることを明示し、構成傾向の断定も避ける。
 * 8カテゴリ中、半分未満しか判定できない状態を「確信度が低い」とみなす。
 */
export const LOW_CONFIDENCE_RATED_CATEGORY_THRESHOLD = 4;

/** 選手配置の充足状況カテゴリがこのランク以下なら「重大な構造上の問題」として扱う。 */
const STRUCTURAL_CONCERN_TIERS: SquadDiagnosisTier[] = ["D", "C"];

/**
 * 最高評価カテゴリが「特化型」の根拠になるためには、2番目に高いカテゴリとの差が
 * この点数以上必要（僅差の1位だけで特化型と断定しないための余白）。
 */
const PROFILE_FEATURE_MARGIN = 8;

/**
 * 最高/最低カテゴリの点差の段階分け（既存のランク境界の間隔感（各15点前後）を目安に設定）。
 * 大きい方から順に判定する。
 */
const GAP_LEVEL_THRESHOLDS: { level: "extreme" | "large" | "moderate" | "small"; min: number }[] = [
  { level: "extreme", min: 30 },
  { level: "large", min: 20 },
  { level: "moderate", min: 10 },
  { level: "small", min: 0 },
];

/** カテゴリ間の「構成上の矛盾」候補として扱うために必要な最小点差（= 上表の "large" 相当）。 */
const CONTRADICTION_MIN_GAP = GAP_LEVEL_THRESHOLDS.find((t) => t.level === "large")!.min;

export type SquadDiagnosisCommentMode = "normal" | "harsh";

export interface SquadDiagnosisComments {
  normal: string;
  harsh: string;
}

// ---------------------------------------------------------------------------
// 内部ユーティリティ（既存結果の「読み取り」だけ・スコアの再計算はしない）
// ---------------------------------------------------------------------------

/** `result.categories` は診断エンジン側で ABILITY_CATEGORIES と同じ固定順（単一の真実源）で並んでいる。 */
function abilityCategoriesOf(result: SquadDiagnosisResult): SquadDiagnosisCategory[] {
  return result.categories.filter((c) => c.id !== "squadCompleteness");
}

function completenessOf(result: SquadDiagnosisResult): SquadDiagnosisCategory | null {
  return result.categories.find((c) => c.id === "squadCompleteness") ?? null;
}

/**
 * 判定済み（score が null でない）カテゴリの中から、最も高い/低いスコアのものを1件選ぶ。
 * 同点の場合は `result.categories`（= ABILITY_CATEGORIES 定義順）で先に現れる方を採用する
 * （Object.keys 等の暗黙順に依存しない、固定のタイブレーク規則）。
 */
function extremeCategory(
  categories: SquadDiagnosisCategory[],
  direction: "max" | "min",
): SquadDiagnosisCategory | null {
  let best: SquadDiagnosisCategory | null = null;
  for (const c of categories) {
    if (c.score == null) continue;
    if (best == null) {
      best = c;
      continue;
    }
    if (direction === "max" && c.score > best.score!) best = c;
    if (direction === "min" && c.score < best.score!) best = c;
  }
  return best;
}

/**
 * 判定済みカテゴリを高い順に並べ替える。同点の場合は元配列の並び順（= ABILITY_CATEGORIES 定義順）で
 * 先に現れる方を上位に置く（sort の安定性に暗黙に依存せず、元のインデックスを明示的に比較する）。
 * これは既存の `extremeCategory(..., "max")` と同じタイブレーク規則（同点は先着優先）。
 */
function sortByScoreDesc(categories: SquadDiagnosisCategory[]): SquadDiagnosisCategory[] {
  return categories
    .map((c, idx) => ({ c, idx }))
    .sort((a, b) => b.c.score! - a.c.score! || a.idx - b.idx)
    .map((x) => x.c);
}

/**
 * 判定済みカテゴリを低い順に並べ替える。同点の場合も元配列の並び順で先に現れる方を上位（＝より低い方の代表）に置く。
 * これは既存の `extremeCategory(..., "min")` と同じタイブレーク規則（同点は先着優先）であり、
 * `sortByScoreDesc` の末尾を取る方法（同点内で最後の要素を拾ってしまう）とは異なる、独立した昇順ソート。
 */
function sortByScoreAsc(categories: SquadDiagnosisCategory[]): SquadDiagnosisCategory[] {
  return categories
    .map((c, idx) => ({ c, idx }))
    .sort((a, b) => a.c.score! - b.c.score! || a.idx - b.idx)
    .map((x) => x.c);
}

function isLowConfidence(ratedCount: number): boolean {
  return ratedCount > 0 && ratedCount < LOW_CONFIDENCE_RATED_CATEGORY_THRESHOLD;
}

function determineGapLevel(gap: number): "extreme" | "large" | "moderate" | "small" {
  for (const t of GAP_LEVEL_THRESHOLDS) {
    if (gap >= t.min) return t.level;
  }
  return "small";
}

// ---------------------------------------------------------------------------
// 「最重要の懸念」「最大の強み」の選出（固定優先順位）
// ---------------------------------------------------------------------------

export type PrimaryConcern =
  | { kind: "referenceError"; count: number }
  | { kind: "dataInsufficient" }
  | { kind: "structural"; category: SquadDiagnosisCategory }
  /** 保存ビルド未設定（先発・カード解決済みのみ対象）。能力上の弱点・参照エラー・データ不足とは別種別。 */
  | { kind: "savedBuildMissing"; count: number; total: number }
  | { kind: "category"; category: SquadDiagnosisCategory }
  | { kind: "none" };

export type PrimaryStrength =
  | { kind: "category"; category: SquadDiagnosisCategory }
  | { kind: "none" };

/**
 * 最も優先すべき懸念事項を1件選ぶ（固定優先順位）:
 *   1) 削除済み保存ビルド参照などの重大な参照エラー
 *   2) 診断を成立させられない重大なデータ不足（判定可能カテゴリが0）
 *   3) 選手配置の充足状況が著しく低い（構造上の問題）
 *   4) 保存ビルド未設定（先発・カード解決済みの選手が対象。能力カテゴリの点数より先に扱う。
 *      理由: カテゴリスコアが一見問題なくても、育成後の実態を反映していない可能性があるため、
 *      細かな戦術・カテゴリ分析より前に、評価の前提となるデータの完成度を優先して案内する）
 *   5) 著しく低いカテゴリ（Dランク）
 *   6) 相対的に低いカテゴリ（Cランク、Dが無い場合のみ）
 *   問題が無ければ { kind: "none" }。
 */
export function selectPrimaryConcern(result: SquadDiagnosisResult): PrimaryConcern {
  if (result.dataQuality.brokenSavedBuildRefCount > 0) {
    return { kind: "referenceError", count: result.dataQuality.brokenSavedBuildRefCount };
  }
  if (result.overall.score == null) {
    return { kind: "dataInsufficient" };
  }
  const completeness = completenessOf(result);
  if (completeness && completeness.tier && STRUCTURAL_CONCERN_TIERS.includes(completeness.tier)) {
    return { kind: "structural", category: completeness };
  }
  if (result.dataQuality.missingSavedBuildCount > 0) {
    return {
      kind: "savedBuildMissing",
      count: result.dataQuality.missingSavedBuildCount,
      total: result.dataQuality.filledStartingSlots,
    };
  }
  const ability = abilityCategoriesOf(result);
  const worst = extremeCategory(ability, "min");
  if (worst && (worst.tier === "D" || worst.tier === "C")) {
    return { kind: "category", category: worst };
  }
  return { kind: "none" };
}

/**
 * 二次的な懸念を1件選ぶ（最重要の懸念と同じ内容を繰り返さない）。
 *  - 最重要がデータ不足の場合、それ以上の分析材料が無いため二次的な懸念は選ばない。
 *  - 最重要が参照エラーの場合、能力面の細かな指摘は精密評価が制限された状態と噛み合わないため、
 *    構造上の重大な問題（選手配置の充足状況）だけを補足的に扱う。
 *  - 最重要が構造上の問題の場合、著しく低い能力カテゴリがあれば二次的な懸念にする。
 *  - 最重要が保存ビルド未設定の場合、著しく低い能力カテゴリがあれば二次的な懸念にする
 *    （保存ビルド未設定と能力上の弱点は別種別のため、混同せず両方を提示できるようにする）。
 *  - 最重要が能力カテゴリの場合、それとは異なる、次に低い能力カテゴリ（D/Cランク）を二次的な懸念にする。
 */
export function selectSecondaryConcern(result: SquadDiagnosisResult, primary: PrimaryConcern): PrimaryConcern {
  if (primary.kind === "dataInsufficient" || primary.kind === "none") return { kind: "none" };

  if (primary.kind === "referenceError") {
    const completeness = completenessOf(result);
    if (completeness && completeness.tier && STRUCTURAL_CONCERN_TIERS.includes(completeness.tier)) {
      return { kind: "structural", category: completeness };
    }
    return { kind: "none" };
  }

  if (primary.kind === "structural" || primary.kind === "savedBuildMissing") {
    const ability = abilityCategoriesOf(result);
    const worst = extremeCategory(ability, "min");
    if (worst && (worst.tier === "D" || worst.tier === "C")) {
      return { kind: "category", category: worst };
    }
    return { kind: "none" };
  }

  // primary.kind === "category"
  const ability = abilityCategoriesOf(result).filter((c) => c.id !== primary.category.id);
  const worst = extremeCategory(ability, "min");
  if (worst && (worst.tier === "D" || worst.tier === "C")) {
    return { kind: "category", category: worst };
  }
  return { kind: "none" };
}

/**
 * 主要な強みを1件選ぶ: 著しく高いカテゴリ（S）優先、無ければ相対的に高いカテゴリ（A）。
 * 該当がなければ { kind: "none" }（架空の長所を作らない）。
 */
export function selectPrimaryStrength(result: SquadDiagnosisResult): PrimaryStrength {
  const ability = abilityCategoriesOf(result);
  const best = extremeCategory(ability, "max");
  if (best && (best.tier === "S" || best.tier === "A")) {
    return { kind: "category", category: best };
  }
  return { kind: "none" };
}

/**
 * 二次的な強みを1件選ぶ。条件を満たす場合だけ（S/Aランクかつ主要な強みとの差が小さい）採用する。
 * 無理に2件目を作らない（差が大きい場合や、そもそも高評価カテゴリが1つしかない場合は none）。
 */
const SECONDARY_STRENGTH_MAX_GAP = GAP_LEVEL_THRESHOLDS.find((t) => t.level === "moderate")!.min;

export function selectSecondaryStrength(result: SquadDiagnosisResult, primary: PrimaryStrength): PrimaryStrength {
  if (primary.kind === "none") return { kind: "none" };
  const ability = abilityCategoriesOf(result).filter((c) => c.id !== primary.category.id);
  const second = extremeCategory(ability, "max");
  if (!second || (second.tier !== "S" && second.tier !== "A")) return { kind: "none" };
  const gap = primary.category.score! - second.score!;
  if (gap > SECONDARY_STRENGTH_MAX_GAP) return { kind: "none" };
  return { kind: "category", category: second };
}

// ---------------------------------------------------------------------------
// 構成傾向（プロファイル）判定
// ---------------------------------------------------------------------------

export type SquadProfileType =
  | "attackOriented"
  | "defenseOriented"
  | "speedOriented"
  | "buildUpOriented"
  | "possessionOriented"
  | "pressOriented"
  | "counterOriented"
  | "aerialOriented"
  | "balanced"
  | "lackingWeapon"
  | "unclassified";

export interface SquadProfile {
  type: SquadProfileType;
  label: string;
}

const PROFILE_LABELS: Record<SquadProfileType, string> = {
  attackOriented: "攻撃偏重型",
  defenseOriented: "守備安定型",
  speedOriented: "スピード志向型",
  buildUpOriented: "パス・ビルドアップ志向型",
  possessionOriented: "ドリブル・ボール保持志向型",
  pressOriented: "プレス志向型",
  counterOriented: "カウンター志向型",
  aerialOriented: "空中戦に強みがある構成",
  balanced: "バランス型",
  lackingWeapon: "明確な武器が不足している構成",
  unclassified: "データ不足により分類できない構成",
};

/** 最高評価カテゴリのIDから、対応する「特化型」プロファイルへの対応表（Object.keys順に依存しない直接引き）。 */
const PROFILE_TYPE_BY_CATEGORY: Record<Exclude<SquadDiagnosisCategoryId, "squadCompleteness">, SquadProfileType> = {
  attack: "attackOriented",
  defense: "defenseOriented",
  speed: "speedOriented",
  passBuildUp: "buildUpOriented",
  dribblePossession: "possessionOriented",
  pressResistance: "pressOriented",
  counterAttack: "counterOriented",
  aerial: "aerialOriented",
};

/**
 * 最高評価カテゴリが「特化型」の根拠になるかどうかは、2位カテゴリとの差ではなく、
 * 「残り全カテゴリの平均」との差で判定する。2位が僅差で並んでいても、両方が突出していて
 * 他のカテゴリより明確に高い場合は、依然として最高評価カテゴリを軸にした特化型として扱ってよい
 * （逆に、僅差の1位だけが他の大半のカテゴリとも僅差の場合は、特化型と断定しない）。
 */
function isDominantCategory(highest: SquadDiagnosisCategory, rated: SquadDiagnosisCategory[]): boolean {
  const rest = rated.filter((c) => c.id !== highest.id);
  if (rest.length === 0) return true;
  const restAvg = rest.reduce((a, c) => a + c.score!, 0) / rest.length;
  return highest.score! - restAvg >= PROFILE_FEATURE_MARGIN;
}

function detectSquadProfile(ratedCategories: SquadDiagnosisCategory[], highest: SquadDiagnosisCategory | null): SquadProfile {
  if (isLowConfidence(ratedCategories.length) || ratedCategories.length === 0) {
    return { type: "unclassified", label: PROFILE_LABELS.unclassified };
  }
  if (highest && (highest.tier === "S" || highest.tier === "A") && isDominantCategory(highest, ratedCategories)) {
    const type = PROFILE_TYPE_BY_CATEGORY[highest.id as Exclude<SquadDiagnosisCategoryId, "squadCompleteness">];
    if (type) return { type, label: PROFILE_LABELS[type] };
  }
  const allLowOrMid = ratedCategories.every((c) => c.tier === "C" || c.tier === "D");
  if (allLowOrMid) {
    return { type: "lackingWeapon", label: PROFILE_LABELS.lackingWeapon };
  }
  return { type: "balanced", label: PROFILE_LABELS.balanced };
}

// ---------------------------------------------------------------------------
// カテゴリ間の関係（構成上の矛盾候補）
// ---------------------------------------------------------------------------

export interface CategoryRelationship {
  highCategory: SquadDiagnosisCategory;
  lowCategory: SquadDiagnosisCategory;
  gap: number;
  /** 「①どの長所があるか→②どの関連カテゴリが不足しているか→③生かし切れていない可能性」を1文で表す。 */
  description: string;
}

/**
 * 「一方が高く、関連する一方が著しく低い」組み合わせの固定リスト（§7の検討候補に対応）。
 * 十分な点差（`CONTRADICTION_MIN_GAP`）と評価差（高い方がS/A・低い方がC/D）がある場合だけ矛盾候補にする。
 * 定義順を、複数該当したときの優先順位（タイブレーク）として使う。
 */
const CATEGORY_RELATIONSHIP_RULES: { highId: SquadDiagnosisCategoryId; lowId: SquadDiagnosisCategoryId }[] = [
  { highId: "attack", lowId: "passBuildUp" },
  { highId: "attack", lowId: "dribblePossession" },
  { highId: "speed", lowId: "passBuildUp" },
  { highId: "pressResistance", lowId: "defense" },
  { highId: "counterAttack", lowId: "speed" },
  { highId: "defense", lowId: "aerial" },
  { highId: "passBuildUp", lowId: "dribblePossession" },
  { highId: "attack", lowId: "defense" },
  { highId: "defense", lowId: "attack" },
];

function relationshipDescription(high: SquadDiagnosisCategory, low: SquadDiagnosisCategory): string {
  return `${high.label}の評価は高い一方で、${low.label}が著しく低く、${high.label}の強みを十分に生かし切れていない可能性があります。`;
}

/** 判定対象外カテゴリを除外した上で、矛盾候補を最大2件、点差の大きい順（同点はルール定義順）で返す。 */
function detectContradictions(result: SquadDiagnosisResult): CategoryRelationship[] {
  const byId = new Map(abilityCategoriesOf(result).map((c) => [c.id, c]));
  const candidates: { rel: CategoryRelationship; ruleIndex: number }[] = [];

  CATEGORY_RELATIONSHIP_RULES.forEach((rule, ruleIndex) => {
    const high = byId.get(rule.highId);
    const low = byId.get(rule.lowId);
    if (!high || !low || high.score == null || low.score == null) return;
    if (high.tier !== "S" && high.tier !== "A") return;
    if (low.tier !== "C" && low.tier !== "D") return;
    const gap = high.score - low.score;
    if (gap < CONTRADICTION_MIN_GAP) return;
    candidates.push({
      rel: { highCategory: high, lowCategory: low, gap, description: relationshipDescription(high, low) },
      ruleIndex,
    });
  });

  return candidates
    .sort((a, b) => b.rel.gap - a.rel.gap || a.ruleIndex - b.ruleIndex)
    .slice(0, 2)
    .map((c) => c.rel);
}

/** 主要な懸念とまったく同じ弱点カテゴリを繰り返さない矛盾候補を1件選ぶ（無ければ null）。 */
function pickNonRedundantContradiction(
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
// 改善優先順位（最大3件）
// ---------------------------------------------------------------------------

export interface ImprovementPriority {
  rank: 1 | 2 | 3;
  label: string;
  reason: string;
  /** 維持すべき長所（あれば・最上位の項目にだけ付与し、重複表示を避ける）。 */
  keepStrength: string | null;
}

function concernToPriorityLabelAndReason(concern: PrimaryConcern): { label: string; reason: string } | null {
  switch (concern.kind) {
    case "referenceError":
      return {
        label: "保存ビルド参照の修正",
        reason: `参照エラーが${concern.count}件あります。解消するまで能力面の評価は正確になりません。`,
      };
    case "dataInsufficient":
      return { label: "先発の配置", reason: "先発にフィールドプレイヤーが配置されておらず、評価が成立していません。" };
    case "structural":
      return {
        label: "選手配置の充足状況の見直し",
        reason: `配置人数・適性の不足（${concern.category.score}点）が、評価全体の土台に影響しています。`,
      };
    case "savedBuildMissing":
      return {
        label: "保存ビルドの設定",
        reason: `保存ビルド未設定の選手が${concern.count}人います（先発${concern.total}人中）。設定すると、育成後の実態に近い評価になります。`,
      };
    case "category":
      return {
        label: `${concern.category.label}の底上げ`,
        reason: `${concern.category.label}が${concern.category.tier}ランク（${concern.category.score}点）と低く、構成全体の弱点になっています。`,
      };
    case "none":
      return null;
  }
}

function buildImprovementPriorities(
  result: SquadDiagnosisResult,
  primaryConcern: PrimaryConcern,
  secondaryConcern: PrimaryConcern,
  primaryStrength: PrimaryStrength,
): ImprovementPriority[] {
  const items: ImprovementPriority[] = [];
  const usedCategoryIds = new Set<string>();
  const keepStrength = primaryStrength.kind === "category" ? primaryStrength.category.label : null;

  const first = concernToPriorityLabelAndReason(primaryConcern);
  if (first) {
    if (primaryConcern.kind === "category") usedCategoryIds.add(primaryConcern.category.id);
    items.push({ rank: 1, label: first.label, reason: first.reason, keepStrength });
  }

  if (items.length < 3) {
    const isDuplicateCategory = secondaryConcern.kind === "category" && usedCategoryIds.has(secondaryConcern.category.id);
    if (!isDuplicateCategory) {
      const second = concernToPriorityLabelAndReason(secondaryConcern);
      if (second) {
        if (secondaryConcern.kind === "category") usedCategoryIds.add(secondaryConcern.category.id);
        items.push({ rank: (items.length + 1) as 1 | 2 | 3, label: second.label, reason: second.reason, keepStrength: null });
      }
    }
  }

  if (items.length < 3) {
    const existingReasons = new Set(items.map((i) => i.reason));
    const existingLabels = new Set(items.map((i) => i.label));
    const suggestion = result.suggestions.find((s) => !existingReasons.has(s.detail) && !existingLabels.has(s.label));
    if (suggestion) {
      items.push({ rank: (items.length + 1) as 1 | 2 | 3, label: suggestion.label, reason: suggestion.detail, keepStrength: null });
    }
  }

  return items.slice(0, 3);
}

// ---------------------------------------------------------------------------
// 詳細分析モデル（CommentAnalysis） — 通常/辛口の両方が、この単一の分析結果から文章を組み立てる
// ---------------------------------------------------------------------------

export interface CommentAnalysis {
  ratedCount: number;
  confidence: "low" | "normal";
  highest: SquadDiagnosisCategory | null;
  secondHighest: SquadDiagnosisCategory | null;
  lowest: SquadDiagnosisCategory | null;
  secondLowest: SquadDiagnosisCategory | null;
  /** 最高点と最低点の差（判定対象外は含まない）。判定可能カテゴリが1件以下なら null。 */
  scoreGap: number | null;
  gapLevel: "extreme" | "large" | "moderate" | "small" | "unknown";
  profile: SquadProfile;
  primaryStrength: PrimaryStrength;
  secondaryStrength: PrimaryStrength;
  primaryConcern: PrimaryConcern;
  secondaryConcern: PrimaryConcern;
  /** 十分な根拠がある場合だけ含まれる、カテゴリ間の構成上の矛盾候補（最大2件・点差の大きい順）。 */
  contradictions: CategoryRelationship[];
  /** 改善優先順位（最大3件）。既存の改善候補・懸念の優先順位から組み立てる（架空の予測値は含まない）。 */
  improvementPriorities: ImprovementPriority[];
}

/**
 * 既存の `SquadDiagnosisResult` から、コメント生成に必要な分析結果を作る純関数。
 * 診断スコア・ランクを再計算せず、既に算出済みの値を比較・整理するだけ。
 * 同一の `result` からは常に同一の `CommentAnalysis` を返す（Object.keys順・sort安定性に依存しない）。
 */
export function analyzeSquadDiagnosis(result: SquadDiagnosisResult): CommentAnalysis {
  const ability = abilityCategoriesOf(result);
  const rated = ability.filter((c) => c.score != null);
  const sortedDesc = sortByScoreDesc(rated);
  const sortedAsc = sortByScoreAsc(rated);

  const highest = sortedDesc[0] ?? null;
  const secondHighest = sortedDesc.length >= 2 ? sortedDesc[1] : null;
  const lowest = sortedAsc[0] ?? null;
  const secondLowest = sortedAsc.length >= 2 ? sortedAsc[1] : null;
  const scoreGap = highest && lowest && rated.length >= 2 ? highest.score! - lowest.score! : null;
  const gapLevel = scoreGap == null ? "unknown" : determineGapLevel(scoreGap);

  const confidence: "low" | "normal" = isLowConfidence(rated.length) ? "low" : "normal";
  const profile = detectSquadProfile(rated, highest);

  const primaryConcern = selectPrimaryConcern(result);
  const secondaryConcern = selectSecondaryConcern(result, primaryConcern);
  const primaryStrength = selectPrimaryStrength(result);
  const secondaryStrength = selectSecondaryStrength(result, primaryStrength);

  const contradictions = detectContradictions(result);
  const improvementPriorities = buildImprovementPriorities(result, primaryConcern, secondaryConcern, primaryStrength);

  return {
    ratedCount: rated.length,
    confidence,
    highest,
    secondHighest,
    lowest,
    secondLowest,
    scoreGap,
    gapLevel,
    profile,
    primaryStrength,
    secondaryStrength,
    primaryConcern,
    secondaryConcern,
    contradictions,
    improvementPriorities,
  };
}

// ---------------------------------------------------------------------------
// 通常コメント
// ---------------------------------------------------------------------------

function overallInterpretationSentence(result: SquadDiagnosisResult, analysis: CommentAnalysis): string | null {
  const tier = result.overall.tier;
  if (tier == null) return null;
  const { gapLevel, profile, highest } = analysis;

  if (analysis.confidence === "low") {
    return "判定できた項目がまだ少ないため、構成傾向を明確に判定できる段階ではありません。";
  }
  if ((tier === "S" || tier === "A") && (gapLevel === "large" || gapLevel === "extreme")) {
    return "総合評価は高めですが、カテゴリ間の差が大きく、全体が均等に整った構成ではありません。";
  }
  if ((tier === "S" || tier === "A") && (gapLevel === "small" || gapLevel === "moderate")) {
    return "総合評価が高く、カテゴリ間の差も小さいため、完成度の高いバランス型の構成です。";
  }
  if (profile.type === "lackingWeapon") {
    return "総合評価は低めで、特定の強みよりも全体的な底上げが必要な段階です。";
  }
  if (tier === "B" && (gapLevel === "large" || gapLevel === "extreme")) {
    return "総合評価は中程度ですが、カテゴリ間の差が大きく、一部のカテゴリが全体の評価を押し下げています。";
  }
  if (tier === "B") {
    return "突出した武器は少ない一方、大きな穴も少ないバランス型の構成です。";
  }
  if (highest && (highest.tier === "S" || highest.tier === "A")) {
    return `総合評価は低めですが、${highest.label}には一定の評価が見られます。他のカテゴリの底上げが優先されます。`;
  }
  return "総合評価は低めで、複数のカテゴリに底上げの余地があります。";
}

function normalStrengthSentence(analysis: CommentAnalysis): string | null {
  const { primaryStrength, secondaryStrength } = analysis;
  if (primaryStrength.kind === "none") return null;
  if (secondaryStrength.kind === "category") {
    return `${primaryStrength.category.label}と${secondaryStrength.category.label}に強みがある構成です。`;
  }
  return `${primaryStrength.category.label}に強みがある構成です。`;
}

function normalConcernSentence(analysis: CommentAnalysis): string | null {
  const { primaryConcern: concern, confidence } = analysis;
  const confidenceNote = confidence === "low" ? "判定できた項目がまだ少ないため参考情報にはなりますが、" : "";
  switch (concern.kind) {
    case "referenceError":
      return `保存ビルドの参照に問題があり、正確に評価できない選手が${concern.count}人います。該当する枠の保存ビルドを選び直すと、より正確な診断結果になります。`;
    case "dataInsufficient":
      return "現在は先発にフィールドプレイヤーが配置されておらず、評価できる項目がありません。先発を配置すると診断できるようになります。";
    case "structural":
      return `${confidenceNote}選手配置の充足状況（先発の人数や配置適性）に改善余地があります。空き枠への配置や適性の見直しから始めると効果的です。`;
    case "savedBuildMissing":
      return `保存ビルド未設定の選手が${concern.count}人います（先発${concern.total}人中）。現在の診断には育成後の状態が十分に反映されていません。保存ビルドを設定してから再診断すると、より実際の使用状態に近い評価になります。`;
    case "category":
      return `${confidenceNote}${concern.category.label}の評価が相対的に低く、改善の余地があります。`;
    case "none":
      return null;
  }
}

function normalContradictionSentence(analysis: CommentAnalysis): string | null {
  const c = pickNonRedundantContradiction(analysis.contradictions, analysis.primaryConcern);
  if (!c) return null;
  return c.description;
}

/**
 * 改善優先順位の1位が、すでに懸念文（`normalConcernSentence`/`harshConcernSentence`）で
 * 名指し済みの内容と同じかどうかを判定する。同じ場合は、優先順位文で同じ指摘を言い換えて
 * 繰り返さないよう、後続の項目だけを「続いて」の形で提示する。
 */
function priorityRestatesConcern(priority: ImprovementPriority, concern: PrimaryConcern): boolean {
  switch (concern.kind) {
    case "referenceError":
      return priority.label.includes("保存ビルド参照");
    case "structural":
      return priority.label.includes("選手配置の充足状況");
    case "savedBuildMissing":
      return priority.label === "保存ビルドの設定";
    case "category":
      return priority.label === `${concern.category.label}の底上げ`;
    case "dataInsufficient":
      return priority.label === "先発の配置";
    case "none":
      return false;
  }
}

function normalPrioritySentence(analysis: CommentAnalysis): string | null {
  const { improvementPriorities: p, primaryConcern } = analysis;
  if (p.length === 0) return null;
  const restatesFirst = priorityRestatesConcern(p[0], primaryConcern);
  const rest = restatesFirst ? p.slice(1) : p;
  if (restatesFirst) {
    if (rest.length === 0) return null;
    if (rest.length === 1) return `続いて${rest[0].label}も見直すと、さらに改善が見込めます。`;
    return `続いて${rest[0].label}を、その後${rest[1].label}を見直すと、さらに改善が見込めます。`;
  }
  if (rest.length === 1) return `まずは${rest[0].label}を見直すと効果的です。`;
  return `まずは${rest[0].label}を、次に${rest[1].label}を見直すと効果的です。`;
}

function normalClosingSentence(result: SquadDiagnosisResult, hasBody: boolean): string {
  if (result.overall.score == null) return "";
  if (!hasBody) {
    return "現時点で特筆すべき弱点は見当たらず、バランスの取れた構成です。";
  }
  return "登録データにもとづく評価のため、実際の試合結果を保証するものではありません。";
}

export function buildNormalComment(analysis: CommentAnalysis, result: SquadDiagnosisResult): string {
  if (analysis.primaryConcern.kind === "dataInsufficient") {
    return normalConcernSentence(analysis)!;
  }

  const parts: string[] = [];
  const overview = overallInterpretationSentence(result, analysis);
  const strengthSentence = normalStrengthSentence(analysis);
  const concernSentence = normalConcernSentence(analysis);
  const contradictionSentence = normalContradictionSentence(analysis);
  const prioritySentence = normalPrioritySentence(analysis);

  if (overview) parts.push(overview);
  if (strengthSentence) parts.push(strengthSentence);
  if (concernSentence) parts.push(concernSentence);
  if (contradictionSentence) parts.push(contradictionSentence);
  if (prioritySentence) parts.push(prioritySentence);

  const closing = normalClosingSentence(result, parts.length > 0);
  if (closing) parts.push(closing);

  if (parts.length === 0) {
    return "現在のデータでは、はっきりとした長所・弱点を判定できませんでした。先発の配置や保存ビルドの設定を増やすと、より具体的な診断ができます。";
  }
  return parts.join("");
}

// ---------------------------------------------------------------------------
// 辛口コメント
// ---------------------------------------------------------------------------

function harshOverallVerdict(result: SquadDiagnosisResult, analysis: CommentAnalysis): string | null {
  const tier = result.overall.tier;
  if (tier == null) return null;
  const { gapLevel, profile } = analysis;

  if ((tier === "S" || tier === "A") && (gapLevel === "large" || gapLevel === "extreme")) {
    return "総合評価だけを見て完成していると判断するのは早いです。見た目の総合点ほど均整の取れた構成ではありません。";
  }
  if (tier === "B" && (gapLevel === "large" || gapLevel === "extreme")) {
    return "総合評価は中間的ですが、内訳を見るとカテゴリ間の評価が偏っており、完成度の高い構成とは言えません。";
  }
  if (profile.type === "lackingWeapon") {
    return "特定の強みに乏しく、総合点の高さだけで安心できる段階ではありません。";
  }
  return null;
}

function harshConcernSentence(
  analysis: CommentAnalysis,
  result: SquadDiagnosisResult,
): { issue: string; impact: string } | null {
  const { primaryConcern: concern, confidence } = analysis;
  const confidenceNote = confidence === "low" ? "判定できた項目が少なく評価の幅は狭いですが、" : "";
  switch (concern.kind) {
    case "referenceError":
      return {
        issue: `保存ビルドの参照が壊れている選手が${concern.count}人おり、これは放置できない問題です。`,
        impact: "現在は参照状態に問題があるため、細かな能力評価を続ける段階ではありません。まず保存ビルドの参照を修正してください。",
      };
    case "dataInsufficient":
      return {
        issue: "先発にフィールドプレイヤーが配置されておらず、評価できる材料がありません。",
        impact: "このままでは総合評価も個別カテゴリの評価も成立しません。",
      };
    case "structural":
      return {
        issue: `${confidenceNote}選手配置の充足状況（先発の人数や配置適性）が明確な弱点です。`,
        impact: "見た目の総合評価だけでは、この配置面の問題は分かりません。",
      };
    case "savedBuildMissing": {
      const completeness = completenessOf(result);
      const placementNote =
        completeness && (completeness.tier === "S" || completeness.tier === "A")
          ? "先発の配置は十分に整っています。"
          : "先発の配置に大きな不足は見当たりません。";
      const scoreText = result.overall.score != null ? `${result.overall.score}点` : "算出不可";
      const tierText = result.overall.tier ?? "―";
      return {
        issue: `${placementNote}ただし、保存ビルドが未設定の選手が${concern.count}人います（先発${concern.total}人中）。該当する選手は、育成内容を保存した保存ビルドではなく、現在の設定にもとづいて評価されています。`,
        impact: `総合評価${scoreText}・評価${tierText}は判定可能な項目から算出されたものであり、無効な結果ではありません。ただし、育成後の完成状態を十分に反映した評価ではないため、これを最終評価として受け取るのは早いです。細かな戦術や配置の調整を行う前に、対象選手の保存ビルドを設定し、その後もう一度診断してください。`,
      };
    }
    case "category":
      return {
        issue: `${confidenceNote}${concern.category.label}の評価が低く、見過ごせる水準ではありません。`,
        impact: `${concern.category.label}が低いままでは、他のカテゴリの強みを打ち消しかねません。この問題は放置できません。`,
      };
    case "none":
      return null;
  }
}

function harshSecondarySentence(secondary: PrimaryConcern): string | null {
  switch (secondary.kind) {
    case "structural":
      return "加えて、選手配置の充足状況にも改善余地が残っています。";
    case "category":
      return `加えて、${secondary.category.label}も相対的に低く、二次的な課題として無視できません。`;
    default:
      return null;
  }
}

function harshPrioritySentence(analysis: CommentAnalysis): string | null {
  const { improvementPriorities: p, primaryConcern } = analysis;
  if (p.length === 0) return null;
  const restatesFirst = priorityRestatesConcern(p[0], primaryConcern);
  const rest = restatesFirst ? p.slice(1) : p;
  if (restatesFirst) {
    if (rest.length === 0) return null;
    if (rest.length === 1) return `続いて${rest[0].label}も放置すべきではありません。`;
    return `続いて${rest[0].label}、その後${rest[1].label}の順で見直すべきです。`;
  }
  if (rest.length === 1) return `まずは${rest[0].label}を優先して見直すべきです。`;
  return `まずは${rest[0].label}を、次に${rest[1].label}を優先して見直すべきです。現在の長所をさらに伸ばすより、低評価カテゴリを底上げする方が構成全体の偏りを減らせます。`;
}

function harshStrengthMention(analysis: CommentAnalysis): string | null {
  const { primaryStrength: strength, primaryConcern: concern } = analysis;
  if (strength.kind === "none") return null;
  if (concern.kind !== "none") {
    return `${strength.category.label}は高水準ですが、そこだけに頼れる状態ではありません。`;
  }
  return `${strength.category.label}は高水準です。`;
}

export function buildHarshComment(analysis: CommentAnalysis, result: SquadDiagnosisResult): string {
  if (analysis.primaryConcern.kind === "dataInsufficient") {
    const c = harshConcernSentence(analysis, result)!;
    return `${c.issue}${c.impact}`;
  }

  const paragraphs: string[] = [];

  // 段落1: 遠慮のない総評 + 最も重大な問題
  const opening: string[] = [];
  const verdict = harshOverallVerdict(result, analysis);
  if (verdict) opening.push(verdict);
  const concernInfo = harshConcernSentence(analysis, result);
  if (concernInfo) {
    opening.push(concernInfo.issue);
    opening.push(concernInfo.impact);
  }
  if (opening.length > 0) paragraphs.push(opening.join(""));

  // 段落2: 構成上の矛盾（最重要の懸念と重複しない場合のみ）
  const contradiction = pickNonRedundantContradiction(analysis.contradictions, analysis.primaryConcern);
  if (contradiction) {
    paragraphs.push(contradiction.description);
  }

  // 段落3: 二次的な問題 + 改善優先順位
  const middle: string[] = [];
  const secondary = harshSecondarySentence(analysis.secondaryConcern);
  if (secondary) middle.push(secondary);
  const priority = harshPrioritySentence(analysis);
  if (priority) middle.push(priority);
  if (middle.length > 0) paragraphs.push(middle.join(""));

  // 段落4: 維持すべき長所
  const strengthMention = harshStrengthMention(analysis);
  if (strengthMention) paragraphs.push(strengthMention);

  if (paragraphs.length === 0) {
    return "際立った弱点は見当たりません。無理に欠点を作る必要はなく、登録データの範囲では現状の構成を維持しつつ、育成やビルド設定を継続的に見直す程度で十分です。";
  }
  return paragraphs.join("\n\n");
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

export function generateSquadDiagnosisComments(result: SquadDiagnosisResult): SquadDiagnosisComments {
  const analysis = analyzeSquadDiagnosis(result);
  return {
    normal: buildNormalComment(analysis, result),
    harsh: buildHarshComment(analysis, result),
  };
}
