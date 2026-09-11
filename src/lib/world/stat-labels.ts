import { getStatDef } from "./stats";

/**
 * ユーザー向けの日本語・カタカナ表示ラベル（表示専用・単一の真実源）。
 *
 *  - **内部 stat key / groupId / カテゴリ ID は一切変更しない。** ここは表示ラベルだけを返す。
 *  - 静的な定数 + 純関数。SQLite / 外部 API / 翻訳サービスは使わない。
 *  - 選手詳細・比較コックピット・近接プレビュー・26 能力値表・レーダー代替表で同じ名前を返す。
 *  - eFootball の用語（KONAMI 公式表記）に合わせる。未確認の項目は保守的な候補を使う。
 */

/** 26 能力値の日本語ラベル（key → 表示名）。 */
export const STAT_LABEL_JA: Record<string, string> = {
  offensiveAwareness: "オフェンスセンス",
  ballControl: "ボールコントロール",
  dribbling: "ドリブル",
  tightPossession: "ボールキープ",
  lowPass: "グラウンダーパス",
  loftedPass: "フライパス",
  finishing: "決定力",
  heading: "ヘディング",
  setPieceTaking: "プレースキック",
  curl: "カーブ",
  defensiveAwareness: "ディフェンスセンス",
  tackling: "ボール奪取",
  aggression: "アグレッシブネス",
  defensiveEngagement: "守備意識",
  gkAwareness: "GKセンス",
  gkCatching: "キャッチング",
  gkParrying: "クリアリング",
  gkReflexes: "コラプシング",
  gkReach: "ディフレクティング",
  speed: "スピード",
  acceleration: "瞬発力",
  kickingPower: "キック力",
  jumping: "ジャンプ",
  physicalContact: "フィジカルコンタクト",
  balance: "ボディコントロール",
  stamina: "スタミナ",
};

/** 能力値の表示名（日本語 → 無ければ英語 → key）。 */
export function statLabelJa(key: string): string {
  return STAT_LABEL_JA[key] ?? getStatDef(key)?.nameEn ?? key;
}

/** 育成カテゴリ（groupId → 表示名）。内部 groupId は英語のまま。 */
export const GROUP_LABEL_JA: Record<string, string> = {
  shooting: "シュート",
  passing: "パス",
  dribbling: "ドリブル",
  dexterity: "クイックネス",
  lowerBodyStrength: "脚力",
  aerialStrength: "エアバトル",
  defending: "ディフェンス",
  goalkeeping1: "GK1",
  goalkeeping2: "GK2",
  goalkeeping3: "GK3",
};

export function groupLabelJa(groupId: string): string {
  return GROUP_LABEL_JA[groupId] ?? groupId;
}

/** レーダー軸（COMPARE_CATEGORIES の id → 短い日本語）。内部 ID は変更しない。 */
export const RADAR_AXIS_LABEL_JA: Record<string, string> = {
  attack: "シュート",
  pass: "パス",
  dribble: "ドリブル",
  defense: "ディフェンス",
  physical: "フィジカル",
  speed: "スピード",
  gk: "GK",
};

export function radarAxisLabelJa(categoryId: string): string {
  return RADAR_AXIS_LABEL_JA[categoryId] ?? categoryId;
}

/** 育成方針（buildMode）。 */
export const BUILD_MODE_LABEL_JA: Record<string, string> = {
  none: "育成なし",
  attack: "攻撃重視",
  defense: "守備重視",
  balance: "バランス重視",
  gk: "GK重視",
};

export function buildModeLabelJa(mode: string): string {
  return BUILD_MODE_LABEL_JA[mode] ?? mode;
}

/** 対象能力の一覧を「/」で連結（スライダー・プレビューの「対象: …」表示用）。 */
export function statListJa(keys: readonly string[]): string {
  return keys.map((k) => statLabelJa(k)).join(" / ");
}
