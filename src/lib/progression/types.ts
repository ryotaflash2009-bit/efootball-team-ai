import type { WorldStatGroup } from "@/lib/world/types";
import type { SavedBuildIntent } from "./build-intent-persistence";

export type {
  BoosterApplicationMode,
  BoosterActivationType,
  ActivationEvidence,
} from "./booster-resolution";
export type { BoosterEvidenceLevel } from "./booster-catalog";
export type { ConditionalBoosterSelection } from "./conditional-boosters";

/** ユーザーが手動指定した条件付き付属ブースターの段階（現状 Total Package のみ）。 */
export interface SelectedConditionalBooster {
  /** BOOSTER_CATALOG のキー（"total-package"）。 */
  boosterKey: string;
  /** 段階の列挙値。 */
  selection: import("./conditional-boosters").ConditionalBoosterSelection;
}

/**
 * 育成計算の共通型。
 * 確認状態を型に持たせ、未確認の値を確定値として扱わない。
 */

export type RuleConfidence = "confirmed" | "provisional" | "unresolved";

/** confirmed = 基礎値のみ / provisional = 暫定規則を使用 / unsupported = 根拠不足で計算しない */
export type CalculationMode = "confirmed" | "provisional" | "unsupported";

export type StatSource =
  | "base"
  | "progression"
  | "player-booster"
  | "manager-booster"
  | "mixed";

/** 能力値1項目の内訳（レイヤー分離） */
export interface StatBreakdown {
  key: string;
  nameEn: string;
  group: WorldStatGroup;
  baseValue: number;
  progressionDelta: number;
  /** 現在の適用モードで通常の最終値に採用した選手ブースターぶん。 */
  playerBoosterDelta: number;
  managerBoosterDelta: number;
  otherDelta: number;
  uncappedValue: number;
  /** 現在の適用モードの最終能力値（暫定99クランプ）。 */
  finalValue: number;
  capApplied: boolean;
  source: StatSource;
  confidence: RuleConfidence;
  /** 付属ブースターのうち game_client_verified ＋ screenshot_verified（参考画面で実測確認）ぶん。 */
  gameMeasuredBoosterDelta: number;
  /** 付属ブースターのうち external_cross_verified（外部2ソース整合）ぶん。 */
  externalVerifiedBoosterDelta: number;
  /**
   * Total Package などの**ユーザー手動指定の条件付き付属ブースター**ぶん（全対象能力へ +段階値）。
   * 自動判定ではなくユーザー指定。標準最終値には含めない。
   */
  conditionalBoosterDelta: number;
  /** 手動選択ブースター（B2）ぶん。全件（確認済み+未確認）。conditionalBoosterDelta とは別。 */
  manualTrialBoosterDelta: number;
  /**
   * B2 のうち isConfirmedB2Candidate（確認済み）な分のみ。manualTrialBoosterDelta の部分集合。
   * standardFinalValue（＝通常の最終値・playerBoosterDelta）へ既に反映済み。
   */
  confirmedB2BoosterDelta: number;
  /** 試算最終値でのみ加算される分（検証中の付属 + 条件手動指定 + 未確認の手動試算）。 */
  experimentalPlayerBoosterDelta: number;
  /** 厳密モードの最終能力値（基礎 + 育成 + game_client_verified/screenshot_verified + 監督、暫定99クランプ）。常に持つ。 */
  strictFinalValue: number;
  /** 標準モードの最終能力値（厳密 + external_cross_verified + 確認済み B2）。常に持つ。条件手動指定は含まない。 */
  standardFinalValue: number;
  /**
   * 条件反映後の最終能力値（標準最終 + conditionalBoosterDelta）。常に持つ。
   * 条件未指定なら standardFinalValue と同じ。ユーザー指定であり自動判定値ではない。
   */
  conditionalFinalValue: number;
  conditionalCapApplied: boolean;
  /** 試算（実験）最終能力値（標準 + experimentalPlayerBoosterDelta）。常に持つ。ゲーム内の正式値ではない。 */
  experimentalFinalValue: number;
  experimentalCapApplied: boolean;
}

