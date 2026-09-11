/**
 * eFHUB 由来データのマスタ定義（Phase A 確定分）。
 *
 * 方針:
 *  - 能力値キー ↔ 英語表示名 の対応は「26キー構造の一致」と「5箇所の別名」から確定済み。
 *  - 日本語名は ./screenshots/ での確認前なので nameJa は null（推測で入れない）。
 *  - playerType（数値コード）→ カード種別名 は未確認のため一切マッピングしない。
 */

/** baseStats に現れる26個の能力値キー（RSC の実キー名） */
export const STAT_KEYS = [
  "offensiveAwareness",
  "ballControl",
  "dribbling",
  "tightPossession",
  "lowPass",
  "loftedPass",
  "finishing",
  "heading",
  "setPieceTaking",
  "curl",
  "speed",
  "acceleration",
  "kickingPower",
  "jump",
  "physicalContact",
  "balance",
  "stamina",
  "defensiveAwareness",
  "ballWinning",
  "trackingBack",
  "aggression",
  "gkAwareness",
  "gkCatching",
  "gkClearing",
  "gkReflexes",
  "gkReach",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export type StatGroup = "offense" | "physical" | "defense" | "gk";

export interface StatDefinition {
  /** RSC の実キー名 */
  statKey: StatKey;
  /** 英語表示名（利用者提供の正式名。RSC キーと異なるものは注記） */
  nameEn: string;
  /** 日本語表示名。screenshots 確認前は null（推測しない）。 */
  nameJa: string | null;
  group: StatGroup;
  /** 表示順（eFHUB 詳細画面の並びに準拠） */
  displayOrder: number;
  /** RSC キーが英語表示名と異なる場合の注記 */
  keyNote?: string;
}

export const STAT_DEFINITIONS: StatDefinition[] = [
  { statKey: "offensiveAwareness", nameEn: "Offensive Awareness", nameJa: null, group: "offense", displayOrder: 1 },
  { statKey: "ballControl", nameEn: "Ball Control", nameJa: null, group: "offense", displayOrder: 2 },
  { statKey: "dribbling", nameEn: "Dribbling", nameJa: null, group: "offense", displayOrder: 3 },
  { statKey: "tightPossession", nameEn: "Tight Possession", nameJa: null, group: "offense", displayOrder: 4 },
  { statKey: "lowPass", nameEn: "Low Pass", nameJa: null, group: "offense", displayOrder: 5 },
  { statKey: "loftedPass", nameEn: "Lofted Pass", nameJa: null, group: "offense", displayOrder: 6 },
  { statKey: "finishing", nameEn: "Finishing", nameJa: null, group: "offense", displayOrder: 7 },
  { statKey: "heading", nameEn: "Heading", nameJa: null, group: "offense", displayOrder: 8 },
  { statKey: "setPieceTaking", nameEn: "Set Piece Taking", nameJa: null, group: "offense", displayOrder: 9 },
  { statKey: "curl", nameEn: "Curl", nameJa: null, group: "offense", displayOrder: 10 },
  { statKey: "defensiveAwareness", nameEn: "Defensive Awareness", nameJa: null, group: "defense", displayOrder: 11 },
  { statKey: "ballWinning", nameEn: "Tackling", nameJa: null, group: "defense", displayOrder: 12, keyNote: "RSC key is 'ballWinning'" },
  { statKey: "trackingBack", nameEn: "Defensive Engagement", nameJa: null, group: "defense", displayOrder: 13, keyNote: "RSC key is 'trackingBack'" },
  { statKey: "aggression", nameEn: "Aggression", nameJa: null, group: "defense", displayOrder: 14 },
  { statKey: "gkAwareness", nameEn: "GK Awareness", nameJa: null, group: "gk", displayOrder: 15 },
  { statKey: "gkCatching", nameEn: "GK Catching", nameJa: null, group: "gk", displayOrder: 16 },
  { statKey: "gkClearing", nameEn: "GK Parrying", nameJa: null, group: "gk", displayOrder: 17, keyNote: "RSC key is 'gkClearing'" },
  { statKey: "gkReflexes", nameEn: "GK Reflexes", nameJa: null, group: "gk", displayOrder: 18 },
  { statKey: "gkReach", nameEn: "GK Reach", nameJa: null, group: "gk", displayOrder: 19 },
  { statKey: "speed", nameEn: "Speed", nameJa: null, group: "physical", displayOrder: 20 },
  { statKey: "acceleration", nameEn: "Acceleration", nameJa: null, group: "physical", displayOrder: 21 },
  { statKey: "kickingPower", nameEn: "Kicking Power", nameJa: null, group: "physical", displayOrder: 22 },
  { statKey: "jump", nameEn: "Jumping", nameJa: null, group: "physical", displayOrder: 23, keyNote: "RSC key is 'jump'" },
  { statKey: "physicalContact", nameEn: "Physical Contact", nameJa: null, group: "physical", displayOrder: 24 },
  { statKey: "balance", nameEn: "Balance", nameJa: null, group: "physical", displayOrder: 25 },
  { statKey: "stamina", nameEn: "Stamina", nameJa: null, group: "physical", displayOrder: 26 },
];

/** playerModel（体格）の16キー */
export const PLAYER_MODEL_KEYS = [
  "armLength",
  "shoulderWidth",
  "neckLength",
  "chestMeasurement",
  "neckSize",
  "shoulderHeight",
  "legLength",
  "thighSize",
  "waistSize",
  "armSize",
  "calfSize",
  "legCoverageRadius",
  "armCoverageRadius",
  "jumpingHeight",
  "torsoCollision",
  "dribbleHeight",
] as const;

export type PlayerModelKey = (typeof PLAYER_MODEL_KEYS)[number];

/** ポジションコード一覧（RSC の position / additionalPositions[].position で使われる文字列） */
export const POSITION_CODES = [
  "GK", "CB", "LB", "RB", "LWB", "RWB",
  "DMF", "CMF", "LMF", "RMF", "AMF",
  "LWF", "RWF", "SS", "CF",
] as const;

/**
 * playerType の数値コード。意味は未確認。
 * 観測値: 2, 4, 5, 7（対象2カード＋関連カード）。
 * 推測で名称に変換しない。UI 表示が必要になったら別途調査してこの表を埋める。
 */
export const OBSERVED_PLAYER_TYPE_CODES = [2, 4, 5, 7] as const;

/** playerType コードを「未確認コード」として文字列化するだけのヘルパー（名称は付けない） */
export function describePlayerTypeCode(code: number): string {
  return `unconfirmed-type:${code}`;
}
