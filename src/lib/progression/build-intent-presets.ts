import { PROGRESSION_GROUPS } from "./stat-groups";
import { PROGRESSION_RULES_VERSION } from "./constants";
import {
  emptyBuildIntent,
  normalizeBuildIntent,
  type BuildIntentInput,
  type GroupPriorityState,
  type PrimaryGoalId,
} from "./build-intent-analysis";

/**
 * 育成目的プリセット(標準UIのメイン入力方式)。
 *
 * - 自由記述解析(RuleBasedBuildIntentExtractor)を置き換えるものではなく、標準UIの
 *   メイン操作を「自由文解析」から「決定的なプリセット選択」へ移す、言語非依存の構造化データ。
 * - 表示文言(タイトル・説明)はここへ直書きせず、ja/en辞書キー(titleKey/descriptionKey)で解決する。
 * - 既存の PrimaryGoalId・PROGRESSION_GROUPS の groupId・既存の使用予定ポジション以外は使用しない。
 * - 能力値・育成ポイント・OVR・勝率・順位・プレースタイル発動条件は一切含めない
 *   (プリセットは「分析条件(主目的・優先領域・ポジション候補)」を設定するだけ)。
 * - id は表示名から独立した安定値とし、表示名の変更で id が変わらないようにする
 *   (将来のカテゴリ別集計・称号等の軸として再利用できるようにするため)。
 */

export type PresetCategoryId =
  | "scoring"
  | "dribbling-possession"
  | "passing-creation"
  | "wide-crossing"
  | "speed-counter"
  | "physical-aerial"
  | "defending"
  | "goalkeeping"
  | "balanced-adjustment";

export const PRESET_CATEGORY_IDS: PresetCategoryId[] = [
  "scoring",
  "dribbling-possession",
  "passing-creation",
  "wide-crossing",
  "speed-counter",
  "physical-aerial",
  "defending",
  "goalkeeping",
  "balanced-adjustment",
];

export interface PresetCategoryDef {
  categoryId: PresetCategoryId;
  titleKey: string;
  sortOrder: number;
}

export const PRESET_CATEGORIES: PresetCategoryDef[] = [
  { categoryId: "scoring", titleKey: "presetCategoryScoringTitle", sortOrder: 0 },
  { categoryId: "dribbling-possession", titleKey: "presetCategoryDribblingPossessionTitle", sortOrder: 1 },
  { categoryId: "passing-creation", titleKey: "presetCategoryPassingCreationTitle", sortOrder: 2 },
  { categoryId: "wide-crossing", titleKey: "presetCategoryWideCrossingTitle", sortOrder: 3 },
  { categoryId: "speed-counter", titleKey: "presetCategorySpeedCounterTitle", sortOrder: 4 },
  { categoryId: "physical-aerial", titleKey: "presetCategoryPhysicalAerialTitle", sortOrder: 5 },
  { categoryId: "defending", titleKey: "presetCategoryDefendingTitle", sortOrder: 6 },
  { categoryId: "goalkeeping", titleKey: "presetCategoryGoalkeepingTitle", sortOrder: 7 },
  { categoryId: "balanced-adjustment", titleKey: "presetCategoryBalancedAdjustmentTitle", sortOrder: 8 },
];

/** 将来、実験的プリセットを段階導入するための区分(現時点ではすべて "stable")。 */
export type PresetAvailability = "stable";

export interface BuildIntentPreset {
  id: string;
  categoryId: PresetCategoryId;
  titleKey: string;
  shortDescriptionKey: string;
  detailDescriptionKey: string;
  primaryGoal: PrimaryGoalId;
  priorityGroups: string[];
  secondaryGroups: string[];
  /** 現時点では全プリセット未使用(必要最小限の既定値のみ、という方針のため)。将来の拡張用に型は保持する。 */
  defaultLowPriorityGroups: string[];
  defaultAvoidOverinvestmentGroups: string[];
  defaultIgnoredGroups: string[];
  /** 候補表示のみに使用。ユーザーが選択しない限り自動確定しない。 */
  suggestedPositions: string[];
  /** 現時点では全プリセット未使用(比較対象は既存の独立した選択項目のため)。将来の拡張用に型は保持する。 */
  comparisonFocusGroups: string[];
  /** 現時点では全プリセット未使用(「現在の長所」は保存ビルドごとに動的なため、静的プリセットでは安全に決定できない)。 */
  strengthsToPreserveCandidates: string[];
  /** 検索・言い換え対応のための言語非依存タグ(表示はしない)。 */
  searchTagKeys: string[];
  availability: PresetAvailability;
  sortOrder: number;
  rulesVersion: string;
}

const RV = PROGRESSION_RULES_VERSION;

