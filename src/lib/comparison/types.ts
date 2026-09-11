import type { AutoAllocateProfile, ManagerContext, ProgressionCard, ProgressionResult, SelectedConditionalBooster, SelectedPlayerBooster, StatBreakdown } from "@/lib/progression/types";

/** 比較の最大人数 */
export const COMPARISON_MIN = 2;
export const COMPARISON_MAX = 4;

/** 育成方針（比較用） */
export type CompareBuildMode = "none" | AutoAllocateProfile;

/** 1選手の比較入力 */
export interface ComparisonPlayerInput {
  /** 選手の固定情報（育成エンジン入力） */
  card: ProgressionCard;
  /** 表示用の追加情報 */
  display: {
    worldCardId: string;
    nameEn: string | null;
    nameJa: string | null;
    cardType: string | null;
    registeredPosition: string | null;
    playingStyle: string | null;
    playingStyleDefensive: string | null;
    nationality: string | null;
    region: string | null;
    league: string | null;
    team: string | null;
    age: number | null;
    height: number | null;
    weight: number | null;
    preferredFoot: string | null;
    ovrBase: number | null;
    ovrMax: number | null;
    maximumLevel: number | null;
    hasEfhubLink: boolean;
    efhubCardId: string | null;
    imageUrlCandidate: string | null;
    mobileImageUrlCandidate: string | null;
    playerSkills: string[];
    aiStyles: string[];
  };
  /** 育成: 方針（none 以外なら auto-allocate）。savedAllocation があればそちらを優先。 */
  buildMode: CompareBuildMode;
  /** 保存済みビルド等の明示的な配分（groupId→level）。あれば buildMode より優先。 */
  savedAllocation?: Record<string, number> | null;
  savedBuildName?: string | null;
  /** 監督（なければ null） */
  manager: ManagerContext | null;
  /** 手動指定した選手ブースター（試算・カード固有・別カードへは適用しない・常に experimental 扱い） */
  selectedPlayerBoosters?: SelectedPlayerBooster[];
  /**
   * 手動指定した Total Package の条件段階（カード固有）。
   * 通常の比較順位には含めない。「ユーザー指定条件を含む比較」を明示したときだけ conditionalFinalValue を使う。
   */
  selectedConditionalBoosters?: SelectedConditionalBooster[];
  /** ブースター適用モード。既定 "standard"。 */
  boosterApplicationMode?: import("@/lib/progression/booster-resolution").BoosterApplicationMode;
  /** @deprecated `boosterApplicationMode: "experimental"` を使う。 */
  experimentalModeEnabled?: boolean;
  /** @deprecated 同上。 */
  applyProvisionalBoosters?: boolean;
}

export interface StatComparisonRow {
  key: string;
  nameEn: string;
  group: string;
  /** 各選手のブレークダウン（players と同順） */
  perPlayer: StatBreakdown[];
  /** 最終値の最大・最小（複数該当あり得る） */
  highestPlayerIdx: number[];
  lowestPlayerIdx: number[];
  /** 最大 − 最小（最終値） */
  spread: number;
}

export interface SkillComparison {
  /** 全員が持つ */
  shared: string[];
  /** 一部だけが持つ（skill → 持っている選手 index） */
  partial: { skill: string; playerIdx: number[] }[];
  /** 各選手固有（誰も持っていない others） */
  uniqueByPlayer: string[][];
  /** 各選手のスキル数 */
  countByPlayer: number[];
}

export interface CategoryComparison {
  category: string;
  /** COMPARE_CATEGORIES の id（表示側の翻訳用。category 自体は既存の日本語ラベルのまま）。 */
  categoryId: string;
  /** 各選手の最終値合計（単純合計・公式評価ではない） */
  totalByPlayer: number[];
  /** 各選手の最終値平均（単純平均） */
  avgByPlayer: number[];
  /** 最大合計 − 最小合計 */
  spread: number;
}

export interface ComparisonResult {
  players: {
    input: ComparisonPlayerInput;
    result: ProgressionResult;
  }[];
  basicInfo: { label: string; perPlayer: (string | number | null)[] }[];
  stats: StatComparisonRow[];
  playerSkills: SkillComparison;
  aiStyles: SkillComparison;
  categories: CategoryComparison[];
  /** 総合（単純合計の最終値・公式評価ではない） */
  totalStatByPlayer: number[];
  /** ポジション一致（全員同じ登録ポジションか） */
  positionMatch: boolean;
  /** 推定OVR（各選手・provisional） */
  estimatedOvrByPlayer: (number | null)[];
  /** いずれかの選手に Total Package の条件段階が手動指定されている。 */
  hasAnyConditionalSelection: boolean;
  warnings: string[];
  rulesVersion: string;
}

/** 比較状態（URL / sessionStorage 用） */
export interface ComparisonState {
  ids: string[];
  buildModes: CompareBuildMode[];
  managerIds: (number | null)[];
  /** Total Package の条件段階（ids と同順・未指定は "none"）。省略時は全 "none" 扱い。 */
  conditionalTiers?: import("@/lib/progression/conditional-boosters").ConditionalBoosterSelection[];
  /**
   * 手動育成配分（ids と同順・null = 配分なし＝方針に従う）。省略時は全 null 扱い。
   * groupId→categoryLevel。復元時にカードごとに再検証・再クランプする。
   */
  allocations?: (Record<string, number> | null)[];
}
