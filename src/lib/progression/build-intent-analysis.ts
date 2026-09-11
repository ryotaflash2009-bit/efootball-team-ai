import { PROGRESSION_GROUPS, getGroupDef } from "./stat-groups";
import { groupAverage, type GroupImpactEntry } from "./build-ability-impact";
import { WORLD_STAT_DEFS } from "@/lib/world/stats";

/**
 * Build Analysis「分析目的」(狙った用途への適合分析)。
 *
 * - 純関数のみ。生成AI・外部API・HTTP・Math.random・現在日時分岐・
 *   localStorage/SQLite/DOM直接アクセスなし。入力非破壊。同一入力→同一出力。
 * - 自由メモ(userNote)は一切解析しない(表示専用・そのまま返すだけ)。
 * - 既存の能力値インパクト分析(build-ability-impact.ts)の出力をそのまま入力として使い、
 *   能力値計算式自体は一切再計算しない。
 * - 分析結果は言語非依存の構造化データ(コード・groupId・abilityId・数値・buildName)のみを保持する。
 * - テンプレートの安全な置換のため、あるコードが特定のパラメーター(例: abilityId)を伴う場合、
 *   そのコードを生成する分岐では常にそのパラメーターを確定できる場合のみ生成する
 *   (「値がない時だけプレースホルダーが埋まらない」状態を作らない)。
 * - 同一の優先領域について「一致」と「不足」を同時に生成しない: 各優先領域は
 *   PriorityAlignmentState のうちちょうど1つの状態だけを持つ(排他的)。
 */

// ---------------------------------------------------------------------------
// 入力: 能力領域ごとの3段階状態
// ---------------------------------------------------------------------------

/**
 * 能力領域の優先度(4段階)。
 * "priority" = 最優先(Top Priority)。既存の呼び名・値を維持し後方互換性を保つ。
 * "secondary" = 補助的に重視(Secondary Priority)。主目的を支えるが最優先より優先順位が低い領域。
 * "normal" = 通常。"low" = 低優先。
 */
export type GroupPriorityState = "priority" | "secondary" | "normal" | "low";

export type PrimaryGoalId =
  | "scoring"
  | "dribbling"
  | "passing"
  | "speed"
  | "possession"
  | "physical"
  | "aerial"
  | "defense"
  | "press"
  | "counter"
  | "balance"
  | "other"
  | "unspecified";

export const PRIMARY_GOAL_IDS: PrimaryGoalId[] = [
  "unspecified",
  "scoring",
  "dribbling",
  "passing",
  "speed",
  "possession",
  "physical",
  "aerial",
  "defense",
  "press",
  "counter",
  "balance",
  "other",
];

/**
 * 主目的 → 確認済み育成カテゴリ(PROGRESSION_GROUPS の groupId)の固定対応表。
 * press / counter はチーム戦術レベルの概念で、保存ビルド単体の能力値だけでは安全に対応できないため
 * 直接マッピングしない(補助目的としてのみ扱う)。balance / other / unspecified も直接マッピングなし。
 */
export const PRIMARY_GOAL_GROUP_MAP: Record<PrimaryGoalId, string[]> = {
  scoring: ["shooting"],
  dribbling: ["dribbling", "dexterity"],
  passing: ["passing"],
  speed: ["dexterity"],
  possession: ["dribbling", "dexterity", "passing"],
  physical: ["lowerBodyStrength"],
  aerial: ["aerialStrength"],
  defense: ["defending"],
  press: [],
  counter: [],
  balance: [],
  other: [],
  unspecified: [],
};

/** 保存ビルド単体の能力値だけでは安全に評価できず、補助目的としてのみ扱う主目的。 */
export const AUXILIARY_ONLY_GOALS: ReadonlySet<PrimaryGoalId> = new Set(["press", "counter"]);

const VALID_GROUP_IDS = new Set(PROGRESSION_GROUPS.map((g) => g.groupId));
export const MAX_INTENDED_POSITIONS = 3;
/**
 * 自由記述(育成の狙い)の最大文字数。
 * 分析目的のメイン入力として詳しく書けるよう300→1500へ拡張(要件の1,000〜2,000字の範囲内)。
 * JSON POSTボディとして送っても数KB程度で、既存フォームの送信サイズ制約と比べて安全な上限。
 */
export const FREE_TEXT_MAX_LENGTH = 1500;

/** 優先領域が多すぎる場合のソフトな案内のしきい値(ハードエラーではない)。 */
export const MANY_PRIORITY_THRESHOLD = 6;
/** 低優先領域がほぼ全カテゴリに達した場合のソフトな案内のしきい値。 */
export const MOST_LOWER_PRIORITY_THRESHOLD = 8;

export interface BuildIntentInput {
  /** 使用予定ポジション(既存プロジェクトの確認済みポジションから選択・参考情報のみ)。 */
  intendedPositions: string[];
  primaryGoal: PrimaryGoalId;
  /**
   * 能力領域ごとの状態(groupId → "priority" | "low")。未登録のキーは "normal" 扱い。
   * 1領域につき1状態のみを保持できる構造のため、優先と低優先へ同時登録することはできない。
   * 件数の上限はない。
   */
  groupPriorities: Partial<Record<string, GroupPriorityState>>;
  /**
   * 「上げすぎたくない」補助フラグ(優先度とは独立)。groupPriorities とは別軸のため、
   * 優先(priority)指定と併用しても矛盾しない(例: 優先だが上げすぎには注意、は表現できない設計だが、
   * 通常/低優先領域に対して「これ以上は伸ばしすぎないでほしい」という意図だけを表す)。
   */
  avoidOverinvestmentGroups: string[];
  /**
   * 「意図的に捨てる/問題として扱わない」補助フラグ(優先度とは独立)。
   * 既存の groupPriorities="low"(優先度を下げてもよい)と役割は近いが、AI抽出結果や
   * ユーザーの明示的な「この領域は今回捨てる」という意図を、優先度の値を変えずに表現するための別軸。
   * 分析では既存の低優先扱いと合流し(重複計上はしない)、主要な問題から除外する。
   */
  intentionallyIgnoredGroups: string[];
  /** ユーザーが比較したいと指定した同一カードの別ビルド(実在確認は analyzeBuildIntent 側で行う)。 */
  comparisonTargetBuildId: string | null;
  /** 比較時に重視したい能力領域(comparisonTargetBuildId が有効な場合のみ使用)。 */
  comparisonFocusGroups: string[];
  /** ユーザーが維持したいと明示した長所領域(優先領域一致の中から選ぶ際の優先候補として使う)。 */
  strengthsToPreserve: string[];
  /** 育成の狙い(自由記述・メイン入力)。分析エンジンでは直接解析しない(表示専用・AI抽出の入力としてのみ使用)。 */
  freeText: string;
}

export function emptyBuildIntent(): BuildIntentInput {
  return {
    intendedPositions: [],
    primaryGoal: "unspecified",
    groupPriorities: {},
    avoidOverinvestmentGroups: [],
    intentionallyIgnoredGroups: [],
    comparisonTargetBuildId: null,
    comparisonFocusGroups: [],
    strengthsToPreserve: [],
    freeText: "",
  };
}

export function priorityGroupIds(intent: BuildIntentInput): string[] {
  return PROGRESSION_GROUPS.filter((g) => intent.groupPriorities[g.groupId] === "priority").map((g) => g.groupId);
}

