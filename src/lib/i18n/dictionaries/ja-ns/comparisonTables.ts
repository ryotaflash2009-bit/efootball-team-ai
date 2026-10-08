import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 comparisonTables（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const comparisonTables: Dictionary["comparisonTables"] = {
  deltaProgressionPrefix: "育",
  deltaPlayerBoosterPrefix: "選",
  deltaConditionalPrefix: "条",
  deltaManagerBoosterPrefix: "監",
  rulesLabel: "規則: ",
  estimatedOvrLabel: "推定OVR（公式の計算式ではありません）: ",
  boosterModePrefix: "ブースター適用モード: ",
  boosterModeStandard: "標準",
  boosterModeNoteSuffix:
    "（カード付属の効果を外部2ソースで照合したブースターを順位へ反映。発動方式は固定型と推定のものを含みます（Power of Many である具体的証拠がないため）。KONAMI 公式未確認。Power of Many のユーザー指定値と手動試算は順位に含めません）",
  basicInfoHeading: "基本情報",
  itemHeader: "項目",
  positionMatchLabel: "ポジション一致: ",
  yes: "はい",
  no: "いいえ",
  categoryHeading: "カテゴリ比較",
  categoryHeadingHint: "単純合計/平均・公式評価ではない",
  categoryHeader: "カテゴリ",
  diffHeader: "差",
  avgTemplate: "(平均 {value})",
  totalRowLabel: "総合（単純合計）",
  abilitiesHeading: "能力値（26項目）",
  conditionalToggleLabel: "ユーザー指定条件を含む比較（金色・可変ブースターの手動段階を反映・自動判定ではありません）",
  conditionalNote:
    "この表は「条件反映後値」を表示しています。ユーザーが自身の Game Plan を確認して指定した段階に基づく試算で、アプリが編成人数を自動検証した値ではありません。通常の比較順位（既定表示）には含めていません。",
  abilityHeader: "能力値",
  legendPrefix: "小さい表記: ",
  legendProgression: "育=育成デルタ",
  legendPlayerBooster: " / 選=カード付属ブースター（",
  legendStandardMode: "標準モード",
  legendPlayerBoosterDetailSuffix:
    ": スクリーンショット実測 2 種 ＋ eFootball World と EFScout の外部2ソース整合 27 種。発動方式は固定型と推定のものを含みます。KONAMI 公式未確認。検証中・手動試算は含めません）",
  legendConditional: " / 条=Total Package のユーザー指定段階（「条件反映後」表示時のみ・自動判定ではありません）",
  legendManagerBooster: " / 監=監督ブースター。",
  legendSuffix: "既定の順位に Total Package の手動段階は含めません。最も高い値を ",
  legendHighestColor: "緑",
  legendDisplaySuffix: "で表示。",
  skillsHeading: "スキル比較",
  playerSkillsTitle: "選手スキル（Player Skills）",
  aiStylesTitle: "AI プレースタイル（AI Playing Styles）",
  countLabel: "数: ",
  sharedByAllTemplate: "全員が持つ（{count}）",
  noneLabel: "なし",
  partialTitle: "一部だけが持つ",
  uniqueToPlayerTemplate: "{name} 固有（{count}）",
  };

registerJaNamespace("comparisonTables", comparisonTables);

export default comparisonTables;
