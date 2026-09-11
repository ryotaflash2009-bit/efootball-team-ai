import type { StatBreakdown } from "@/lib/progression/types";
import type { BuildRuleKind } from "@/lib/progression/build-inventory";
import type { CompatibilityStatus } from "@/lib/squad/types";

/**
 * AI ベスト11（第1段階）の言語非依存モデル。
 *
 * - 生成AI・外部AI APIは一切使用しない。決定的なルールベース選考のための純粋なデータ型のみ。
 * - ここに定義する型はエンジン層(候補構築・適格性判定・選考)とUI層を分離するためのもの。
 * - 内部ID(worldCardId・savedBuildId・reasonCode等)はエンジン内部で使用してよいが、
 *   UIコンポーネント側で ja/en の表示文言へ解決してから画面へ出す(内部値を直接表示しない)。
 * - 選考結果は一切永続化しない(呼び出し側の責務。ここでは型を定義するだけ)。
 */

/** 候補の由来。"build" = 保存ビルドを再現、"base" = 保存ビルドがなく現在確認できる能力値のみ。 */
export type BestXiCandidateSource = "build" | "base";

/** 候補の能力データが安全に利用できるかどうか(架空の値を作らないための唯一の判定材料)。 */
export type BestXiAbilityStatus = "available" | "unavailable";

/**
 * スロットへの適合度(既存の `evaluateCompatibility` が返す4区分をそのまま使う。新しい細分化はしない)。
 * - exact: 登録ポジションとスロットのポジションが一致(本職)。
 * - related: 同系統(DF/MF/FW)だが副ポジション適性は未確認(例: 登録CB→スロットLB)。
 * - unresolved: 系統も異なる、または登録ポジション自体が不明(例: 登録CB→スロットCF)。
 *   related より優先順位を下げるが、GK⇔フィールドのような確実な不適性ではないため除外はしない。
 * - excluded: GK⇔フィールドプレーヤーの不一致(既存ルールで確認できる唯一の確実な除外条件)。
 */
export type BestXiSuitabilityTier = "exact" | "related" | "unresolved" | "excluded";

export interface BestXiSuitability {
  tier: BestXiSuitabilityTier;
  compatibilityStatus: CompatibilityStatus;
}

/** 選考理由コード(最大3件・表示用辞書キーへ変換して使う。内部コードのまま画面へ出さない)。 */
export type BestXiSelectionReasonCode =
  | "exactPosition"
  | "topPositionRating"
  | "onlyEligibleCandidate"
  | "bestBuildAmongOwnBuilds"
  | "fullAbilityDataConfirmed"
  | "noSavedBuildUsesBaseStats"
  | "intentPositionMatch"
  | "optimalOverallPlacement";

/** 選外理由コード(有力な選外候補・空きスロットの説明に使う)。 */
export type BestXiExclusionReasonCode =
  | "sameCardBuildUsedElsewhere"
  | "lowerPositionRating"
  | "lowerSuitability"
  | "abilityDataUnavailable"
  | "usedInOtherRequiredSlot"
  | "noAppropriateSlotInFormation"
  | "legacyRulesLimitedComparison"
  | "positionSuitabilityUnresolved"
  | "gkFieldMismatch";

/** 1人の選手 × 1つの保存ビルド(または保存ビルドなし)を表す評価対象。 */
export interface BestXiCandidate {
  /** 候補を一意に識別する内部キー(worldCardId + buildId)。UIへ表示しない。 */
  candidateKey: string;
  worldCardId: string;
  buildId: string | null;
  buildName: string | null;
  source: BestXiCandidateSource;
  nameJa: string | null;
  nameEn: string | null;
  registeredPosition: string | null;
  ruleKind: BuildRuleKind;
  abilityStatus: BestXiAbilityStatus;
  /** 26能力値の内訳(calculateBuildの標準モード出力をそのまま使用)。取得不可なら null。 */
  stats: StatBreakdown[] | null;
  /** この候補がMy Teamのどのレコードに由来するか(表示名解決用)。 */
  ownershipStatus: string;
  /**
   * 保存済み育成目的(SavedBuild.buildIntent)の使用予定ポジション。無い/未保存/base候補ならnull。
   * 実際のポジション適性・ポジション別評価より優先しない、補助的な選考根拠としてのみ使う。
   */
  intendedPositions: string[] | null;
}