/** 補助的に重視(Secondary Priority)の能力領域。 */
export function secondaryPriorityGroupIds(intent: BuildIntentInput): string[] {
  return PROGRESSION_GROUPS.filter((g) => intent.groupPriorities[g.groupId] === "secondary").map((g) => g.groupId);
}

export function lowerPriorityGroupIds(intent: BuildIntentInput): string[] {
  return PROGRESSION_GROUPS.filter((g) => intent.groupPriorities[g.groupId] === "low").map((g) => g.groupId);
}

export function groupPriorityState(intent: BuildIntentInput, groupId: string): GroupPriorityState {
  return intent.groupPriorities[groupId] ?? "normal";
}

export interface NormalizeIntentResult {
  intent: BuildIntentInput;
  rejected: string[];
}

/** 入力値の構造的な検証・正規化(純関数・非破壊)。UI 側の誤操作・不正値を安全に丸める。 */
export function normalizeBuildIntent(raw: Partial<BuildIntentInput> | null | undefined): NormalizeIntentResult {
  const rejected: string[] = [];
  const positions = Array.isArray(raw?.intendedPositions)
    ? [...new Set(raw!.intendedPositions.filter((p): p is string => typeof p === "string" && p.length > 0 && p.length <= 16))].slice(
        0,
        MAX_INTENDED_POSITIONS,
      )
    : [];
  const primaryGoal: PrimaryGoalId = PRIMARY_GOAL_IDS.includes(raw?.primaryGoal as PrimaryGoalId) ? (raw!.primaryGoal as PrimaryGoalId) : "unspecified";

  const rawPriorities = raw?.groupPriorities;
  const groupPriorities: Partial<Record<string, GroupPriorityState>> = {};
  if (rawPriorities && typeof rawPriorities === "object") {
    for (const g of PROGRESSION_GROUPS) {
      const v = (rawPriorities as Record<string, unknown>)[g.groupId];
      if (v === "priority" || v === "secondary" || v === "low") {
        groupPriorities[g.groupId] = v;
      } else if (v !== undefined && v !== "normal") {
        rejected.push(`${g.groupId}: 不正な状態のため既定(通常)へ戻す`);
      }
    }
    for (const key of Object.keys(rawPriorities as Record<string, unknown>)) {
      if (!VALID_GROUP_IDS.has(key)) rejected.push(`${key}: 未知の能力領域IDのため無視`);
    }
  }

  const avoidOverinvestmentGroups = Array.isArray(raw?.avoidOverinvestmentGroups)
    ? [...new Set(raw!.avoidOverinvestmentGroups.filter((g): g is string => typeof g === "string" && VALID_GROUP_IDS.has(g)))]
    : [];
  const intentionallyIgnoredGroups = Array.isArray(raw?.intentionallyIgnoredGroups)
    ? [...new Set(raw!.intentionallyIgnoredGroups.filter((g): g is string => typeof g === "string" && VALID_GROUP_IDS.has(g)))]
    : [];
  const strengthsToPreserve = Array.isArray(raw?.strengthsToPreserve)
    ? [...new Set(raw!.strengthsToPreserve.filter((g): g is string => typeof g === "string" && VALID_GROUP_IDS.has(g)))]
    : [];
  const comparisonFocusGroups = Array.isArray(raw?.comparisonFocusGroups)
    ? [...new Set(raw!.comparisonFocusGroups.filter((g): g is string => typeof g === "string" && VALID_GROUP_IDS.has(g)))]
    : [];
  const rawComparisonTarget = raw?.comparisonTargetBuildId;
  const comparisonTargetBuildId = typeof rawComparisonTarget === "string" && rawComparisonTarget.length > 0 && rawComparisonTarget.length <= 64 ? rawComparisonTarget : null;

  const rawNote = typeof raw?.freeText === "string" ? raw!.freeText : "";
  const freeText = stripControlChars(rawNote).slice(0, FREE_TEXT_MAX_LENGTH);
  if (rawNote.length > FREE_TEXT_MAX_LENGTH) rejected.push(`freeText: ${FREE_TEXT_MAX_LENGTH}文字を超えたため切り詰め`);

  return {
    intent: {
      intendedPositions: positions,
      primaryGoal,
      groupPriorities,
      avoidOverinvestmentGroups,
      intentionallyIgnoredGroups,
      comparisonTargetBuildId,
      comparisonFocusGroups,
      strengthsToPreserve,
      freeText,
    },
    rejected,
  };
}

/** 制御文字を除去する(改行 \n だけは自由メモの折り返し表示のため保持する)。 */
function stripControlChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const isControl = (c <= 0x1f && c !== 0x0a) || c === 0x7f || (c >= 0x80 && c <= 0x9f);
    if (!isControl) out += ch;
  }
  return out;
}

export function hasMeaningfulIntent(intent: BuildIntentInput): boolean {
  return (
    intent.primaryGoal !== "unspecified" ||
    priorityGroupIds(intent).length > 0 ||
    secondaryPriorityGroupIds(intent).length > 0 ||
    lowerPriorityGroupIds(intent).length > 0 ||
    intent.intendedPositions.length > 0 ||
    intent.avoidOverinvestmentGroups.length > 0 ||
    intent.intentionallyIgnoredGroups.length > 0 ||
    intent.strengthsToPreserve.length > 0 ||
    intent.comparisonTargetBuildId != null
  );
}

// ---------------------------------------------------------------------------
// 入力内容の反映状況(実際の分析ロジックと必ず一致させる)
// ---------------------------------------------------------------------------

export type IntentFieldKey =
  | "primaryGoal"
  | "position"
  | "priorityGroups"
  | "secondaryPriorityGroups"
  | "lowerPriorityGroups"
  | "freeText"
  | "avoidOverinvestmentGroups"
  | "intentionallyIgnoredGroups"
  | "comparisonTarget"
  | "strengthsToPreserve";
export type IntentFieldStatus = "used" | "reference-only" | "display-only" | "not-specified" | "limited-by-data";

export interface IntentReflectionEntry {
  field: IntentFieldKey;
  status: IntentFieldStatus;
  count: number;
}

/** freeText(育成の狙い)の解析・確定状況。UI側の状態機械(BuildIntentExtractionStatus)から渡す。 */
export interface IntentReflectionContext {
  /** 自由記述の内容がAI抽出により確定済み構造化意図へ反映されているか。 */
  freeTextApplied?: boolean;
  /** comparisonTargetBuildId が実在する同一カードの別ビルドとして解決できたか。 */
  comparisonTargetResolved?: boolean;
  /** strengthsToPreserve のうち、少なくとも1件が実データで長所として確認できたか。 */
  preserveConfirmed?: boolean;
}

/**
 * 各入力項目が実際の分析ロジックでどう扱われるかを、そのまま反映する(見た目だけの説明にしない)。
 * - primaryGoal: 未指定なら not-specified。固定マッピングを持つ目的は used。
 *   press/counter は保存ビルド単体では判定範囲が限定されるため limited-by-data。
 *   other は固定マッピングも専用ロジックも持たないため display-only。
 * - position: 常に reference-only(配分の良し悪し判定には使わない)。
 * - priorityGroups / lowerPriorityGroups / avoidOverinvestmentGroups: 1件以上あれば used、なければ not-specified。
 * - freeText: AI抽出が確定済み構造化意図へ反映されていれば used、入力はあるが未反映なら display-only、
 *   入力がなければ not-specified(自由文そのものを分析エンジンが解析することは一切ない)。
 * - comparisonTarget: 実在する別ビルドとして解決できた場合のみ used(架空の比較を「使用」と表示しない)。
 */
