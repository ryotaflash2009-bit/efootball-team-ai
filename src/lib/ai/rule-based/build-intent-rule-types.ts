import type { PrimaryGoalId } from "@/lib/progression/build-intent-analysis";

/**
 * RuleBasedBuildIntentExtractor(無料・外部通信なしのルールベース解析器)の
 * 言語別辞書が共有する型定義。
 *
 * - このファイル自体は解析ロジックを持たない(型と定数の置き場)。
 * - 能力領域の表現辞書は、必ず既存の確認済み定義(PROGRESSION_GROUPS / WORLD_STAT_DEFS の
 *   affectedStats・日本語ラベル)と矛盾しない対応関係だけを登録する
 *   (例: 「スピード」「キック力」は実際の育成領域(dexterity / lowerBodyStrength)に正しく対応させ、
 *   一般的な語感だけで別領域へ誤って割り当てない)。
 */

export interface GroupPhraseEntry {
  groupId: string;
  /** 長い表現を優先して一致させるため、内部で長さ降順に並び替えて使用する。 */
  phrases: string[];
}

/** 文脈だけでは安全に1領域へ決められない表現(例: 「フィジカル」)。 */
export interface AmbiguousPhraseEntry {
  phrase: string;
  candidateGroupIds: string[];
}

export interface GoalPhraseEntry {
  goal: PrimaryGoalId;
  phrases: string[];
}

/** 使用予定ポジションの表現(既存プロジェクトの確認済みポジションコードのみを対象とする)。 */
export interface PositionPhraseEntry {
  position: string;
  phrases: string[];
}

/** 比較表現(「AよりB」「AではなくB」「rather than」「instead of」)の方向。 */
export interface ComparativeConnector {
  marker: string;
  /** "right-preferred": マーカーの後ろ側が優先される(例: ja の「より」「ではなく」)。 */
  direction: "left-preferred" | "right-preferred";
}

export interface RuleDictionary {
  groupPhrases: GroupPhraseEntry[];
  ambiguousPhrases: AmbiguousPhraseEntry[];
  goalPhrases: GoalPhraseEntry[];
  positionPhrases: PositionPhraseEntry[];
  /** ポジション表現と組み合わさったときにだけ「使用予定ポジション」として強い根拠にする表現。 */
  usageIntentPhrases: string[];
  topPriorityPhrases: string[];
  secondaryPriorityPhrases: string[];
  normalPriorityPhrases: string[];
  lowPriorityPhrases: string[];
  /** 「重視しない」等、優先度を積極的に下げる否定表現(意図的に捨てる、とは別概念)。 */
  negativePriorityPhrases: string[];
  avoidOverinvestmentPhrases: string[];
  ignorePhrases: string[];
  preservePhrases: string[];
  /** 「AとBをバランスよく」等、balance目的の手がかり。 */
  balanceHintPhrases: string[];
  comparativeConnectors: ComparativeConnector[];
  /** 文の終端記号(1文字ずつ判定に使う。正規表現の特殊文字はここでは使わない)。 */
  sentenceEnderChars: string[];
  /** 文中でも独立した節として分割してよい接続表現(否定・比較の適用範囲を誤らせないため)。 */
  clauseConnectorPhrases: string[];
}