/** 候補構築の段階で除外された、または候補化できなかったMy Teamカードの理由。 */
export type BestXiCandidateBuildStatus =
  | "noWorldCardData"
  | "noAbilityData";

export interface BestXiUnavailableCard {
  worldCardId: string;
  reason: BestXiCandidateBuildStatus;
}

/** スロットへ実際に選出された候補と、選考理由。 */
export interface BestXiSelectedSlot {
  slotId: string;
  position: string;
  candidate: BestXiCandidate;
  suitability: BestXiSuitability;
  positionRating: number | null;
  reasonCodes: BestXiSelectionReasonCode[];
  alternativeCandidateCount: number;
}

/** 空きスロット(候補不足)の情報。 */
export interface BestXiUnfilledSlot {
  slotId: string;
  position: string;
  reason: "noCandidate" | "onlyIneligibleCandidates";
}

/** 有力な選外候補(スロットごとに最大2人程度・全体で最大5人程度に絞ってUIへ渡す)。 */
export interface BestXiExclusion {
  candidateKey: string;
  candidate: BestXiCandidate;
  relatedSlotId: string;
  reasonCode: BestXiExclusionReasonCode;
  /** この候補の代わりに採用された候補(あれば)。UIには表示名だけを解決して出す。 */
  selectedInsteadCandidateKey: string | null;
}

/** 1回の選考結果全体(React state・表示専用の純粋データ。永続化しない)。 */
export interface BestXiSelectionResult {
  formationId: string;
  mode: "overall";
  slots: BestXiSelectedSlot[];
  unfilledSlots: BestXiUnfilledSlot[];
  candidateCount: number;
  availableBuildCount: number;
  excludedCandidateCount: number;
  /** 満たせた必須スロット数(slots.lengthと同じ値。UI側での明示表示用)。 */
  filledRequiredSlotCount: number;
  /** 本職(exact)で配置できたスロット数。 */
  exactSelectionCount: number;
  /** 同系統(related)で配置したスロット数(必要最小限を目指す指標)。 */
  relatedSelectionCount: number;
  /** スロットごとの有力な選外候補(最大2件)+全体上位(最大5件)をまとめたもの。 */
  notableExclusions: BestXiExclusion[];
  /** 選考全体に関わる制限事項の内部コード(旧規則混在・データ不足件数など)。 */
  limitationCodes: BestXiLimitationCode[];
  unavailableCards: BestXiUnavailableCard[];
  generatedAt: string;
}

export type BestXiLimitationCode =
  | "singleFormationOnly"
  | "noBenchSelection"
  | "noManagerSelection"
  | "personIdentityUnavailable"
  | "additionalPositionAptitudeLimited"
  | "largeCandidatePoolBounded";

/**
 * 先発11人全体(1つの配置案)を比較するための決定的な辞書式タプル。
 * 重み付き合計スコアは使わない。各要素を左から順に比較し、最初に差が出た要素で優劣を決める。
 *
 * - filledRequiredSlotCount: 埋まった必須スロット数(多いほど良い)。最優先。
 * - exactSelectionCount: 本職配置数(多いほど良い)。
 * - relatedSelectionCount: 同系統配置数(少ないほど良い = 必要最小限)。
 * - positionRatingsAscending: 各スロットのポジション別推定評価を「悪い順(昇順)」に並べた配列。
 *   配列同士を先頭(=最も弱いスロット)から比較する(leximin)。1人だけ極端に高い評価があっても、
 *   他の弱いスロットを隠さないようにするための構造(1件の合計にしない)。
 * - completeAbilityDataCount: 能力データを確認できた候補の人数(多いほど良い)。
 * - intentPositionMatchCount: 保存済み使用予定ポジションと配置が一致した人数(補助的・低優先)。
 * - stableTieBreakKey: 最終的な決定的タイブレーク(スロットID→worldCardId→buildIdの固定順文字列)。
 */
export interface TeamSelectionRankTuple {
  filledRequiredSlotCount: number;
  exactSelectionCount: number;
  relatedSelectionCount: number;
  positionRatingsAscending: number[];
  completeAbilityDataCount: number;
  intentPositionMatchCount: number;
  stableTieBreakKey: string;
}