export function computeIntentReflectionStatus(intent: BuildIntentInput, context: IntentReflectionContext = {}): IntentReflectionEntry[] {
  const priorityCount = priorityGroupIds(intent).length;
  const secondaryCount = secondaryPriorityGroupIds(intent).length;
  const lowerCount = lowerPriorityGroupIds(intent).length;
  const avoidCount = intent.avoidOverinvestmentGroups.length;
  const ignoredCount = intent.intentionallyIgnoredGroups.length;
  const hasFreeText = intent.freeText.trim().length > 0;

  const goalStatus: IntentFieldStatus =
    intent.primaryGoal === "unspecified"
      ? "not-specified"
      : intent.primaryGoal === "other"
        ? "display-only"
        : AUXILIARY_ONLY_GOALS.has(intent.primaryGoal)
          ? "limited-by-data"
          : "used";

  const freeTextStatus: IntentFieldStatus = context.freeTextApplied ? "used" : hasFreeText ? "display-only" : "not-specified";
  const comparisonStatus: IntentFieldStatus = intent.comparisonTargetBuildId == null ? "not-specified" : context.comparisonTargetResolved ? "used" : "display-only";
  const preserveCount = intent.strengthsToPreserve.length;
  const preserveStatus: IntentFieldStatus = preserveCount === 0 ? "not-specified" : context.preserveConfirmed ? "used" : "display-only";

  return [
    { field: "primaryGoal", status: goalStatus, count: intent.primaryGoal === "unspecified" ? 0 : 1 },
    { field: "position", status: intent.intendedPositions.length > 0 ? "reference-only" : "not-specified", count: intent.intendedPositions.length },
    { field: "priorityGroups", status: priorityCount > 0 ? "used" : "not-specified", count: priorityCount },
    { field: "secondaryPriorityGroups", status: secondaryCount > 0 ? "used" : "not-specified", count: secondaryCount },
    { field: "lowerPriorityGroups", status: lowerCount > 0 ? "used" : "not-specified", count: lowerCount },
    { field: "avoidOverinvestmentGroups", status: avoidCount > 0 ? "used" : "not-specified", count: avoidCount },
    { field: "intentionallyIgnoredGroups", status: ignoredCount > 0 ? "used" : "not-specified", count: ignoredCount },
    { field: "strengthsToPreserve", status: preserveStatus, count: preserveCount },
    { field: "comparisonTarget", status: comparisonStatus, count: intent.comparisonTargetBuildId == null ? 0 : 1 },
    { field: "freeText", status: freeTextStatus, count: hasFreeText ? 1 : 0 },
  ];
}

// ---------------------------------------------------------------------------
// 能力値の決定的な選定(同点は WORLD_STAT_DEFS の固定順)
// ---------------------------------------------------------------------------

const STAT_ORDER = new Map(WORLD_STAT_DEFS.map((d) => [d.key, d.order]));

function statsOfGroup(groupId: string): string[] {
  return getGroupDef(groupId)?.affectedStats ?? [];
}

/** グループ内で values が最大の能力を1件選ぶ(同点は WORLD_STAT_DEFS 固定順)。 */
function pickExtremeInGroup(groupId: string, values: Record<string, number> | null, mode: "max" | "min"): { abilityId: string; value: number } | null {
  if (!values) return null;
  let best: { abilityId: string; value: number } | null = null;
  for (const id of statsOfGroup(groupId)) {
    const v = values[id];
    if (typeof v !== "number") continue;
    const better = !best || (mode === "max" ? v > best.value : v < best.value) || (v === best.value && (STAT_ORDER.get(id) ?? 999) < (STAT_ORDER.get(best.abilityId) ?? 999));
    if (better) best = { abilityId: id, value: v };
  }
  return best;
}

/**
 * グループ内で values が大きい順に最大 max 件選ぶ(同点は WORLD_STAT_DEFS 固定順)。
 * minValue を超える値のみを対象にする(既定 0: 上昇量が0の能力は代表例として掲載しない)。
 */
function topAbilitiesInGroup(groupId: string, values: Record<string, number> | null, max: number, minValue = 0): { abilityId: string; value: number }[] {
  if (!values) return [];
  return statsOfGroup(groupId)
    .map((id) => ({ abilityId: id, value: values[id] }))
    .filter((e): e is { abilityId: string; value: number } => typeof e.value === "number" && e.value > minValue)
    .sort((a, b) => (b.value !== a.value ? b.value - a.value : (STAT_ORDER.get(a.abilityId) ?? 999) - (STAT_ORDER.get(b.abilityId) ?? 999)))
    .slice(0, max);
}

const MAX_REPRESENTATIVE_ABILITIES = 3;

// ---------------------------------------------------------------------------
// 別ビルド比較の入力
// ---------------------------------------------------------------------------

export interface IntentSiblingInput {
  buildId: string;
  buildName: string;
  /** 保存時点の最終能力値(空オブジェクトはデータなし扱い)。 */
  calculatedStats: Record<string, number>;
  /** 既存の同一カード比較(build-ability-impact.ts)から引き継ぐ条件差。 */
  conditionDifference: "legacy-vs-current" | "one-unallocated" | null;
  /** 既存の一般比較(build-analysis.ts の comparisonSummary)から引き継ぐ具体的な差。 */
  usedPointsDiff: number | null;
  calculatedOvrDiff: number | null;
  /** 既存の能力値比較(build-ability-impact.ts)から引き継ぐ、差が大きい能力(現在-比較先・降順)。 */
  topAbilityDifferences: { abilityId: string; diff: number }[];
}

export interface BuildIntentAnalysisInput {
  intent: BuildIntentInput;
  allocation: Record<string, number>;
  groupImpact: GroupImpactEntry[];
  abilityAvailable: boolean;
  baseAbilities: Record<string, number> | null;
  finalAbilities: Record<string, number> | null;
  abilityDeltas: Record<string, number> | null;
  remainingPoints: number | null;
  totalPoints: number | null;
  siblings: IntentSiblingInput[];
}

// ---------------------------------------------------------------------------
// 出力(言語非依存)
// ---------------------------------------------------------------------------

export type IntentAlignment = "high" | "mostly-aligned" | "partially-aligned" | "poorly-aligned" | "insufficient-information";

/** 優先領域ごとの一致状態(排他的・1領域につき常にちょうど1つ)。 */
export type PriorityAlignmentState = "strongly-aligned" | "mostly-aligned" | "present-but-underprioritized" | "not-reflected" | "insufficient-data";

/**
 * 補助的優先領域の配分が最優先領域を上回る場合の重大度。
 * - "none": 逆転なし。
 * - "review-recommended": 逆転はあるが差が小さく、かつ最優先領域自体には問題がない(反映済み・能力上昇あり)。
 *   断定的な「明確な不一致」ではなく、「配分が意図どおりか確認してほしい」という軽い確認事項として扱う。
 * - "clear-inversion": 差が大きい、または最優先領域自体にも問題がある。改善候補・目的との明確な不一致として扱う。
 * 差の大小は SMALL_ABILITY_DIFF_THRESHOLD(既存: 比較機能で「僅差」とみなす閾値=3)を再利用して判定する
 * (新しい数値をここだけのために追加しない)。
 */
export type PriorityInversionSeverity = "none" | "review-recommended" | "clear-inversion";