/**
 * 初期プリセット一覧(45件)。
 *
 * 採用方針: 既存の10能力領域・既存のPrimaryGoalId・既存の使用予定ポジションだけで、
 * 他の採用済みプリセットと安全に区別できるものだけを採用した(仕様書の57候補のうち12件は、
 * 現行モデルの粒度では既存プリセットと機械的に区別できないため不採用とした。詳細はテスト・
 * 完了報告を参照)。
 */
export const BUILD_INTENT_PRESETS: BuildIntentPreset[] = [
  // ------------------------------------------------------------------
  // 得点 (scoring)
  // ------------------------------------------------------------------
  {
    id: "scoring-specialist",
    categoryId: "scoring",
    titleKey: "presetScoringSpecialistTitle",
    shortDescriptionKey: "presetScoringSpecialistShort",
    detailDescriptionKey: "presetScoringSpecialistDetail",
    primaryGoal: "scoring",
    priorityGroups: ["shooting"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CF", "SS"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagScoring", "presetTagShooting", "presetTagFinisher"],
    availability: "stable",
    sortOrder: 0,
    rulesVersion: RV,
  },
  {
    id: "box-finisher",
    categoryId: "scoring",
    titleKey: "presetBoxFinisherTitle",
    shortDescriptionKey: "presetBoxFinisherShort",
    detailDescriptionKey: "presetBoxFinisherDetail",
    primaryGoal: "scoring",
    priorityGroups: ["shooting"],
    secondaryGroups: ["dexterity"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagScoring", "presetTagShooting", "presetTagBox"],
    availability: "stable",
    sortOrder: 1,
    rulesVersion: RV,
  },
  {
    id: "dribble-to-shot",
    categoryId: "scoring",
    titleKey: "presetDribbleToShotTitle",
    shortDescriptionKey: "presetDribbleToShotShort",
    detailDescriptionKey: "presetDribbleToShotDetail",
    primaryGoal: "scoring",
    priorityGroups: ["shooting"],
    secondaryGroups: ["dribbling"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CF", "SS", "LWF", "RWF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagScoring", "presetTagDribbling"],
    availability: "stable",
    sortOrder: 2,
    rulesVersion: RV,
  },
  {
    id: "cross-receive-scoring",
    categoryId: "scoring",
    titleKey: "presetCrossReceiveScoringTitle",
    shortDescriptionKey: "presetCrossReceiveScoringShort",
    detailDescriptionKey: "presetCrossReceiveScoringDetail",
    primaryGoal: "scoring",
    priorityGroups: ["shooting"],
    secondaryGroups: ["aerialStrength"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CF", "SS"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagScoring", "presetTagCross", "presetTagAerial"],
    availability: "stable",
    sortOrder: 3,
    rulesVersion: RV,
  },
  {
    id: "aerial-scoring",
    categoryId: "scoring",
    titleKey: "presetAerialScoringTitle",
    shortDescriptionKey: "presetAerialScoringShort",
    detailDescriptionKey: "presetAerialScoringDetail",
    primaryGoal: "aerial",
    priorityGroups: ["aerialStrength"],
    secondaryGroups: ["shooting"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagAerial", "presetTagScoring", "presetTagCross"],
    availability: "stable",
    sortOrder: 4,
    rulesVersion: RV,
  },

  // ------------------------------------------------------------------
  // ドリブル・ボール保持 (dribbling-possession)
  // ------------------------------------------------------------------
  {
    id: "dribble-breakthrough",
    categoryId: "dribbling-possession",
    titleKey: "presetDribbleBreakthroughTitle",
    shortDescriptionKey: "presetDribbleBreakthroughShort",
    detailDescriptionKey: "presetDribbleBreakthroughDetail",
    primaryGoal: "dribbling",
    priorityGroups: ["dribbling"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagDribbling"],
    availability: "stable",
    sortOrder: 5,
    rulesVersion: RV,
  },
  {
    id: "beat-one-on-wing",
    categoryId: "dribbling-possession",
    titleKey: "presetBeatOneOnWingTitle",
    shortDescriptionKey: "presetBeatOneOnWingShort",
    detailDescriptionKey: "presetBeatOneOnWingDetail",
    primaryGoal: "dribbling",
    priorityGroups: ["dribbling"],
    secondaryGroups: ["dexterity"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LWF", "RWF", "LMF", "RMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagDribbling", "presetTagWide"],
    availability: "stable",
    sortOrder: 6,
    rulesVersion: RV,
  },
  {
    id: "tight-space-possession",
    categoryId: "dribbling-possession",
    titleKey: "presetTightSpacePossessionTitle",
    shortDescriptionKey: "presetTightSpacePossessionShort",
    detailDescriptionKey: "presetTightSpacePossessionDetail",
    primaryGoal: "possession",
    priorityGroups: ["dribbling"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPossession", "presetTagDribbling"],
    availability: "stable",
    sortOrder: 7,
    rulesVersion: RV,
  },
  {
    id: "hard-to-dispossess",
    categoryId: "dribbling-possession",
    titleKey: "presetHardToDispossessTitle",
    shortDescriptionKey: "presetHardToDispossessShort",
    detailDescriptionKey: "presetHardToDispossessDetail",
    primaryGoal: "possession",
    priorityGroups: ["dribbling"],
    secondaryGroups: ["lowerBodyStrength"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPossession", "presetTagDribbling"],
    availability: "stable",
    sortOrder: 8,
    rulesVersion: RV,
  },
  {
    id: "carry-through-center",
    categoryId: "dribbling-possession",
    titleKey: "presetCarryThroughCenterTitle",
    shortDescriptionKey: "presetCarryThroughCenterShort",
    detailDescriptionKey: "presetCarryThroughCenterDetail",
    primaryGoal: "dribbling",
    priorityGroups: ["dribbling"],
    secondaryGroups: ["dexterity"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CMF", "AMF", "DMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagDribbling", "presetTagCentral"],
    availability: "stable",
    sortOrder: 9,
    rulesVersion: RV,
  },
  {
    id: "cut-inside-attack",
    categoryId: "dribbling-possession",
    titleKey: "presetCutInsideAttackTitle",
    shortDescriptionKey: "presetCutInsideAttackShort",
    detailDescriptionKey: "presetCutInsideAttackDetail",
    primaryGoal: "dribbling",
    priorityGroups: ["dribbling"],
    secondaryGroups: ["shooting"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LWF", "RWF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagDribbling", "presetTagWide", "presetTagScoring"],
    availability: "stable",
    sortOrder: 10,
    rulesVersion: RV,
  },
  {
    id: "receive-and-distribute",
    categoryId: "dribbling-possession",
    titleKey: "presetReceiveAndDistributeTitle",
    shortDescriptionKey: "presetReceiveAndDistributeShort",
    detailDescriptionKey: "presetReceiveAndDistributeDetail",
    primaryGoal: "possession",
    priorityGroups: ["dribbling"],
    secondaryGroups: ["passing"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPossession", "presetTagPassing"],
    availability: "stable",
    sortOrder: 11,
    rulesVersion: RV,
  },
  {
    id: "quickness-focus",
    categoryId: "dribbling-possession",
    titleKey: "presetQuicknessFocusTitle",
    shortDescriptionKey: "presetQuicknessFocusShort",
    detailDescriptionKey: "presetQuicknessFocusDetail",
    primaryGoal: "speed",
    priorityGroups: ["dexterity"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagSpeed", "presetTagDribbling"],
    availability: "stable",
    sortOrder: 12,
    rulesVersion: RV,
  },

  // ------------------------------------------------------------------
  // パス・チャンスメイク (passing-creation)
  // ------------------------------------------------------------------
  {
    id: "passing-specialist",
    categoryId: "passing-creation",
    titleKey: "presetPassingSpecialistTitle",
    shortDescriptionKey: "presetPassingSpecialistShort",
    detailDescriptionKey: "presetPassingSpecialistDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPassing"],
    availability: "stable",
    sortOrder: 13,
    rulesVersion: RV,
  },
  {
    id: "game-making",
    categoryId: "passing-creation",
    titleKey: "presetGameMakingTitle",
    shortDescriptionKey: "presetGameMakingShort",
    detailDescriptionKey: "presetGameMakingDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: ["dribbling"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["AMF", "CMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPassing", "presetTagCentral"],
    availability: "stable",
    sortOrder: 14,
    rulesVersion: RV,
  },
  {
    id: "forward-service",
    categoryId: "passing-creation",
    titleKey: "presetForwardServiceTitle",
    shortDescriptionKey: "presetForwardServiceShort",
    detailDescriptionKey: "presetForwardServiceDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["DMF", "CMF", "CB"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPassing", "presetTagCentral"],
    availability: "stable",
    sortOrder: 15,
    rulesVersion: RV,
  },
  {
    id: "distribute-the-ball",
    categoryId: "passing-creation",
    titleKey: "presetDistributeTheBallTitle",
    shortDescriptionKey: "presetDistributeTheBallShort",
    detailDescriptionKey: "presetDistributeTheBallDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: ["dexterity"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPassing"],
    availability: "stable",
    sortOrder: 16,
    rulesVersion: RV,
  },
  {
    id: "possession-anchor",
    categoryId: "passing-creation",
    titleKey: "presetPossessionAnchorTitle",
    shortDescriptionKey: "presetPossessionAnchorShort",
    detailDescriptionKey: "presetPossessionAnchorDetail",
    primaryGoal: "possession",
    priorityGroups: ["passing"],
    secondaryGroups: ["dribbling"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["DMF", "CMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPossession", "presetTagPassing", "presetTagCentral"],
    availability: "stable",
    sortOrder: 17,
    rulesVersion: RV,
  },

  // ------------------------------------------------------------------
  // サイド・クロス (wide-crossing)
  // ------------------------------------------------------------------
  {
    id: "cross-supply",
    categoryId: "wide-crossing",
    titleKey: "presetCrossSupplyTitle",
    shortDescriptionKey: "presetCrossSupplyShort",
    detailDescriptionKey: "presetCrossSupplyDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LWF", "RWF", "LMF", "RMF", "LB", "RB"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagCross", "presetTagPassing", "presetTagWide"],
    availability: "stable",
    sortOrder: 18,
    rulesVersion: RV,
  },
  {
    id: "dribble-then-cross",
    categoryId: "wide-crossing",
    titleKey: "presetDribbleThenCrossTitle",
    shortDescriptionKey: "presetDribbleThenCrossShort",
    detailDescriptionKey: "presetDribbleThenCrossDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: ["dribbling"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LWF", "RWF", "LMF", "RMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagCross", "presetTagDribbling", "presetTagWide"],
    availability: "stable",
    sortOrder: 19,
    rulesVersion: RV,
  },
  {
    id: "wide-chance-creation",
    categoryId: "wide-crossing",
    titleKey: "presetWideChanceCreationTitle",
    shortDescriptionKey: "presetWideChanceCreationShort",
    detailDescriptionKey: "presetWideChanceCreationDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: ["dexterity"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LMF", "RMF", "LWF", "RWF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagCross", "presetTagPassing", "presetTagWide"],
    availability: "stable",
    sortOrder: 20,
    rulesVersion: RV,
  },
  {
    id: "carry-down-line",
    categoryId: "wide-crossing",
    titleKey: "presetCarryDownLineTitle",
    shortDescriptionKey: "presetCarryDownLineShort",
    detailDescriptionKey: "presetCarryDownLineDetail",
    primaryGoal: "dribbling",
    priorityGroups: ["dribbling"],
    secondaryGroups: ["dexterity"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LB", "RB", "LMF", "RMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagWide", "presetTagDribbling"],
    availability: "stable",
    sortOrder: 21,
    rulesVersion: RV,
  },
  {
    id: "cut-inside-shoot",
    categoryId: "wide-crossing",
    titleKey: "presetCutInsideShootTitle",
    shortDescriptionKey: "presetCutInsideShootShort",
    detailDescriptionKey: "presetCutInsideShootDetail",
    primaryGoal: "scoring",
    priorityGroups: ["shooting"],
    secondaryGroups: ["dribbling"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LWF", "RWF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagWide", "presetTagScoring", "presetTagDribbling"],
    availability: "stable",
    sortOrder: 22,
    rulesVersion: RV,
  },
  {
    id: "attacking-fullback",
    categoryId: "wide-crossing",
    titleKey: "presetAttackingFullbackTitle",
    shortDescriptionKey: "presetAttackingFullbackShort",
    detailDescriptionKey: "presetAttackingFullbackDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: ["dexterity"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LB", "RB"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagWide", "presetTagPassing", "presetTagFullback"],
    availability: "stable",
    sortOrder: 23,
    rulesVersion: RV,
  },
  {
    id: "defensive-fullback",
    categoryId: "wide-crossing",
    titleKey: "presetDefensiveFullbackTitle",
    shortDescriptionKey: "presetDefensiveFullbackShort",
    detailDescriptionKey: "presetDefensiveFullbackDetail",
    primaryGoal: "defense",
    priorityGroups: ["defending"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LB", "RB"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagWide", "presetTagDefending", "presetTagFullback"],
    availability: "stable",
    sortOrder: 24,
    rulesVersion: RV,
  },

  // ------------------------------------------------------------------
  // スピード・カウンター (speed-counter)
  // ------------------------------------------------------------------
  {
    id: "speed-breakthrough",
    categoryId: "speed-counter",
    titleKey: "presetSpeedBreakthroughTitle",
    shortDescriptionKey: "presetSpeedBreakthroughShort",
    detailDescriptionKey: "presetSpeedBreakthroughDetail",
    primaryGoal: "speed",
    priorityGroups: ["dexterity"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagSpeed"],
    availability: "stable",
    sortOrder: 25,
    rulesVersion: RV,
  },
  {
    id: "run-in-behind",
    categoryId: "speed-counter",
    titleKey: "presetRunInBehindTitle",
    shortDescriptionKey: "presetRunInBehindShort",
    detailDescriptionKey: "presetRunInBehindDetail",
    primaryGoal: "speed",
    priorityGroups: ["dexterity"],
    secondaryGroups: ["shooting"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CF", "SS"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagSpeed", "presetTagScoring"],
    availability: "stable",
    sortOrder: 26,
    rulesVersion: RV,
  },
  {
    id: "counter-outlet",
    categoryId: "speed-counter",
    titleKey: "presetCounterOutletTitle",
    shortDescriptionKey: "presetCounterOutletShort",
    detailDescriptionKey: "presetCounterOutletDetail",
    primaryGoal: "counter",
    priorityGroups: ["dexterity"],
    secondaryGroups: ["dribbling"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagSpeed", "presetTagCounter", "presetTagDribbling"],
    availability: "stable",
    sortOrder: 27,
    rulesVersion: RV,
  },
  {
    id: "sprint-down-wing",
    categoryId: "speed-counter",
    titleKey: "presetSprintDownWingTitle",
    shortDescriptionKey: "presetSprintDownWingShort",
    detailDescriptionKey: "presetSprintDownWingDetail",
    primaryGoal: "speed",
    priorityGroups: ["dexterity"],
    secondaryGroups: ["passing"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["LB", "RB", "LMF", "RMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagSpeed", "presetTagWide", "presetTagPassing"],
    availability: "stable",
    sortOrder: 28,
    rulesVersion: RV,
  },

  // ------------------------------------------------------------------
  // フィジカル・空中戦 (physical-aerial)
  // ------------------------------------------------------------------
  {
    id: "aerial-specialist",
    categoryId: "physical-aerial",
    titleKey: "presetAerialSpecialistTitle",
    shortDescriptionKey: "presetAerialSpecialistShort",
    detailDescriptionKey: "presetAerialSpecialistDetail",
    primaryGoal: "aerial",
    priorityGroups: ["aerialStrength"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagAerial", "presetTagPhysical"],
    availability: "stable",
    sortOrder: 29,
    rulesVersion: RV,
  },
  {
    id: "target-man",
    categoryId: "physical-aerial",
    titleKey: "presetTargetManTitle",
    shortDescriptionKey: "presetTargetManShort",
    detailDescriptionKey: "presetTargetManDetail",
    primaryGoal: "aerial",
    priorityGroups: ["aerialStrength"],
    secondaryGroups: ["lowerBodyStrength"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagAerial", "presetTagPhysical", "presetTagTarget"],
    availability: "stable",
    sortOrder: 30,
    rulesVersion: RV,
  },
  {
    id: "post-play",
    categoryId: "physical-aerial",
    titleKey: "presetPostPlayTitle",
    shortDescriptionKey: "presetPostPlayShort",
    detailDescriptionKey: "presetPostPlayDetail",
    primaryGoal: "possession",
    priorityGroups: ["lowerBodyStrength"],
    secondaryGroups: ["dribbling"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPhysical", "presetTagPossession", "presetTagTarget"],
    availability: "stable",
    sortOrder: 31,
    rulesVersion: RV,
  },
  {
    id: "resist-physical-contact",
    categoryId: "physical-aerial",
    titleKey: "presetResistPhysicalContactTitle",
    shortDescriptionKey: "presetResistPhysicalContactShort",
    detailDescriptionKey: "presetResistPhysicalContactDetail",
    primaryGoal: "physical",
    priorityGroups: ["lowerBodyStrength"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagPhysical"],
    availability: "stable",
    sortOrder: 32,
    rulesVersion: RV,
  },

  // ------------------------------------------------------------------
  // 守備 (defending)
  // ------------------------------------------------------------------
  {
    id: "ball-winning-specialist",
    categoryId: "defending",
    titleKey: "presetBallWinningSpecialistTitle",
    shortDescriptionKey: "presetBallWinningSpecialistShort",
    detailDescriptionKey: "presetBallWinningSpecialistDetail",
    primaryGoal: "defense",
    priorityGroups: ["defending"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagDefending"],
    availability: "stable",
    sortOrder: 33,
    rulesVersion: RV,
  },
  {
    id: "midfield-destroyer",
    categoryId: "defending",
    titleKey: "presetMidfieldDestroyerTitle",
    shortDescriptionKey: "presetMidfieldDestroyerShort",
    detailDescriptionKey: "presetMidfieldDestroyerDetail",
    primaryGoal: "defense",
    priorityGroups: ["defending"],
    secondaryGroups: ["lowerBodyStrength"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["DMF", "CMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagDefending", "presetTagCentral", "presetTagPhysical"],
    availability: "stable",
    sortOrder: 34,
    rulesVersion: RV,
  },
  {
    id: "man-marking-focus",
    categoryId: "defending",
    titleKey: "presetManMarkingFocusTitle",
    shortDescriptionKey: "presetManMarkingFocusShort",
    detailDescriptionKey: "presetManMarkingFocusDetail",
    primaryGoal: "defense",
    priorityGroups: ["defending"],
    secondaryGroups: ["dexterity"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CB", "DMF"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagDefending", "presetTagSpeed"],
    availability: "stable",
    sortOrder: 35,
    rulesVersion: RV,
  },
  {
    id: "backline-stability",
    categoryId: "defending",
    titleKey: "presetBacklineStabilityTitle",
    shortDescriptionKey: "presetBacklineStabilityShort",
    detailDescriptionKey: "presetBacklineStabilityDetail",
    primaryGoal: "defense",
    priorityGroups: ["defending"],
    secondaryGroups: ["aerialStrength"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["CB"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagDefending", "presetTagAerial"],
    availability: "stable",
    sortOrder: 36,
    rulesVersion: RV,
  },

  // ------------------------------------------------------------------
  // GK (goalkeeping)
  // ------------------------------------------------------------------
  {
    id: "shot-stopping-focus",
    categoryId: "goalkeeping",
    titleKey: "presetShotStoppingFocusTitle",
    shortDescriptionKey: "presetShotStoppingFocusShort",
    detailDescriptionKey: "presetShotStoppingFocusDetail",
    primaryGoal: "other",
    priorityGroups: ["goalkeeping1"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["GK"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagGoalkeeping"],
    availability: "stable",
    sortOrder: 37,
    rulesVersion: RV,
  },
  {
    id: "high-ball-focus",
    categoryId: "goalkeeping",
    titleKey: "presetHighBallFocusTitle",
    shortDescriptionKey: "presetHighBallFocusShort",
    detailDescriptionKey: "presetHighBallFocusDetail",
    primaryGoal: "other",
    priorityGroups: ["goalkeeping3"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["GK"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagGoalkeeping", "presetTagAerial"],
    availability: "stable",
    sortOrder: 38,
    rulesVersion: RV,
  },
  {
    id: "catching-focus",
    categoryId: "goalkeeping",
    titleKey: "presetCatchingFocusTitle",
    shortDescriptionKey: "presetCatchingFocusShort",
    detailDescriptionKey: "presetCatchingFocusDetail",
    primaryGoal: "other",
    priorityGroups: ["goalkeeping2"],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["GK"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagGoalkeeping"],
    availability: "stable",
    sortOrder: 39,
    rulesVersion: RV,
  },
  {
    id: "sweeper-keeper",
    categoryId: "goalkeeping",
    titleKey: "presetSweeperKeeperTitle",
    shortDescriptionKey: "presetSweeperKeeperShort",
    detailDescriptionKey: "presetSweeperKeeperDetail",
    primaryGoal: "other",
    priorityGroups: ["goalkeeping1"],
    secondaryGroups: ["goalkeeping3"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["GK"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagGoalkeeping"],
    availability: "stable",
    sortOrder: 40,
    rulesVersion: RV,
  },
  {
    id: "distributing-gk",
    categoryId: "goalkeeping",
    titleKey: "presetDistributingGkTitle",
    shortDescriptionKey: "presetDistributingGkShort",
    detailDescriptionKey: "presetDistributingGkDetail",
    primaryGoal: "passing",
    priorityGroups: ["passing"],
    secondaryGroups: ["goalkeeping1"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: ["GK"],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagGoalkeeping", "presetTagPassing"],
    availability: "stable",
    sortOrder: 41,
    rulesVersion: RV,
  },

  // ------------------------------------------------------------------
  // 万能・調整 (balanced-adjustment)
  // ------------------------------------------------------------------
  {
    id: "balanced-type",
    categoryId: "balanced-adjustment",
    titleKey: "presetBalancedTypeTitle",
    shortDescriptionKey: "presetBalancedTypeShort",
    detailDescriptionKey: "presetBalancedTypeDetail",
    primaryGoal: "balance",
    priorityGroups: [],
    secondaryGroups: [],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagBalance"],
    availability: "stable",
    sortOrder: 42,
    rulesVersion: RV,
  },
  {
    id: "attack-leaning-balance",
    categoryId: "balanced-adjustment",
    titleKey: "presetAttackLeaningBalanceTitle",
    shortDescriptionKey: "presetAttackLeaningBalanceShort",
    detailDescriptionKey: "presetAttackLeaningBalanceDetail",
    primaryGoal: "balance",
    priorityGroups: [],
    secondaryGroups: ["shooting", "dribbling"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagBalance", "presetTagScoring", "presetTagDribbling"],
    availability: "stable",
    sortOrder: 43,
    rulesVersion: RV,
  },
  {
    id: "defense-leaning-balance",
    categoryId: "balanced-adjustment",
    titleKey: "presetDefenseLeaningBalanceTitle",
    shortDescriptionKey: "presetDefenseLeaningBalanceShort",
    detailDescriptionKey: "presetDefenseLeaningBalanceDetail",
    primaryGoal: "balance",
    priorityGroups: [],
    secondaryGroups: ["defending", "aerialStrength"],
    defaultLowPriorityGroups: [],
    defaultAvoidOverinvestmentGroups: [],
    defaultIgnoredGroups: [],
    suggestedPositions: [],
    comparisonFocusGroups: [],
    strengthsToPreserveCandidates: [],
    searchTagKeys: ["presetTagBalance", "presetTagDefending", "presetTagAerial"],
    availability: "stable",
    sortOrder: 44,
    rulesVersion: RV,
  },
];

export const RECOMMENDED_PRESET_IDS: string[] = [
  "dribble-breakthrough",
  "scoring-specialist",
  "cross-supply",
  "speed-breakthrough",
  "passing-specialist",
  "ball-winning-specialist",
  "balanced-type",
];

const PRESET_BY_ID = new Map(BUILD_INTENT_PRESETS.map((p) => [p.id, p]));
export function getPresetById(id: string | null | undefined): BuildIntentPreset | undefined {
  if (!id) return undefined;
  return PRESET_BY_ID.get(id);
}

export function getPresetsByCategory(categoryId: PresetCategoryId): BuildIntentPreset[] {
  return BUILD_INTENT_PRESETS.filter((p) => p.categoryId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export const MAX_SUB_PRESETS = 2;

/**
 * 検索用に文字列を正規化する(大文字小文字・全角半角・連続空白の差を安全に吸収する)。
 * 外部通信は行わない(ローカルデータ上の純粋な文字列比較のみ)。
 */
export function normalizeSearchText(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface PresetSearchDictionaryLookup {
  (key: string): string;
}

/**
 * プリセット検索(ローカルデータ上の純粋な文字列一致・外部通信なし)。
 * 対象: 日本語/英語タイトル・短い説明・検索タグの表示文言(呼び出し側の翻訳関数で解決済みの文字列)。
 */
export function searchPresets(query: string, presets: BuildIntentPreset[], resolveText: PresetSearchDictionaryLookup): BuildIntentPreset[] {
  const q = normalizeSearchText(query);
  if (q.length === 0) return presets;
  return presets.filter((p) => {
    const haystacks = [resolveText(p.titleKey), resolveText(p.shortDescriptionKey), resolveText(p.detailDescriptionKey), ...p.searchTagKeys.map(resolveText)];
    return haystacks.some((h) => normalizeSearchText(h).includes(q));
  });
}

// ---------------------------------------------------------------------------
// プリセット → BuildIntentInput への決定的な適用
// ---------------------------------------------------------------------------

/** プリセットの主目的・優先領域だけから作られる、素の(手動修正を含まない)優先度マップ。 */
export function presetDerivedGroupPriorities(mainPresetId: string | null, subPresetIds: string[]): Partial<Record<string, GroupPriorityState>> {
  const mainPreset = getPresetById(mainPresetId);
  const subPresets = [...new Set(subPresetIds)]
    .filter((id) => id !== mainPresetId)
    .slice(0, MAX_SUB_PRESETS)
    .map((id) => getPresetById(id))
    .filter((p): p is BuildIntentPreset => p != null);

  const priorityGroups = new Set<string>();
  const secondaryGroups = new Set<string>();
  if (mainPreset) {
    for (const g of mainPreset.priorityGroups) priorityGroups.add(g);
    for (const g of mainPreset.secondaryGroups) secondaryGroups.add(g);
  }
  for (const sub of subPresets) {
    for (const g of sub.priorityGroups) secondaryGroups.add(g);
    for (const g of sub.secondaryGroups) secondaryGroups.add(g);
  }
  // 最優先と補助的重視が重複する場合は、最優先を優先する(二重登録しない)。
  for (const g of priorityGroups) secondaryGroups.delete(g);

  const groupPriorities: Partial<Record<string, GroupPriorityState>> = {};
  for (const g of PROGRESSION_GROUPS) {
    if (priorityGroups.has(g.groupId)) groupPriorities[g.groupId] = "priority";
    else if (secondaryGroups.has(g.groupId)) groupPriorities[g.groupId] = "secondary";
  }
  return groupPriorities;
}

/** メイン・サブ選択だけから、確定前の「プレビュー専用」BuildIntentInput を作る(手動編集を含まない素の状態)。 */
export function buildPresetPreviewIntent(mainPresetId: string | null, subPresetIds: string[]): BuildIntentInput {
  const mainPreset = getPresetById(mainPresetId);
  const result = normalizeBuildIntent({
    ...emptyBuildIntent(),
    primaryGoal: mainPreset?.primaryGoal ?? "unspecified",
    groupPriorities: presetDerivedGroupPriorities(mainPresetId, subPresetIds),
  });
  return result.intent;
}

/**
 * プリセット由来の既定値の上に、ユーザーが詳細設定で明示的に変更した項目だけを重ねて
 * ドラフト BuildIntentInput を合成する(純関数・非破壊)。
 *
 * - `manualGroupOverrides` に含まれる groupId は、必ずユーザー指定の値を優先する
 *   (プリセットが要求する値と異なっていても上書きしない=競合として検出する側で扱う)。
 * - `manualGroupOverrides` に含まれない groupId は、プリセット側の既定値をそのまま使う。
 * - primaryGoal は `manualPrimaryGoalOverride` が非nullの場合のみユーザー指定を優先する。
 * - intendedPositions・avoidOverinvestmentGroups・intentionallyIgnoredGroups・
 *   comparisonTargetBuildId・comparisonFocusGroups・strengthsToPreserve・freeText は
 *   現状どのプリセットも既定値を持たないため、常に `manualFields` の値をそのまま使う。
 */
export function composeDraftIntent(
  mainPresetId: string | null,
  subPresetIds: string[],
  manualGroupOverrides: Partial<Record<string, GroupPriorityState>>,
  manualPrimaryGoalOverride: PrimaryGoalId | null,
  manualFields: Omit<BuildIntentInput, "primaryGoal" | "groupPriorities">,
): BuildIntentInput {
  const mainPreset = getPresetById(mainPresetId);
  const presetGroupPriorities = presetDerivedGroupPriorities(mainPresetId, subPresetIds);
  const groupPriorities: Partial<Record<string, GroupPriorityState>> = { ...presetGroupPriorities };
  for (const g of PROGRESSION_GROUPS) {
    const override = manualGroupOverrides[g.groupId];
    if (override !== undefined) {
      if (override === "normal") delete groupPriorities[g.groupId];
      else groupPriorities[g.groupId] = override;
    }
  }
  const primaryGoal: PrimaryGoalId = manualPrimaryGoalOverride ?? mainPreset?.primaryGoal ?? "unspecified";

  const result = normalizeBuildIntent({
    ...manualFields,
    primaryGoal,
    groupPriorities,
  });
  return result.intent;
}

/**
 * ある groupId が「プリセットから設定」「ユーザーが変更」「未指定」のどれに当たるかを判定する
 * (設定プレビュー・分析への反映状況で、プリセット既定値とユーザー修正を区別するために使う)。
 */
export type PresetFieldSource = "preset" | "user" | "unspecified";
export function classifyGroupPrioritySource(
  groupId: string,
  currentState: GroupPriorityState,
  presetDerived: Partial<Record<string, GroupPriorityState>>,
): PresetFieldSource {
  const derived = presetDerived[groupId] ?? "normal";
  if (currentState === "normal" && derived === "normal") return "unspecified";
  return currentState === derived ? "preset" : "user";
}

// ---------------------------------------------------------------------------
// 競合検出
// ---------------------------------------------------------------------------

export interface PresetConflict {
  groupId: string;
  /** プリセット側が要求する状態("priority" | "secondary")。 */
  presetState: GroupPriorityState;
  /** 手動設定側の実際の状態。 */
  manualState: GroupPriorityState;
  manualIgnored: boolean;
}

/**
 * メイン/サブ目的が要求する優先度と、現在の詳細設定(groupPriorities・intentionallyIgnoredGroups)が
 * 逆方向を向いている場合だけを競合として検出する(単なる重複は競合ではない)。
 */
export function detectPresetConflicts(mainPresetId: string | null, subPresetIds: string[], currentIntent: BuildIntentInput): PresetConflict[] {
  const mainPreset = getPresetById(mainPresetId);
  const subPresets = subPresetIds.map((id) => getPresetById(id)).filter((p): p is BuildIntentPreset => p != null);
  const conflicts: PresetConflict[] = [];

  const requested = new Map<string, GroupPriorityState>();
  if (mainPreset) for (const g of mainPreset.priorityGroups) requested.set(g, "priority");
  if (mainPreset) for (const g of mainPreset.secondaryGroups) if (!requested.has(g)) requested.set(g, "secondary");
  for (const sub of subPresets) {
    for (const g of sub.priorityGroups) if (!requested.has(g)) requested.set(g, "secondary");
    for (const g of sub.secondaryGroups) if (!requested.has(g)) requested.set(g, "secondary");
  }

  for (const [groupId, presetState] of requested) {
    const manualState = currentIntent.groupPriorities[groupId] ?? "normal";
    const manualIgnored = currentIntent.intentionallyIgnoredGroups.includes(groupId);
    if (manualIgnored || manualState === "low") {
      conflicts.push({ groupId, presetState, manualState, manualIgnored });
    }
  }
  return conflicts;
}
