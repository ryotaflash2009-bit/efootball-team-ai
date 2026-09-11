import type {
  ManagerContext,
  ProgressionCard,
  ProgressionResult,
  SelectedConditionalBooster,
  SelectedPlayerBooster,
} from "@/lib/progression/types";
import type { BuildMode } from "@/lib/progression/resolve-allocation";

/** 先発人数（固定） */
export const STARTING_SIZE = 11;
/** ベンチ（サブ）最大人数 */
export const MAX_SUBSTITUTES = 12;
/** スカッド名の長さ制限 */
export const SQUAD_NAME_MIN = 1;
export const SQUAD_NAME_MAX = 50;
/** 保存スキーマ・ストレージキー */
export const SQUAD_SCHEMA_VERSION = 1;
export const SQUAD_STORAGE_KEY = "efb:squads:v1";
/** 自由配置座標の規則バージョン（座標の意味づけ）。 */
export const SQUAD_COORDINATE_VERSION = "squad-positioning/2026-08-30.v1";
/** テンプレートのストレージ。 */
export const SQUAD_TEMPLATE_STORAGE_KEY = "efootball-team-ai:squad-templates:v1";
export const SQUAD_TEMPLATE_STORAGE_VERSION = "squad-templates-storage/2026-08-30.v1";
export const MAX_SQUAD_TEMPLATES = 50;
/** 1ユーザーが保存できるスカッド数の上限（暴走防止） */
export const MAX_SQUADS = 50;

export const SQUAD_ID_RE = /^sq_[A-Za-z0-9]{6,32}$/;
export const SLOT_ID_RE = /^[a-z0-9_-]{1,32}$/;
export const SUB_ID_RE = /^sub_[A-Za-z0-9]{4,32}$/;
export const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;
export const BUILD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type SquadBuildMode = BuildMode;
export const SQUAD_BUILD_MODES: SquadBuildMode[] = ["none", "attack", "defense", "balance", "gk"];

export type SlotRole = "GK" | "DF" | "MF" | "FW";

/** フォーメーションのスロット定義（データ駆動・座標は 0-100、y は上=攻撃） */
export interface FormationSlot {
  slotId: string;
  position: string;
  x: number;
  y: number;
  role: SlotRole;
  line: number;
  displayOrder: number;
}

export interface FormationDef {
  id: string;
  name: string;
  slots: FormationSlot[];
}

// ---- 永続化（localStorage） ----

export interface StoredSlot {
  slotId: string;
  worldCardId: string | null;
  buildMode: SquadBuildMode;
  savedBuildId: string | null;
  /** 手動指定した選手ブースター（このカード固有） */
  boosters?: SelectedPlayerBooster[];
  /** Total Package 等の条件付き付属ブースターのユーザー手動指定（このカード固有） */
  conditionalBoosters?: SelectedConditionalBooster[];
  /** 自由配置の座標（ピッチ幅・高さに対する百分率 0–100・y=0 が前線）。未設定なら formation 既定座標。 */
  x?: number;
  y?: number;
  /** 配置ロールの手動上書き（内部ポジションコード）。null / 未設定なら座標から自動判定。 */
  roleOverride?: string | null;
}

export interface StoredSub {
  subId: string;
  worldCardId: string;
  buildMode: SquadBuildMode;
  savedBuildId: string | null;
  boosters?: SelectedPlayerBooster[];
  conditionalBoosters?: SelectedConditionalBooster[];
}

/** スカッド全体の条件付きブースター設定（将来の Game Plan 自動対応の器・現状は manual のみ）。 */
export interface ConditionalSquadSettings {
  /** 補助入力: 対象リーグ名（任意・自動照合しない） */
  targetLeague: string | null;
  /** 補助入力: 登録人数（任意・自動照合しない） */
  registeredPlayerCount: number | null;
  /** 補助入力: 段階 */
  conditionTier: "none" | "league_1_13" | "league_14_19" | "league_20_plus";
  /** manual = ユーザー指定のみ / automatic = 未実装 / unsupported = 評価不能 */
  evaluationMode: "manual" | "automatic" | "unsupported";
}

export interface StoredSetPieces {
  corners: string | null;
  freeKicks: string | null;
  penalties: string | null;
}

export interface StoredLinkUp {
  centerPieceSlotId: string | null;
  keyManSlotId: string | null;
}