/** 能力値グループ（eFootball 育成 UI の10カテゴリ） */
export interface ProgressionGroup {
  groupId: string;
  nameEn: string;
  nameJa: string | null;
  affectedStats: string[];
  /** v2: カテゴリレベル（配分）。v1: グループ内合計配分 */
  allocatedPoints: number;
  /** 消費した育成ポイント（段階コスト込み） */
  consumedProgressionPoints: number;
  maximumAllocation: number;
  /** 次の1段階に必要なポイント（上限到達時は null） */
  nextLevelCost: number | null;
  canAddLevel: boolean;
  atMax: boolean;
  ruleVersion: string;
  /** このグループの「対象能力値」の確認状態 */
  statsConfidence: RuleConfidence;
  confirmationStatus: RuleConfidence;
}

export interface PointsSummary {
  totalPoints: number;
  usedPoints: number;
  remainingPoints: number;
  totalPointsConfidence: RuleConfidence;
  /** 追加できるか（残 > 0） */
  canAdd: boolean;
  /** 減らせるか（used > 0） */
  canReduce: boolean;
  /** 残り 0 に到達 */
  atCap: boolean;
  /** used > total（不正配分） */
  overAllocated: boolean;
  valid: boolean;
}

export interface PlayerBoosterInfo {
  slot: 1 | 2;
  /** カードに保存された数値 ID（World boost1/boost2、eFHUB boost_id）。 */
  boosterId: number;
  /** 解決できた BOOSTER_CATALOG のキー（未解決なら null）。 */
  boosterKey: string | null;
  boosterNameEn: string | null;
  boosterNameJa: string | null;
  /** 解決できたレベル（"+N" の N）。 */
  level: number | null;
  affectedStats: string[];
  /** 実際に能力値へ加算した合計（自動適用時のみ数値、それ以外は null）。 */
  delta: number | null;
  /** 対象能力ごとの候補 delta（effectStatus を問わず「もし適用したら」の値）。 */
  perStatDelta: Record<string, number>;
  condition: string | null;
  source: "world" | "efhub";
  ruleVersion: string;
  /** 名称・レベルの確認状態（eFootball World の外部ページ表示由来なら external_page_confirmed）。 */
  nameStatus: "external_page_confirmed" | "unresolved";
  /** 効果の証拠レベル。 */
  evidenceLevel:
    | "game_client_verified"
    | "screenshot_verified"
    | "external_cross_verified"
    | "effect_provisional"
    | "conditional_unverified"
    | "unresolved";
  /** 後方互換。confirmed = 現在モードで通常の最終値へ適用済み / provisional = 名称のみ / unresolved = IDのみ。 */
  confirmationStatus: RuleConfidence;
  /** 現在の適用モードで通常の最終値へ適用したか。 */
  autoApplied: boolean;
  /** 解決状況の説明（未解決の理由 or 適用可否の理由）。 */
  unresolvedReason: string | null;
  /** 発動条件の内容（判明している場合のみ）。未確認 or 条件なしなら null。 */
  conditionText?: string | null;
  /** 発動条件を現在のアプリデータで評価できるか（条件なし or 評価可能なら true）。 */
  conditionEvaluable?: boolean;
  /** 発動方式。"power_of_many" = 金色・Game Plan 依存・自動適用しない・ユーザー段階指定のみ。 */
  activationType?: import("./booster-resolution").BoosterActivationType;
  /** 発動方式の証拠レベル（効果の evidenceLevel とは別軸）。"provisional" = 固定と推定。 */
  activationEvidence?: import("./booster-resolution").ActivationEvidence;
  /** 発動方式が確実に確認できているか（false = 推定）。 */
  activationConfirmed?: boolean;
  /** この付属ブースターがユーザー段階指定の対象か（＝ activationType === "power_of_many"）。 */
  manualConditional?: boolean;
  /** ユーザーが手動指定した段階（manualConditional のときのみ）。未指定は "none"。 */
  conditionSelection?: import("./conditional-boosters").ConditionalBoosterSelection;
  /** conditionSelection に対応するレベル（0..3・manualConditional のときのみ）。 */
  conditionLevel?: number;
}

/** ユーザーが手動指定した選手ブースター（選択式／検証用）。 */
export interface SelectedPlayerBooster {
  slot: 1 | 2;
  /** BOOSTER_CATALOG のキー */
  boosterKey: string;
  level: number;
}

export interface AppliedPlayerBooster extends SelectedPlayerBooster {
  nameEn: string;
  affectedStats: string[];
  /** 実際に能力値へ加算したか（confirmed は常に true、provisional は applyProvisional 次第） */
  applied: boolean;
  confirmationStatus: RuleConfidence;
  conditional: boolean;
}

/** 監督ブースターの1効果 */
export interface ManagerBoosterEffectInput {
  statKey: string | null;
  statNameEn: string;
  delta: number;
  confirmationStatus: RuleConfidence;
}

