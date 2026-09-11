import type { RuleConfidence } from "@/lib/progression/types";

/** 監督の戦術適性6項目 */
export interface TacticalProficiencies {
  possessionGame: number | null;
  quickCounter: number | null;
  longBallCounter: number | null;
  outWide: number | null;
  longBall: number | null;
  overload: number | null;
}

/** 監督ブースターの1効果 */
export interface ManagerBoosterEffect {
  statNameEn: string;
  /** World キー（変換不能なら null → 適用しない） */
  statKey: string | null;
  delta: number;
  rawValue: string;
  applicationCondition: string | null;
  confirmationStatus: RuleConfidence;
}

export interface LinkUpCondition {
  role: "centerPiece" | "keyMan";
  playingStyle: string | null;
  positions: string[];
}
export interface LinkUpPlay {
  name: string;
  centerPiece: LinkUpCondition | null;
  keyMan: LinkUpCondition | null;
  confirmationStatus: RuleConfidence;
}

/** 監督一覧の行 */
export interface ManagerListItem {
  internalManagerId: number;
  source: string;
  sourceManagerId: string;
  nameEn: string;
  nameJa: string | null;
  teamName: string | null;
  nationality: string | null;
  age: number | null;
  releasedAt: string | null;
  proficiencies: TacticalProficiencies;
  managerRating: string | null;
  coachingAffinity: string | null;
  formation: string | null;
  hasBooster: boolean;
  hasLinkUpPlay: boolean;
  boosterConfirmation: RuleConfidence;
  /** 一覧向けの要約（対象能力名） */
  boosterSummary: string[];
}

export interface ManagerDetail extends ManagerListItem {
  boosters: ManagerBoosterEffect[];
  linkUpPlays: LinkUpPlay[];
  sourceUrl: string;
  fetchedAt: string | null;
}

export interface ManagerListQuery {
  page: number;
  pageSize: number;
  query: string;
  sort: ManagerSortKey;
  hasBooster: boolean | null;
  hasLinkUpPlay: boolean | null;
}

export type ManagerSortKey =
  | "name"
  | "released_desc"
  | "released_asc"
  | "possession_desc"
  | "quick_counter_desc"
  | "long_ball_counter_desc"
  | "out_wide_desc"
  | "long_ball_desc"
  | "overload_desc";

export interface ManagerListResult {
  managers: ManagerListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  source: string;
}
