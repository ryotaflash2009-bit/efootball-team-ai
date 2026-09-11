import type { ProgressionCard } from "./types";

/**
 * テスト用のカード固定データ（DB に依存しない）。
 * 能力値は実データ由来（eFHUB 詳細調査 / SQLite 調査の出力）。
 */

export const MESSI_BIGTIME: ProgressionCard = {
  worldCardId: "89138556575063",
  nameEn: "Lionel Messi",
  nameJa: "リオネル メッシ",
  registeredPosition: "SS",
  cardType: "BIGTIME",
  ovrBase: 90,
  ovrMax: 105,
  maximumLevel: 32,
  boost1: 90,
  boost2: 44,
  baseStats: {
    offensiveAwareness: 81, ballControl: 86, dribbling: 87, tightPossession: 86, lowPass: 82,
    loftedPass: 80, finishing: 80, heading: 49, setPieceTaking: 83, curl: 86,
    defensiveAwareness: 44, tackling: 42, aggression: 42, defensiveEngagement: 42,
    gkAwareness: 40, gkCatching: 40, gkParrying: 40, gkReflexes: 40, gkReach: 40,
    speed: 76, acceleration: 81, kickingPower: 77, jumping: 48, physicalContact: 77,
    balance: 82, stamina: 72,
  },
};

export const CANNAVARO_EPIC: ProgressionCard = {
  worldCardId: "88041460996837",
  nameEn: "Fabio Cannavaro",
  nameJa: "ファビオ カンナヴァーロ",
  registeredPosition: "CB",
  cardType: "EPIC",
  ovrBase: 88,
  ovrMax: 103,
  maximumLevel: 27,
  boost1: 36,
  boost2: 0,
  baseStats: {
    offensiveAwareness: 55, ballControl: 63, dribbling: 62, tightPossession: 63, lowPass: 70,
    loftedPass: 68, finishing: 58, heading: 70, setPieceTaking: 53, curl: 55,
    defensiveAwareness: 82, tackling: 83, aggression: 83, defensiveEngagement: 84,
    gkAwareness: 40, gkCatching: 40, gkParrying: 40, gkReflexes: 40, gkReach: 40,
    speed: 77, acceleration: 81, kickingPower: 72, jumping: 86, physicalContact: 83,
    balance: 83, stamina: 75,
  },
};

export const NEUER_GK: ProgressionCard = {
  worldCardId: "106788187832737",
  nameEn: "Manuel Neuer",
  nameJa: "マヌエル ノイアー",
  registeredPosition: "GK",
  cardType: "SHOWTIME",
  ovrBase: 88,
  ovrMax: 103,
  maximumLevel: 28,
  boost1: 63,
  boost2: 54,
  baseStats: {
    acceleration: 56, aggression: 66, balance: 57, ballControl: 62, curl: 61,
    defensiveAwareness: 62, defensiveEngagement: 64, dribbling: 64, finishing: 40,
    gkAwareness: 83, gkCatching: 80, gkParrying: 80, gkReach: 83, gkReflexes: 82,
    heading: 55, jumping: 59, kickingPower: 77, loftedPass: 77, lowPass: 74,
    offensiveAwareness: 40, physicalContact: 56, setPieceTaking: 64, speed: 59,
    stamina: 64, tackling: 60, tightPossession: 60,
  },
};

/** 最大レベル1（育成ポイントなし） */
export const LEVEL1_TRENDING: ProgressionCard = {
  worldCardId: "52902186095121",
  nameEn: "Carlos Espí",
  nameJa: "カルロス エスピ",
  registeredPosition: "CF",
  cardType: "TRENDING",
  ovrBase: 92,
  ovrMax: 94,
  maximumLevel: 1,
  boost1: 76,
  boost2: 0,
  baseStats: {
    offensiveAwareness: 90, ballControl: 88, dribbling: 85, tightPossession: 84, lowPass: 80,
    loftedPass: 78, finishing: 91, heading: 84, setPieceTaking: 70, curl: 75,
    defensiveAwareness: 45, tackling: 42, aggression: 60, defensiveEngagement: 44,
    gkAwareness: 40, gkCatching: 40, gkParrying: 40, gkReflexes: 40, gkReach: 40,
    speed: 88, acceleration: 89, kickingPower: 84, jumping: 82, physicalContact: 83,
    balance: 80, stamina: 78,
  },
};

/** 能力値が上限付近（cap テスト用） */
export const NEAR_CAP_CARD: ProgressionCard = {
  worldCardId: "17592722922839",
  nameEn: "Lionel Messi",
  nameJa: "リオネル メッシ",
  registeredPosition: "RWF",
  cardType: "ICONS",
  ovrBase: 94,
  ovrMax: 100,
  maximumLevel: 9,
  boost1: 0,
  boost2: 0,
  baseStats: {
    offensiveAwareness: 97, ballControl: 98, dribbling: 99, tightPossession: 97, lowPass: 92,
    loftedPass: 88, finishing: 94, heading: 60, setPieceTaking: 90, curl: 96,
    defensiveAwareness: 45, tackling: 40, aggression: 45, defensiveEngagement: 45,
    gkAwareness: 40, gkCatching: 40, gkParrying: 40, gkReflexes: 40, gkReach: 40,
    speed: 85, acceleration: 92, kickingPower: 82, jumping: 55, physicalContact: 65,
    balance: 96, stamina: 78,
  },
};

export const ALL_FIXTURES: ProgressionCard[] = [
  MESSI_BIGTIME,
  CANNAVARO_EPIC,
  NEUER_GK,
  LEVEL1_TRENDING,
  NEAR_CAP_CARD,
];