export interface PriorityAlignmentEntry {
  groupId: string;
  state: PriorityAlignmentState;
  level: number;
  /** このグループの育成による上昇量合計(能力データ不足時は null)。 */
  delta: number | null;
  /** 上昇量が大きい代表能力(最大3件・上昇量0は含めない)。 */
  representativeAbilities: { abilityId: string; delta: number }[];
  /** "top"=最優先 / "secondary"=補助的に重視。判定基準が異なるため区別する。 */
  priorityLevel: "top" | "secondary";
  /** 補助的優先領域の配分が、最優先領域の最大配分を上回っている(目的との優先順位を再確認する候補)。topでは常にfalse。
   *  後方互換のため残す(= priorityInversionSeverity !== "none")。重大度の判定には priorityInversionSeverity を使う。 */
  priorityInversion: boolean;
  /** 優先順位逆転の重大度("none"=逆転なし)。topでは常に"none"。 */
  priorityInversionSeverity: PriorityInversionSeverity;
}

export type IntentFindingCode =
  | "intent-priority-not-reflected"
  | "intent-priority-underprioritized"
  | "intent-priority-insufficient-data"
  | "intent-primary-goal-reflected"
  | "intent-primary-goal-mismatch"
  | "intent-lower-priority-low-allocation-good"
  | "intent-near-complete"
  | "intent-spread-not-a-problem"
  | "intent-overinvestment-outside-priority"
  | "intent-avoid-overinvestment-triggered"
  | "intent-goal-auxiliary-only"
  | "intent-insufficient-ability-data"
  | "intent-priority-count-many"
  | "intent-priority-count-all"
  | "intent-lower-priority-count-most"
  | "intent-comparison-target-not-found"
  | "intent-secondary-not-reflected"
  | "intent-secondary-priority-inversion"
  | "intent-secondary-priority-inversion-review";

export interface IntentFinding {
  code: IntentFindingCode;
  groupId: string | null;
  params: Record<string, string | number>;
}

/** 優先領域が「十分に一致」「おおむね一致」した場合の、統合表示用グループ(同じ状態は1文へまとめる)。 */
export interface AlignedGroupSummary {
  state: "strongly-aligned" | "mostly-aligned";
  groupIds: string[];
  representativeAbilities: { abilityId: string; delta: number }[];
}

/** 改善優先順位・辛口レビューの結論が参照する「最も重要な1件」の種別。 */
export type IntentTopIssueKind = "not-reflected" | "underprioritized" | "priority-inversion" | "secondary-not-reflected" | "avoid-overinvestment" | "overinvestment";
export interface IntentTopIssue {
  kind: IntentTopIssueKind;
  groupId: string;
}

export type IntentComparisonRecommendation = "current-closer" | "other-closer" | "similar" | "condition-differs" | "insufficient-data";

export interface IntentComparisonDetail {
  abilityId: string;
  /** 現在ビルド - 比較先ビルド。 */
  diff: number;
}

export interface BuildIntentComparisonResult {
  otherBuildId: string;
  otherBuildName: string;
  recommendation: IntentComparisonRecommendation;
  /** 優先領域(comparisonFocusGroups指定時はそれも含む)に属する能力の中で差が大きいもの(最大3件・現在-比較先の降順)。 */
  keyDifferences: IntentComparisonDetail[];
  /** 優先領域のうち、最終能力平均の差がほぼない(僅差)グループ。 */
  closeGroups: string[];
  usedPointsDiff: number | null;
  calculatedOvrDiff: number | null;
  /** ユーザーが comparisonTargetBuildId で明示的に比較対象として指定したビルドか。 */
  isUserComparisonTarget: boolean;
}

export interface BuildIntentAnalysis {
  hasIntent: boolean;
  alignment: IntentAlignment;
  effectivePriorityGroups: string[];
  /** 最優先領域ごとの一致状態(排他的)。 */
  priorityAlignments: PriorityAlignmentEntry[];
  /**
   * 補助的に重視(Secondary Priority)領域ごとの状態。最優先とは異なる判定基準(配分ゼロは軽度の注意・
   * 配分が最優先より少なくても不足と断定しない・最優先を上回る場合のみ優先順位逆転候補)を用いる。
   * 最優先(effectivePriorityGroups)と重複する領域はここに含めない。
   */
  secondaryAlignments: PriorityAlignmentEntry[];
  /** 「十分に一致」「おおむね一致」の統合表示用(同じ状態のグループを1件へまとめる)。 */
  alignedGroups: AlignedGroupSummary[];
  /** balance目的専用の所見(該当時のみ)。 */
  balanceGoalFinding: IntentFinding | null;
  possibleOverinvestmentForIntent: IntentFinding[];
  /** ユーザーが明示的に「上げすぎたくない」と指定した領域のうち、実際に大きく配分されている候補。 */
  avoidOverinvestmentFindings: IntentFinding[];
  acceptableLowInvestment: IntentFinding[];
  /** 低優先指定領域のうち配分ゼロのものを1つの文章へ統合した表示用データ。 */
  /** 低優先(lowPriorityGroupIds)と今回は評価対象外(excludedGroupIds)を分けて保持する(表示上は区別する)。 */
  acceptableLowSummary: { lowPriorityGroupIds: string[]; excludedGroupIds: string[] } | null;
  spreadNotAProblem: IntentFinding | null;
  nearComplete: IntentFinding | null;
  /** 改善候補(最大3件・辛口レビューの結論と共有する種別順で並ぶ)。低優先/評価対象外領域はここに出さない。 */
  improvementPriorities: IntentFinding[];
  /** 目的とのズレのうち、辛口レビュー本文へ載せる最重要1〜2件(improvementPrioritiesの先頭2件と同一根拠)。 */
  misalignmentHighlights: IntentFinding[];
  /**
   * 「明確な不一致」ではないが確認を促したい事項(現時点では補助的優先の軽度な配分逆転のみ)。
   * improvementPriorities/topIssue には含めない(改善候補1位や辛口の最終判断を乗っ取らない)。
   */
  priorityConfirmationItems: IntentFinding[];
  /** 改善候補1位・辛口の結論が指す「最も重要な問題」(存在しなければ null = 大きな問題なし)。 */
  topIssue: IntentTopIssue | null;
  /** 維持すべき長所として案内する優先領域(topIssueとは異なる領域から選ぶ)。 */
  preserveHighlight: PriorityAlignmentEntry | null;
  /** ユーザーが明示した「維持したい長所」のうち、実データでは長所として確認できなかった領域(架空の長所にしない)。 */
  unconfirmedPreserveGroupIds: string[];
  comparisonRecommendations: BuildIntentComparisonResult[];
  priorityCountGuidance: IntentFinding | null;
  lowerPriorityCountGuidance: IntentFinding | null;
  reflectionStatus: IntentReflectionEntry[];
  confidenceReasons: string[];
  limitations: IntentFindingCode[];
}

// ---------------------------------------------------------------------------
// しきい値(このアプリ独自の表示用ヒューリスティック)
// ---------------------------------------------------------------------------

const MAX_OVERINVESTMENT = 3;
const MAX_ACCEPTABLE_LOW = 4;
const MAX_IMPROVEMENT = 3;
const MAX_MISALIGNMENT_HIGHLIGHTS = 2;
const MAX_COMPARISON_DIFFERENCES = 3;
const HIGH_BASE_THRESHOLD_FOR_INTENT = 70;
const SMALL_ABILITY_DIFF_THRESHOLD = 3;
const DOMINANT_SHARE_FOR_BALANCE_MISMATCH = 0.6;
const WIDE_SPREAD_ACTIVE_GROUP_COUNT = 5;
/** 優先領域内での配分順位比率がこれ未満なら「配分はあるが優先度不足」。 */
const UNDERPRIORITIZED_RATIO = 0.5;
/** 優先領域内での配分順位比率がこれ以上、かつ能力上昇が確認できれば「十分に一致」。 */
const STRONG_ALIGNMENT_RATIO = 0.8;