export interface StoredSquad {
  squadId: string;
  squadName: string;
  formationId: string;
  managerId: number | null;
  slots: StoredSlot[];
  substitutes: StoredSub[];
  captainSlotId: string | null;
  setPieces: StoredSetPieces;
  linkUp: StoredLinkUp;
  /** スカッド全体の条件付きブースター設定（省略可・将来の Game Plan 自動対応の器） */
  conditionalSettings?: ConditionalSquadSettings;
  /** 自由配置座標の規則バージョン（未設定 = 旧データ・formation 既定座標から補完） */
  coordinateVersion?: string;
  rulesVersion: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

// ---- 実行時の計算結果 ----

export type CompatibilityStatus = "exact" | "related" | "unresolved" | "gkMismatch" | "empty";

export interface CompatibilityInfo {
  status: CompatibilityStatus;
  /** 登録ポジション */
  registeredPosition: string | null;
  /** 配置ポジション */
  assignedPosition: string;
  label: string;
  note: string | null;
}

/** 表示用の選手情報（World 由来） */
export interface SquadPlayerDisplay {
  worldCardId: string;
  nameEn: string | null;
  nameJa: string | null;
  cardType: string | null;
  registeredPosition: string | null;
  playingStyle: string | null;
  playingStyleDefensive: string | null;
  ovrBase: number | null;
  ovrMax: number | null;
  maximumLevel: number | null;
  hasEfhubLink: boolean;
  efhubCardId: string | null;
  imageUrlCandidate: string | null;
  mobileImageUrlCandidate: string | null;
  playerSkills: string[];
  aiStyles: string[];
}

/** buildSquad に渡す1選手ぶんの入力 */
export interface SquadEntryInput {
  card: ProgressionCard;
  display: SquadPlayerDisplay;
  buildMode: SquadBuildMode;
  savedAllocation: Record<string, number> | null;
  savedBuildName: string | null;
  savedBuildRulesVersion: string | null;
  selectedPlayerBoosters?: SelectedPlayerBooster[];
  /** Total Package 等の条件付き付属ブースターのユーザー手動指定（このカード固有） */
  selectedConditionalBoosters?: SelectedConditionalBooster[];
}

export interface SquadSlotResult {
  slotId: string;
  position: string;
  role: SlotRole;
  x: number;
  y: number;
  isCaptain: boolean;
  /** 選手が未配置なら null */
  entry: {
    display: SquadPlayerDisplay;
    buildMode: SquadBuildMode;
    savedBuildName: string | null;
    selectedPlayerBoosters: SelectedPlayerBooster[];
    /** Total Package のユーザー手動指定（このカード固有） */
    selectedConditionalBoosters: SelectedConditionalBooster[];
    result: ProgressionResult;
    baseOvr: number | null;
    displayedOvr: number | null;
    progressionDelta: number;
    playerBoosterDelta: number;
    managerBoosterDelta: number;
    /** 条件手動指定ぶんの合計（全能力・標準集計には含めない） */
    conditionalDelta: number;
    /** 条件反映後値ベースの推定OVR（ユーザー指定・自動判定ではない） */
    conditionalDisplayedOvr: number | null;
    hasConditionalSelection: boolean;
    eligibilityStatus: "confirmed";
    canProgress: boolean;
    warnings: string[];
    /** 保存ビルドが古い規則で作られている */
    staleBuild: boolean;
  } | null;
  compatibility: CompatibilityInfo;
}

export interface SquadSubResult {
  subId: string;
  display: SquadPlayerDisplay;
  buildMode: SquadBuildMode;
  savedBuildName: string | null;
  result: ProgressionResult;
  baseOvr: number | null;
  displayedOvr: number | null;
  progressionDelta: number;
  playerBoosterDelta: number;
  managerBoosterDelta: number;
  staleBuild: boolean;
}

export interface CategoryAverage {
  category: string;
  /** COMPARE_CATEGORIES の id（表示側の翻訳用。category 自体は既存の日本語ラベルのまま）。 */
  categoryId: string;
  avg: number;
  sum: number;
}

export interface TeamSummary {
  startingCount: number;
  benchCount: number;
  /** ポジション（配置）ごとの人数 */
  positionBreakdown: { position: string; count: number }[];
  /** role ごとの人数（GK/DF/MF/FW） */
  roleBreakdown: { role: SlotRole; count: number }[];
  avgBaseOvr: number | null;
  avgDisplayedOvr: number | null;
  categoryAverages: CategoryAverage[];
  /** 先発全員が持つスキル数 */
  sharedSkillCount: number;
  sharedSkills: string[];
  managerBoostedCount: number;
  unresolvedCompatibilityCount: number;
  gkMismatchCount: number;
  warningCount: number;
}

export type LinkUpStatus = "met" | "partial" | "unmet" | "indeterminate";

export interface LinkUpRoleEval {
  role: "centerPiece" | "keyMan";
  playingStyle: string | null;
  positions: string[];
  /** 条件を満たす先発スロット */
  matchingSlotIds: string[];
  /** ユーザーが手動選択したスロット（満たしているか） */
  selectedSlotId: string | null;
  selectedSatisfies: boolean;
  hasCondition: boolean;
}

export interface LinkUpEvaluation {
  name: string;
  status: LinkUpStatus;
  confirmationStatus: "confirmed" | "provisional" | "unresolved";
  centerPiece: LinkUpRoleEval;
  keyMan: LinkUpRoleEval;
}

export interface SquadComputed {
  formation: FormationDef;
  slots: SquadSlotResult[];
  substitutes: SquadSubResult[];
  manager: {
    context: ManagerContext | null;
    applied: boolean;
    note: string;
  };
  teamSummary: TeamSummary;
  /**
   * 条件反映後値（Total Package のユーザー手動指定を含む）ベースのチームサマリー。
   * 誰も条件段階を指定していなければ null。「手動指定による試算」として、ユーザーが明示的に開いた場合のみ表示する。
   */
  conditionalTeamSummary: TeamSummary | null;
  hasAnyConditionalSelection: boolean;
  linkUps: LinkUpEvaluation[];
  linkUpNotice: string;
  warnings: string[];
  rulesVersion: string;
  /** 保存時の rulesVersion（あれば）と現行が異なる */
  rulesOutdated: boolean;
}

export interface SquadListEntry {
  squadId: string;
  squadName: string;
  formationId: string;
  formationName: string;
  managerId: number | null;
  startingCount: number;
  benchCount: number;
  updatedAt: string;
  createdAt: string;
  rulesOutdated: boolean;
  hasCustomPositioning: boolean;
}
