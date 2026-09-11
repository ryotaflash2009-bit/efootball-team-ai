import type { RuleDictionary } from "./build-intent-rule-types";

/**
 * RuleBasedBuildIntentExtractor の日本語表現辞書。
 *
 * 能力領域の対応関係は、既存の確認済み定義(src/lib/progression/stat-groups.ts の affectedStats、
 * src/lib/world/stat-labels.ts の日本語ラベル)を正本として使用する。
 * 具体的には以下を確認済みの事実として扱う:
 * - dexterity(クイックネス) の affectedStats は speed(スピード) / acceleration(瞬発力)。
 * - lowerBodyStrength(脚力) の affectedStats は kickingPower(キック力) / balance(ボディコントロール) / stamina(スタミナ)。
 * これにより、「スピード」は dexterity、「キック力」は lowerBodyStrength の表現として登録する
 * (俗に「脚の速さ=脚力」という語感はあるが、本プロジェクトの確認済み定義とは対応しないため採用しない)。
 */

export const BUILD_INTENT_RULE_DICTIONARY_JA: RuleDictionary = {
  groupPhrases: [
    { groupId: "shooting", phrases: ["シュート", "決定力", "得点力", "フィニッシュ", "ゴール数", "セットプレー", "プレースキック", "カーブ"] },
    { groupId: "passing", phrases: ["パス", "ラストパス", "チャンスメイク", "スルーパス", "クロス", "配球", "組み立て", "グラウンダーパス", "フライパス", "オフェンスセンス"] },
    { groupId: "dribbling", phrases: ["ドリブル突破", "ドリブル", "ボール保持", "足元の技術", "ボールコントロール", "1人を剥がす", "突破力", "ボールキープ"] },
    { groupId: "dexterity", phrases: ["クイックネス", "瞬発力", "敏捷性", "小回り", "初速", "スピード", "加速力", "加速"] },
    { groupId: "lowerBodyStrength", phrases: ["脚力", "キック力", "スタミナ", "下半身", "ボディコントロール", "体のバランス"] },
    { groupId: "aerialStrength", phrases: ["エアバトル", "空中戦", "ヘディング", "ジャンプ力", "ジャンプ", "競り合い", "フィジカルコンタクト"] },
    { groupId: "defending", phrases: ["ディフェンス", "守備意識", "守備", "ボール奪取", "アグレッシブネス", "対人守備"] },
    { groupId: "goalkeeping1", phrases: ["GK1", "GKセンス", "コラプシング"] },
    { groupId: "goalkeeping2", phrases: ["GK2", "キャッチング", "クリアリング"] },
    { groupId: "goalkeeping3", phrases: ["GK3", "ディフレクティング"] },
  ],
  ambiguousPhrases: [
    { phrase: "フィジカル", candidateGroupIds: ["aerialStrength", "lowerBodyStrength"] },
    { phrase: "走力", candidateGroupIds: ["dexterity", "lowerBodyStrength"] },
    { phrase: "GK能力", candidateGroupIds: ["goalkeeping1", "goalkeeping2", "goalkeeping3"] },
    { phrase: "ゴールキーパー能力", candidateGroupIds: ["goalkeeping1", "goalkeeping2", "goalkeeping3"] },
  ],
  goalPhrases: [
    { goal: "scoring", phrases: ["点を取りたい", "ゴールを増やしたい", "得点特化", "フィニッシャー", "得点力を重視", "決定力を重視"] },
    { goal: "dribbling", phrases: ["ドリブル特化", "ドリブル突破", "1人を剥がす", "サイド突破", "突破力"] },
    { goal: "passing", phrases: ["ラストパスで", "アシスト数", "ゲームメイク", "チャンスメイク", "パス回し"] },
    { goal: "speed", phrases: ["裏抜け", "スピード特化", "快速", "俊足"] },
    { goal: "possession", phrases: ["ボールを失わない", "ポゼッション", "キープ力"] },
    { goal: "physical", phrases: ["当たり負けしない", "身体を張る", "フィジカル重視"] },
    { goal: "aerial", phrases: ["空中戦を重視", "空中戦で違いを"] },
    { goal: "defense", phrases: ["守備重視", "守備特化"] },
    { goal: "press", phrases: ["プレス特化", "前線からのプレス"] },
    { goal: "counter", phrases: ["カウンター特化", "素早い切り替え"] },
    { goal: "balance", phrases: ["万能型", "何でもできる", "バランス型"] },
  ],
  positionPhrases: [
    { position: "RWF", phrases: ["RWF", "右ウイングフォワード", "右ウイング"] },
    { position: "LWF", phrases: ["LWF", "左ウイングフォワード", "左ウイング"] },
    { position: "CF", phrases: ["CF", "センターフォワード", "ストライカー"] },
    { position: "SS", phrases: ["SS", "トップ下", "シャドーストライカー"] },
    { position: "AMF", phrases: ["AMF", "攻撃的ミッドフィルダー", "攻撃的MF"] },
    { position: "CMF", phrases: ["CMF", "センターミッドフィルダー", "センターMF"] },
    { position: "DMF", phrases: ["DMF", "守備的ミッドフィルダー", "守備的MF", "ボランチ"] },
    { position: "LMF", phrases: ["LMF", "左サイドハーフ", "左MF"] },
    { position: "RMF", phrases: ["RMF", "右サイドハーフ", "右MF"] },
    { position: "LB", phrases: ["LB", "左サイドバック"] },
    { position: "RB", phrases: ["RB", "右サイドバック"] },
    { position: "CB", phrases: ["CB", "センターバック"] },
    { position: "GK", phrases: ["GK", "ゴールキーパー"] },
  ],
  usageIntentPhrases: ["で使いたい", "で起用したい", "で使う", "の候補として", "を使いたい", "で運用したい"],
  topPriorityPhrases: [
    "最優先",
    "一番重視",
    "最も重視",
    "特化",
    "主軸",
    "中心",
    "絶対に伸ばしたい",
    "武器にしたい",
    "メインで",
    "第一優先",
    "重視したい",
    "重視する",
    "優先したい",
    "優先する",
  ],
  secondaryPriorityPhrases: [
    "補助的に",
    "サブとして",
    "最低限残したい",
    "最低限ほしい",
    "できれば残したい",
    "ある程度ほしい",
    "少し重視",
    "副次的に",
    "ついでに伸ばしたい",
    "最低限",
  ],
  normalPriorityPhrases: ["普通でいい", "平均程度", "特に優先しない", "標準でいい", "そのままでいい"],
  lowPriorityPhrases: ["優先度は低い", "後回し", "少なくていい", "重要ではない"],
  negativePriorityPhrases: ["重視しない", "優先しない", "あまり重視しない"],
  avoidOverinvestmentPhrases: [
    "上げすぎたくない",
    "伸ばしすぎたくない",
    "元から高い",
    "十分高い",
    "これ以上いらない",
    "振りすぎたくない",
    "上げすぎなくてよい",
    "上げすぎなくていい",
    "上げなくていい",
    "上げなくてもいい",
  ],
  ignorePhrases: ["捨てる", "完全に切る", "切ってもいい", "不要", "なくてもいい", "低くて構わない", "犠牲にする", "いらない", "いらん"],
  preservePhrases: ["残したい", "維持したい", "長所として残す", "ここは下げたくない", "武器として維持"],
  balanceHintPhrases: ["バランスよく", "バランス良く", "バランスを取りたい"],
  comparativeConnectors: [
    { marker: "より", direction: "right-preferred" },
    { marker: "ではなく", direction: "right-preferred" },
  ],
  sentenceEnderChars: ["。", "！", "!", "？", "?", "\n", "；", ";"],
  clauseConnectorPhrases: ["ただし", "でも", "一方で", "その代わり"],
};