function emptyAnalysis(): BuildIntentAnalysis {
  return {
    hasIntent: false,
    alignment: "insufficient-information",
    effectivePriorityGroups: [],
    priorityAlignments: [],
    secondaryAlignments: [],
    alignedGroups: [],
    balanceGoalFinding: null,
    possibleOverinvestmentForIntent: [],
    avoidOverinvestmentFindings: [],
    acceptableLowInvestment: [],
    acceptableLowSummary: null,
    spreadNotAProblem: null,
    nearComplete: null,
    improvementPriorities: [],
    misalignmentHighlights: [],
    priorityConfirmationItems: [],
    topIssue: null,
    preserveHighlight: null,
    unconfirmedPreserveGroupIds: [],
    comparisonRecommendations: [],
    priorityCountGuidance: null,
    lowerPriorityCountGuidance: null,
    reflectionStatus: computeIntentReflectionStatus(emptyBuildIntent()),
    confidenceReasons: [],
    limitations: [],
  };
}

function classifyPriorityAlignment(level: number, maxPriorityLevel: number, abilityAvailable: boolean, hasGain: boolean): PriorityAlignmentState {
  if (level <= 0) return "not-reflected";
  if (!abilityAvailable) return "insufficient-data";
  const ratio = maxPriorityLevel > 0 ? level / maxPriorityLevel : 1;
  if (ratio < UNDERPRIORITIZED_RATIO) return "present-but-underprioritized";
  if (ratio >= STRONG_ALIGNMENT_RATIO && hasGain) return "strongly-aligned";
  return "mostly-aligned";
}

/**
 * 補助的に重視(Secondary Priority)領域の判定基準は最優先とは異なる:
 * 最優先領域との配分比率では判定しない(最優先より配分が少なくても正常な扱いのため)。
 * 配分ゼロは「軽度の注意」(not-reflected を流用しつつ、UI側の文面で厳しさを変える)、
 * 配分があり能力上昇が確認できれば「十分に一致」、配分はあるが上昇未確認/データ不足なら
 * 「おおむね一致」または「データ不足」とする(優先度不足=present-but-underprioritizedは使わない)。
 */
function classifySecondaryAlignment(level: number, abilityAvailable: boolean, hasGain: boolean): PriorityAlignmentState {
  if (level <= 0) return "not-reflected";
  if (!abilityAvailable) return "insufficient-data";
  return hasGain ? "strongly-aligned" : "mostly-aligned";
}

function dedupAbilities(lists: { abilityId: string; delta: number }[][], max: number): { abilityId: string; delta: number }[] {
  const seen = new Map<string, number>();
  for (const list of lists) for (const a of list) if (!seen.has(a.abilityId)) seen.set(a.abilityId, a.delta);
  return [...seen.entries()]
    .map(([abilityId, delta]) => ({ abilityId, delta }))
    .sort((a, b) => (b.delta !== a.delta ? b.delta - a.delta : (STAT_ORDER.get(a.abilityId) ?? 999) - (STAT_ORDER.get(b.abilityId) ?? 999)))
    .slice(0, max);
}