/** 監督補正の入力。calculate-manager-booster.ts が deltas を組み立てる。 */
export interface ManagerContext {
  internalManagerId: number | null;
  sourceManagerId: string | null;
  managerName: string | null;
  boosterEffects: ManagerBoosterEffectInput[];
  tacticalProficiencies: Record<string, number | null> | null;
  applicationCondition: string | null;
  ruleVersion: string;
  /** 全体の確認状態（すべての効果が confirmed なら confirmed） */
  confirmationStatus: RuleConfidence;
}

/** 監督補正の理由（能力値ごと） */
export interface ManagerBoosterReason {
  statKey: string;
  statNameEn: string;
  delta: number;
  managerName: string | null;
}

/** カードの固定情報（育成計算の入力） */
export interface ProgressionCard {
  worldCardId: string;
  nameEn: string | null;
  nameJa: string | null;
  registeredPosition: string | null;
  cardType: string | null;
  ovrBase: number | null;
  ovrMax: number | null;
  maximumLevel: number | null;
  /** 26 キーの基礎能力値 */
  baseStats: Record<string, number>;
  boost1: number | null;
  boost2: number | null;
}

export interface ProgressionInput {
  card: ProgressionCard;
  /** v2: グループID → カテゴリレベル。v1 の per-stat 形式が来たら engine が移行する。 */
  allocation: Record<string, number>;
  /** ユーザーが手動指定した選手ブースター（試算・実験機能）。常に「試算のみ」扱い。 */
  selectedPlayerBoosters?: SelectedPlayerBooster[];
  /**
   * ユーザーが手動指定した条件付き付属ブースターの段階（Total Package）。
   * 標準最終値には影響せず、conditionalFinalValue にのみ反映。自動判定ではない。
   */
  selectedConditionalBoosters?: SelectedConditionalBooster[];
  /**
   * ブースター適用モード。既定 "standard"。
   *  - strict   : game_client_verified ＋ screenshot_verified のみ通常の最終値へ
   *  - standard : 上記 + external_cross_verified を通常の最終値へ（既定）
   *  - experimental : standard と同じ通常値 ＋ 試算最終値に provisional / conditional / 手動試算を別表示
   */
  boosterApplicationMode?: import("./booster-resolution").BoosterApplicationMode;
  /** @deprecated `boosterApplicationMode: "experimental"` を使う。互換のため受け付ける。 */
  experimentalModeEnabled?: boolean;
  /** @deprecated 同上。 */
  applyProvisionalBoosters?: boolean;
  manager?: ManagerContext | null;
  /** 明示的なルールセット/バージョン。省略時は v2。 */
  rulesetId?: string;
}

/** 育成可否 */
export interface EligibilityInfo {
  canProgress: boolean;
  reason: string | null;
  confirmationStatus: "confirmed";
}

export interface RatingResult {
  estimatedOvr: number | null;
  confidence: RuleConfidence;
  method: string;
  note: string;
  storedOvrBase: number | null;
  storedOvrMax: number | null;
}