export function analyzeBuildIntent(input: BuildIntentAnalysisInput): BuildIntentAnalysis {
  const { intent, allocation, groupImpact, abilityAvailable, baseAbilities, finalAbilities, abilityDeltas, remainingPoints, totalPoints, siblings } = input;

  if (!hasMeaningfulIntent(intent)) return emptyAnalysis();

  const confidenceReasons: string[] = [];
  const limitations: IntentFindingCode[] = [];
  const goalGroups = PRIMARY_GOAL_GROUP_MAP[intent.primaryGoal] ?? [];
  const isAuxiliaryGoal = AUXILIARY_ONLY_GOALS.has(intent.primaryGoal);
  if (isAuxiliaryGoal) {
    confidenceReasons.push("intent-goal-auxiliary-only");
    limitations.push("intent-goal-auxiliary-only");
  }
  if (!abilityAvailable) {
    confidenceReasons.push("intent-insufficient-ability-data");
    limitations.push("intent-insufficient-ability-data");
  }

  const userPriorityGroups = priorityGroupIds(intent);
  const userSecondaryGroups = secondaryPriorityGroupIds(intent);
  const userLowerPriorityGroups = lowerPriorityGroupIds(intent);
  const effectivePriorityGroups = [...new Set([...userPriorityGroups, ...goalGroups])];
  // 補助的に重視(Secondary Priority): 最優先(effectivePriorityGroups)と重複する領域は最優先を優先し、ここには含めない。
  const effectiveSecondaryGroups = userSecondaryGroups.filter((g) => !effectivePriorityGroups.includes(g));
  const groupLevel = (groupId: string) => allocation[groupId] ?? 0;
  const impactByGroup = new Map(groupImpact.map((g) => [g.groupId, g]));

  // --- 選択数に関するソフトな案内(ハードエラーにしない) ---
  let priorityCountGuidance: IntentFinding | null = null;
  if (userPriorityGroups.length === PROGRESSION_GROUPS.length) {
    priorityCountGuidance = { code: "intent-priority-count-all", groupId: null, params: {} };
    limitations.push("intent-priority-count-all");
  } else if (userPriorityGroups.length >= MANY_PRIORITY_THRESHOLD) {
    priorityCountGuidance = { code: "intent-priority-count-many", groupId: null, params: { count: userPriorityGroups.length } };
    limitations.push("intent-priority-count-many");
  }
  let lowerPriorityCountGuidance: IntentFinding | null = null;
  if (userLowerPriorityGroups.length >= MOST_LOWER_PRIORITY_THRESHOLD) {
    lowerPriorityCountGuidance = { code: "intent-lower-priority-count-most", groupId: null, params: { count: userLowerPriorityGroups.length } };
    limitations.push("intent-lower-priority-count-most");
  }

  const maxPriorityLevel = effectivePriorityGroups.reduce((m, g) => Math.max(m, groupLevel(g)), 0);
  const maxAnyLevel = PROGRESSION_GROUPS.reduce((m, g) => Math.max(m, groupLevel(g.groupId)), 0);

  // --- 最優先領域ごとの一致状態(排他的・1領域につき1状態) ---
  const priorityAlignments: PriorityAlignmentEntry[] = effectivePriorityGroups.map((groupId) => {
    const level = groupLevel(groupId);
    const impact = impactByGroup.get(groupId);
    const hasGain = abilityAvailable && !!impact && impact.totalTrainedDelta > 0;
    const state = classifyPriorityAlignment(level, maxPriorityLevel, abilityAvailable, hasGain);
    const representativeAbilities =
      abilityAvailable && level > 0 ? topAbilitiesInGroup(groupId, abilityDeltas, MAX_REPRESENTATIVE_ABILITIES, 0).map((a) => ({ abilityId: a.abilityId, delta: a.value })) : [];
    return {
      groupId,
      state,
      level,
      delta: abilityAvailable && impact ? impact.totalTrainedDelta : null,
      representativeAbilities,
      priorityLevel: "top",
      priorityInversion: false,
      priorityInversionSeverity: "none",
    };
  });

  // 最優先領域自体に問題がない(すべて反映済み・十分な配分)かどうか。補助的優先の軽微な逆転を
  // 「明確な不一致」へ格上げしてよいかの判定に使う(最優先に問題がある場合はそちらを優先して扱う)。
  const priorityGroupsHealthy = priorityAlignments.every((a) => a.state === "strongly-aligned" || a.state === "mostly-aligned");

  // --- 補助的に重視(Secondary Priority)領域ごとの状態(最優先とは異なる判定基準) ---
  const secondaryAlignments: PriorityAlignmentEntry[] = effectiveSecondaryGroups.map((groupId) => {
    const level = groupLevel(groupId);
    const impact = impactByGroup.get(groupId);
    const hasGain = abilityAvailable && !!impact && impact.totalTrainedDelta > 0;
    const state = classifySecondaryAlignment(level, abilityAvailable, hasGain);
    const representativeAbilities =
      abilityAvailable && level > 0 ? topAbilitiesInGroup(groupId, abilityDeltas, MAX_REPRESENTATIVE_ABILITIES, 0).map((a) => ({ abilityId: a.abilityId, delta: a.value })) : [];
    // 補助的優先の配分が、最優先領域の最大配分を上回る場合のみ「優先順位を再確認する候補」とする。
    const isInverted = maxPriorityLevel > 0 && level > maxPriorityLevel;
    // 差が小さく(既存の「僅差」閾値を再利用)、かつ最優先領域自体に問題がなければ、
    // 断定的な「明確な不一致」ではなく軽い確認事項として扱う。
    const priorityInversionSeverity: PriorityInversionSeverity = !isInverted
      ? "none"
      : priorityGroupsHealthy && level - maxPriorityLevel <= SMALL_ABILITY_DIFF_THRESHOLD
        ? "review-recommended"
        : "clear-inversion";
    return {
      groupId,
      state,
      level,
      delta: abilityAvailable && impact ? impact.totalTrainedDelta : null,
      representativeAbilities,
      priorityLevel: "secondary",
      priorityInversion: isInverted,
      priorityInversionSeverity,
    };
  });

  // 主目的が balance の場合は、配分が特定領域へ偏っていないかを確認する(専用の1所見・balance以外とは独立)。
  let balanceGoalFinding: IntentFinding | null = null;
  const balanceGoalHandled = intent.primaryGoal === "balance" && maxAnyLevel > 0;
  if (balanceGoalHandled) {
    const totalLevel = PROGRESSION_GROUPS.reduce((s, g) => s + groupLevel(g.groupId), 0);
    const topShare = totalLevel > 0 ? maxAnyLevel / totalLevel : 0;
    if (topShare >= DOMINANT_SHARE_FOR_BALANCE_MISMATCH) {
      const topGroup = PROGRESSION_GROUPS.find((g) => groupLevel(g.groupId) === maxAnyLevel)?.groupId ?? null;
      balanceGoalFinding = { code: "intent-primary-goal-mismatch", groupId: topGroup, params: {} };
    } else {
      balanceGoalFinding = { code: "intent-primary-goal-reflected", groupId: null, params: {} };
    }
  }

  // --- ユーザーが明示的に「上げすぎたくない」と指定した領域(優先度の閾値に関わらず、配分実績+育成前の高さだけで判定) ---
  const avoidOverinvestmentFindings: IntentFinding[] = [];
  for (const groupId of intent.avoidOverinvestmentGroups) {
    if (effectivePriorityGroups.includes(groupId)) continue; // 優先領域として明示されている場合は対象外(配分自体が目的に沿うため)
    const level = groupLevel(groupId);
    if (level <= 0) continue;
    const baseAvg = baseAbilities ? groupAverage(baseAbilities, groupId) : null;
    if (baseAvg == null || baseAvg < HIGH_BASE_THRESHOLD_FOR_INTENT || !baseAbilities) continue;
    const topAbility = pickExtremeInGroup(groupId, baseAbilities, "max");
    if (!topAbility) continue;
    avoidOverinvestmentFindings.push({
      code: "intent-avoid-overinvestment-triggered",
      groupId,
      params: { level, baseAverage: Math.round(baseAvg), abilityId: topAbility.abilityId },
    });
  }
  const avoidOverinvestmentGroupIdSet = new Set(avoidOverinvestmentFindings.map((f) => f.groupId));

  // --- 目的に対する過剰配分(複数条件・上のavoidOverinvestmentで既に指摘した領域は重複させない) ---
  const possibleOverinvestmentForIntent: IntentFinding[] = [];
  for (const g of groupImpact) {
    if (effectivePriorityGroups.includes(g.groupId)) continue; // 最優先領域は対象外
    if (effectiveSecondaryGroups.includes(g.groupId)) continue; // 補助的に重視する領域も対象外(高めの配分自体は目的に沿う。逆転は別途判定)
    if (avoidOverinvestmentGroupIdSet.has(g.groupId)) continue; // 既に専用の所見で指摘済み
    if (intent.intentionallyIgnoredGroups.includes(g.groupId)) continue; // 意図的に捨てる領域は対象外
    if (g.allocatedLevel <= 0) continue;
    const exceedsThreshold = maxPriorityLevel > 0 ? g.allocatedLevel >= maxPriorityLevel : g.allocatedLevel >= 5;
    if (!exceedsThreshold) continue;
    const baseAvg = baseAbilities ? groupAverage(baseAbilities, g.groupId) : null;
    const highBase = baseAvg != null && baseAvg >= HIGH_BASE_THRESHOLD_FOR_INTENT;
    if (highBase && baseAbilities) {
      const topAbility = pickExtremeInGroup(g.groupId, baseAbilities, "max");
      if (topAbility) {
        possibleOverinvestmentForIntent.push({
          code: "intent-overinvestment-outside-priority",
          groupId: g.groupId,
          params: { level: g.allocatedLevel, baseAverage: Math.round(baseAvg as number), abilityId: topAbility.abilityId, abilityBaseValue: topAbility.value },
        });
      }
    }
  }

  // --- 低優先領域の扱い(個別リスト+統合表示用サマリー)。
  //     既存の groupPriorities="low" と、AI抽出等による intentionallyIgnoredGroups(今回は評価対象外)は
  //     どちらも「今回の用途では問題として扱わない」という結論は共有するが、ユーザー向け主要表示では
  //     意味が異なるため区別する(同一領域を両方へ重複計上しない: 評価対象外を優先する)。 ---
  const ignoredSet = new Set(intent.intentionallyIgnoredGroups);
  const lowOnlyGroupIds = PROGRESSION_GROUPS.map((g) => g.groupId).filter((g) => userLowerPriorityGroups.includes(g) && !ignoredSet.has(g) && groupLevel(g) === 0);
  const excludedGroupIds = PROGRESSION_GROUPS.map((g) => g.groupId).filter((g) => ignoredSet.has(g) && groupLevel(g) === 0);
  const acceptableLowGroupIds = [...lowOnlyGroupIds, ...excludedGroupIds];
  const acceptableLowInvestment: IntentFinding[] = acceptableLowGroupIds.map((groupId) => ({ code: "intent-lower-priority-low-allocation-good" as const, groupId, params: {} }));
  const acceptableLowSummary =
    lowOnlyGroupIds.length > 0 || excludedGroupIds.length > 0 ? { lowPriorityGroupIds: lowOnlyGroupIds, excludedGroupIds } : null;

  // --- 複数領域への配分そのものは問題ではないことの明示(balance目的では専用の所見が既にあるため重複させない) ---
  const activeGroupCount = PROGRESSION_GROUPS.filter((g) => groupLevel(g.groupId) > 0).length;
  const spreadNotAProblem: IntentFinding | null =
    !balanceGoalHandled &&
    activeGroupCount >= WIDE_SPREAD_ACTIVE_GROUP_COUNT &&
    effectivePriorityGroups.length > 0 &&
    possibleOverinvestmentForIntent.length === 0 &&
    avoidOverinvestmentFindings.length === 0 &&
    !secondaryAlignments.some((a) => a.priorityInversion)
      ? { code: "intent-spread-not-a-problem", groupId: null, params: { count: activeGroupCount } }
      : null;

  // --- 残りポイント僅少(目的に沿った配分がほぼ完成) ---
  const hasUnresolvedPriorityIssue =
    priorityAlignments.some((a) => a.state === "not-reflected" || a.state === "present-but-underprioritized") ||
    secondaryAlignments.some((a) => a.priorityInversion);
  const nearComplete: IntentFinding | null =
    effectivePriorityGroups.length > 0 && !hasUnresolvedPriorityIssue && totalPoints != null && remainingPoints != null && totalPoints > 0 && remainingPoints / totalPoints <= 0.1
      ? { code: "intent-near-complete", groupId: null, params: { remaining: remainingPoints } }
      : null;

  // --- 適合状態の判定(定性的) ---
  let alignment: IntentAlignment;
  if (userPriorityGroups.length === PROGRESSION_GROUPS.length || !abilityAvailable || effectivePriorityGroups.length === 0) {
    alignment = "insufficient-information";
  } else {
    const strongOrMostly = priorityAlignments.filter((a) => a.state === "strongly-aligned" || a.state === "mostly-aligned").length;
    const ratio = strongOrMostly / effectivePriorityGroups.length;
    const overCount = possibleOverinvestmentForIntent.length + avoidOverinvestmentFindings.length;
    if (ratio >= 1 && overCount === 0) alignment = "high";
    else if (ratio >= 0.5 && overCount <= 1) alignment = "mostly-aligned";
    else if (ratio > 0 || overCount <= 2) alignment = "partially-aligned";
    else alignment = "poorly-aligned";
  }

  // --- 一致している領域の統合表示(同じ状態のグループは1件へまとめる) ---
  const alignedGroups: AlignedGroupSummary[] = (["strongly-aligned", "mostly-aligned"] as const)
    .map((state) => {
      const entries = priorityAlignments.filter((a) => a.state === state);
      if (entries.length === 0) return null;
      return {
        state,
        groupIds: entries.map((e) => e.groupId),
        representativeAbilities: dedupAbilities(
          entries.map((e) => e.representativeAbilities),
          MAX_REPRESENTATIVE_ABILITIES,
        ),
      };
    })
    .filter((x): x is AlignedGroupSummary => x !== null);

  // --- 改善優先順位・辛口の結論が指す最重要課題
  //     (共通の種別順: 最優先の未反映 → 最優先の優先度不足 → 補助的優先の逆転 → 補助的優先の未反映
  //     → 上げすぎ注意(明示指定) → 過剰配分(一般)。補助的優先は最優先より必ず後に扱う。) ---
  type ImprovementSeed = { kind: IntentTopIssueKind; groupId: string };
  const improvementSeeds: ImprovementSeed[] = [
    ...priorityAlignments.filter((a) => a.state === "not-reflected").map((a) => ({ kind: "not-reflected" as const, groupId: a.groupId })),
    ...priorityAlignments.filter((a) => a.state === "present-but-underprioritized").map((a) => ({ kind: "underprioritized" as const, groupId: a.groupId })),
    // 軽度の逆転(review-recommended)は「明確な不一致」として断定しないため、改善候補・topIssueには含めない
    // (別途 priorityConfirmationItems として、確認事項扱いで保持する)。
    ...secondaryAlignments.filter((a) => a.priorityInversionSeverity === "clear-inversion").map((a) => ({ kind: "priority-inversion" as const, groupId: a.groupId })),
    ...secondaryAlignments.filter((a) => a.state === "not-reflected").map((a) => ({ kind: "secondary-not-reflected" as const, groupId: a.groupId })),
    ...avoidOverinvestmentFindings.map((f) => ({ kind: "avoid-overinvestment" as const, groupId: f.groupId as string })),
    ...possibleOverinvestmentForIntent.map((f) => ({ kind: "overinvestment" as const, groupId: f.groupId as string })),
  ];
  const buildImprovementFinding = (seed: ImprovementSeed): IntentFinding => {
    if (seed.kind === "overinvestment") return possibleOverinvestmentForIntent.find((f) => f.groupId === seed.groupId)!;
    if (seed.kind === "avoid-overinvestment") return avoidOverinvestmentFindings.find((f) => f.groupId === seed.groupId)!;
    if (seed.kind === "secondary-not-reflected") return { code: "intent-secondary-not-reflected", groupId: seed.groupId, params: {} };
    if (seed.kind === "priority-inversion") {
      const a = secondaryAlignments.find((x) => x.groupId === seed.groupId)!;
      return { code: "intent-secondary-priority-inversion", groupId: seed.groupId, params: { level: a.level, maxLevel: maxPriorityLevel } };
    }
    const a = priorityAlignments.find((x) => x.groupId === seed.groupId)!;
    return seed.kind === "not-reflected"
      ? { code: "intent-priority-not-reflected", groupId: seed.groupId, params: {} }
      : { code: "intent-priority-underprioritized", groupId: seed.groupId, params: { level: a.level, maxLevel: maxPriorityLevel } };
  };
  const improvementPriorities = improvementSeeds.slice(0, MAX_IMPROVEMENT).map(buildImprovementFinding);
  const misalignmentHighlights = improvementSeeds.slice(0, MAX_MISALIGNMENT_HIGHLIGHTS).map(buildImprovementFinding);
  const topIssue: IntentTopIssue | null = improvementSeeds[0] ? { kind: improvementSeeds[0].kind, groupId: improvementSeeds[0].groupId } : null;

  // --- 優先順位の確認事項(明確な不一致ではないが、配分が意図どおりか確認してほしい軽微な逆転)。
  //     改善候補・topIssueとは競合しない、別枠の「確認してほしいこと」として保持する。 ---
  const priorityConfirmationItems: IntentFinding[] = secondaryAlignments
    .filter((a) => a.priorityInversionSeverity === "review-recommended")
    .map((a) => ({ code: "intent-secondary-priority-inversion-review" as const, groupId: a.groupId, params: { level: a.level, maxLevel: maxPriorityLevel } }));

  // --- 維持すべき長所(最優先の改善対象とは異なる領域から選ぶ。
  //     ユーザーが明示した strengthsToPreserve を優先し、なければ最優先の強い一致を優先、
  //     それもなければ補助的優先の一致を候補にする(維持すべき副次的長所)。 ---
  const preserveCandidatesTop = priorityAlignments
    .filter((a) => (a.state === "strongly-aligned" || a.state === "mostly-aligned") && a.groupId !== topIssue?.groupId)
    .sort((a, b) => (a.state === "strongly-aligned" ? 0 : 1) - (b.state === "strongly-aligned" ? 0 : 1));
  const preserveCandidatesSecondary = secondaryAlignments.filter(
    (a) => (a.state === "strongly-aligned" || a.state === "mostly-aligned") && a.groupId !== topIssue?.groupId && !a.priorityInversion,
  );
  const preserveCandidates = [...preserveCandidatesTop, ...preserveCandidatesSecondary];
  const preserveHighlight: PriorityAlignmentEntry | null =
    preserveCandidates.find((a) => intent.strengthsToPreserve.includes(a.groupId)) ?? preserveCandidatesTop[0] ?? preserveCandidatesSecondary[0] ?? null;
  // ユーザーが明示した「維持したい長所」のうち、実データで長所として確認できなかった領域
  // (架空の長所を作らず、確認できない旨を案内するために保持する)。
  const confirmedPreserveIds = new Set(preserveCandidates.map((a) => a.groupId));
  const unconfirmedPreserveGroupIds = intent.strengthsToPreserve.filter((g) => VALID_GROUP_IDS.has(g) && !confirmedPreserveIds.has(g));

  // --- 別ビルドとの目的適合比較(具体的な差を最大3件・近い優先領域も明示) ---
  const priorityAbilitySet = new Set<string>();
  for (const g of effectivePriorityGroups) for (const s of statsOfGroup(g)) priorityAbilitySet.add(s);
  // ユーザーが比較で重視したい領域(comparisonFocusGroups)は、比較対象ビルドに限り優先能力集合へ加える。
  const focusAbilitySet = new Set(priorityAbilitySet);
  for (const g of intent.comparisonFocusGroups) for (const s of statsOfGroup(g)) focusAbilitySet.add(s);

  const comparisonRecommendations: BuildIntentComparisonResult[] = [];
  let comparisonTargetFound = false;
  if (effectivePriorityGroups.length > 0) {
    for (const sib of siblings) {
      const isTarget = intent.comparisonTargetBuildId != null && sib.buildId === intent.comparisonTargetBuildId;
      if (isTarget) comparisonTargetFound = true;
      const abilitySet = isTarget ? focusAbilitySet : priorityAbilitySet;

      if (sib.conditionDifference) {
        comparisonRecommendations.push({
          otherBuildId: sib.buildId,
          otherBuildName: sib.buildName,
          recommendation: "condition-differs",
          keyDifferences: [],
          closeGroups: [],
          usedPointsDiff: null,
          calculatedOvrDiff: null,
          isUserComparisonTarget: isTarget,
        });
        continue;
      }
      const sibHasData = Object.keys(sib.calculatedStats).length > 0;
      if (!finalAbilities || !sibHasData) {
        comparisonRecommendations.push({
          otherBuildId: sib.buildId,
          otherBuildName: sib.buildName,
          recommendation: "insufficient-data",
          keyDifferences: [],
          closeGroups: [],
          usedPointsDiff: null,
          calculatedOvrDiff: null,
          isUserComparisonTarget: isTarget,
        });
        continue;
      }
      const perGroupDiff = effectivePriorityGroups
        .map((g) => ({ groupId: g, diff: (groupAverage(finalAbilities, g) ?? 0) - (groupAverage(sib.calculatedStats, g) ?? 0), hasData: groupAverage(finalAbilities, g) != null && groupAverage(sib.calculatedStats, g) != null }))
        .filter((d) => d.hasData);
      if (perGroupDiff.length === 0) {
        comparisonRecommendations.push({
          otherBuildId: sib.buildId,
          otherBuildName: sib.buildName,
          recommendation: "insufficient-data",
          keyDifferences: [],
          closeGroups: [],
          usedPointsDiff: null,
          calculatedOvrDiff: null,
          isUserComparisonTarget: isTarget,
        });
        continue;
      }
      const currentAvgs = effectivePriorityGroups.map((g) => groupAverage(finalAbilities, g)).filter((v): v is number => v != null);
      const otherAvgs = effectivePriorityGroups.map((g) => groupAverage(sib.calculatedStats, g)).filter((v): v is number => v != null);
      const currentAvg = currentAvgs.reduce((a, b) => a + b, 0) / currentAvgs.length;
      const otherAvg = otherAvgs.reduce((a, b) => a + b, 0) / otherAvgs.length;
      const diff = currentAvg - otherAvg;
      const recommendation: IntentComparisonRecommendation = Math.abs(diff) <= SMALL_ABILITY_DIFF_THRESHOLD ? "similar" : diff > 0 ? "current-closer" : "other-closer";

      const closeGroups = perGroupDiff.filter((d) => Math.abs(d.diff) <= SMALL_ABILITY_DIFF_THRESHOLD).map((d) => d.groupId);
      const relevantDiffs = sib.topAbilityDifferences.filter((d) => abilitySet.has(d.abilityId)).slice(0, MAX_COMPARISON_DIFFERENCES);

      comparisonRecommendations.push({
        otherBuildId: sib.buildId,
        otherBuildName: sib.buildName,
        recommendation,
        keyDifferences: relevantDiffs,
        closeGroups,
        usedPointsDiff: sib.usedPointsDiff,
        calculatedOvrDiff: sib.calculatedOvrDiff,
        isUserComparisonTarget: isTarget,
      });
    }
  }
  // ユーザーが明示した比較対象がある場合は先頭へ(存在しない場合は静かに無視するのではなく制限として記録する)。
  comparisonRecommendations.sort((a, b) => Number(b.isUserComparisonTarget) - Number(a.isUserComparisonTarget));
  if (intent.comparisonTargetBuildId != null && !comparisonTargetFound) {
    limitations.push("intent-comparison-target-not-found");
  }
  if (comparisonRecommendations.some((c) => c.recommendation === "insufficient-data")) {
    if (!confidenceReasons.includes("intent-insufficient-ability-data")) confidenceReasons.push("intent-insufficient-ability-data");
  }

  const reflectionStatus = computeIntentReflectionStatus(intent, {
    comparisonTargetResolved: comparisonTargetFound,
    preserveConfirmed: intent.strengthsToPreserve.some((g) => confirmedPreserveIds.has(g)),
  });

  return {
    hasIntent: true,
    alignment,
    effectivePriorityGroups,
    priorityAlignments,
    secondaryAlignments,
    alignedGroups,
    balanceGoalFinding,
    possibleOverinvestmentForIntent: possibleOverinvestmentForIntent.slice(0, MAX_OVERINVESTMENT),
    avoidOverinvestmentFindings: avoidOverinvestmentFindings.slice(0, MAX_OVERINVESTMENT),
    acceptableLowInvestment: acceptableLowInvestment.slice(0, MAX_ACCEPTABLE_LOW),
    acceptableLowSummary,
    spreadNotAProblem,
    nearComplete,
    improvementPriorities,
    misalignmentHighlights,
    priorityConfirmationItems,
    topIssue,
    preserveHighlight,
    unconfirmedPreserveGroupIds,
    comparisonRecommendations,
    priorityCountGuidance,
    lowerPriorityCountGuidance,
    reflectionStatus,
    confidenceReasons: [...new Set(confidenceReasons)],
    limitations: [...new Set(limitations)],
  };
}

/**
 * 分析対象を切り替えたときの「分析目的」入力の引き継ぎ/リセット規則(純関数)。
 * - 同一カード(worldCardId が同じ)の別ビルドへ切り替えた場合は入力を引き継ぐ(比較しやすくするため)。
 * - 別カードへ切り替えた場合はリセットする(目的の誤適用を避けるため)。
 * - パネルを閉じただけ(nextWorldCardId が null)では変更しない。
 */
export function resolveIntentOnCardChange(currentIntent: BuildIntentInput, previousWorldCardId: string | null, nextWorldCardId: string | null): BuildIntentInput {
  if (nextWorldCardId == null) return currentIntent;
  if (previousWorldCardId === nextWorldCardId) return currentIntent;
  return emptyBuildIntent();
}