export interface ProgressionResult {
  rulesVersion: string;
  rulesetId: string;
  /** 入力ビルドが作られた規則バージョン（レガシー判定用） */
  inputRulesVersion: string;
  isLegacyInput: boolean;
  eligibility: EligibilityInfo;
  calculationMode: CalculationMode;
  card: {
    worldCardId: string;
    nameEn: string | null;
    nameJa: string | null;
    registeredPosition: string | null;
    cardType: string | null;
    ovrBase: number | null;
    ovrMax: number | null;
    maximumLevel: number | null;
  };
  points: PointsSummary;
  groups: ProgressionGroup[];
  stats: StatBreakdown[];
  /** 能力値上限のレイヤー別確認状態 */
  statCaps: {
    base: { value: number; confidence: RuleConfidence };
    progression: { value: number; confidence: RuleConfidence };
    playerBooster: { value: number; confidence: RuleConfidence };
    managerBooster: { value: number; confidence: RuleConfidence };
    final: { value: number; confidence: RuleConfidence };
  };
  /** 暫定99クランプが最終値に適用されたか */
  finalCapApplied: boolean;
  playerBoosters: PlayerBoosterInfo[];
  playerBoosterSelection: {
    applied: AppliedPlayerBooster[];
    note: string;
    anyProvisional: boolean;
  };
  /** カード付属ブースターの解決・自動適用サマリ。 */
  playerBoosterAttached: {
    autoAppliedKeys: string[];
    resolvedNames: string[];
    note: string;
  };
  /** 能力値ごとの選手ブースター内訳（証拠レベル別 / 条件手動指定 / 手動試算）。 */
  playerBoosterByStat: Record<
    string,
    {
      gameMeasured: number;
      externalVerified: number;
      /** Total Package などのユーザー手動指定の条件付き付属ぶん。 */
      conditional: number;
      /** 手動選択ブースター（B2）ぶん。全件（確認済み+未確認）。 */
      manualTrial: number;
      /** B2 のうち確認済み分のみ（manualTrial の部分集合）。standardFinalValue へ反映済み。 */
      confirmedB2: number;
      experimentalExtra: number;
    }
  >;
  /** ブースター適用モードと各段階の合計・証拠サマリ。 */
  booster: {
    applicationMode: import("./booster-resolution").BoosterApplicationMode;
    /** 現在モードで通常の最終値へ採用したブースター合計。 */
    appliedTotal: number;
    gameMeasuredTotal: number;
    externalVerifiedTotal: number;
    /** 試算最終値でのみ乗る合計（検証中の付属 + 条件手動指定 + 手動試算）。 */
    experimentalExtraTotal: number;
    /** ユーザー手動指定の条件付き付属ブースターの合計（全能力ぶん）。 */
    conditionalTotal: number;
    /** 確認済み B2（isConfirmedB2Candidate）の合計（全能力ぶん）。standardFinalValue へ反映済み。 */
    confirmedB2Total: number;
    /** 確認済み B2 を1件以上選択しているか。 */
    hasConfirmedB2: boolean;
    hasManualTrial: boolean;
    hasProvisionalAttached: boolean;
    /** カードに条件付き付属ブースター（Total Package）が付いている。 */
    hasConditionalAttached: boolean;
    /** ユーザーが条件段階を手動指定している（"none" 以外）。 */
    hasConditionalSelection: boolean;
    hasExperimentalExtra: boolean;
    /** ユーザーが手動指定した条件段階の一覧。 */
    conditionalSelections: {
      boosterKey: string;
      nameEn: string;
      nameJa: string | null;
      selection: import("./conditional-boosters").ConditionalBoosterSelection;
      level: number;
      description: string;
    }[];
    /** 条件手動指定機能の規則バージョン。 */
    conditionalRulesVersion: string;
    evidenceSummary: {
      gameMeasured: string[];
      externalCrossVerified: string[];
      provisional: string[];
      conditional: string[];
      unresolvedIds: number[];
    };
    note: string;
    warnings: string[];
  };
  manager: {
    applied: boolean;
    note: string;
    managerName: string | null;
    reasons: ManagerBoosterReason[];
  };
  rating: RatingResult;
  confirmedRules: string[];
  provisionalRules: string[];
  unresolvedRules: string[];
  warnings: string[];
}

export type AutoAllocateProfile = "attack" | "defense" | "balance" | "gk";

export interface SavedBuild {
  buildId: string;
  worldCardId: string;
  buildName: string;
  /** v2 では groupId→level。v1 では statKey→points（後方互換）。rulesVersion で解釈が決まる。 */
  progressionAllocation: Record<string, number>;
  selectedPlayerBooster: number | null;
  /**
   * ユーザーが手動指定した条件付き付属ブースターの段階（Total Package）。
   * 省略・不正は「未指定」。後方互換のため optional。
   */
  conditionalBoosterSelections?: SelectedConditionalBooster[];
  calculatedStats: Record<string, number>;
  calculatedOvr: number | null;
  calculationMode: CalculationMode;
  rulesVersion: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  /**
   * ユーザーが明示的に保存した確定済み育成目的（Build Analysis）。
   * 旧保存ビルドには存在しない（後方互換のため optional）。存在しない間は「目的未設定」として扱う。
   * 表示文章・自由記述・診断結果・通常/辛口モードは含まない（分析を再現するための入力のみ）。
   */
  buildIntent?: SavedBuildIntent;
}

/** 旧ビルドを新規則へ移行した結果 */
export interface BuildMigration {
  fromVersion: string;
  toVersion: string;
  /** バージョン名の修正だけ（配分の再計算は不要） */
  nameOnlyChange: boolean;
  /** 新規則での配分（groupId→level） */
  migratedAllocation: Record<string, number>;
  changed: boolean;
  notes: string[];
}
