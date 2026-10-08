import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 playerControlColumn（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const playerControlColumn: Dictionary["playerControlColumn"] = {
  removeAriaTemplate: "{name} を比較から削除",
  savedBuildTrainingLabelTemplate: "保存ビルド: {name}",
  manualTrainingLabel: "手動育成",
  followsPolicyLabel: "育成方針に従う",
  trainingPolicyLabel: "育成方針",
  trainingPolicyAriaTemplate: "{name} の育成方針",
  savedBuildOptionTemplate: "保存ビルド: {name}",
  manualTrainingOption: "手動育成（下のスライダー）",
  applyBuildAriaTemplate: "{name} の保存ビルドを適用",
  applyBuildDefaultOption: "保存ビルドを適用...",
  trainingConsolidatedNoteTemplate:
    "育成スライダーは下の「比較コックピット」でまとめて操作できます（{mode}・使用 {used}/{total}pt）。",
  positionFitSummary: "ポジション適性",
  registeredPositionLabel: "登録ポジション: ",
  currentOverallLabel: "現在の育成でのポジション別総合値: ",
  currentOverallValue: "—",
  currentOverallNote: "（公式の計算式が非公開のため計算しません）",
  overallExplanation:
    "現在の育成内容は上の 26 能力値比較へ反映されています。ポジション別総合値は KONAMI が算式・能力重み・丸め規則を公開しておらず、複数カードの表示値サンプルも不足しているため、推測値を表示していません（架空の数値は出しません）。",
  attachedBoosterPrefixTemplate: "付属{slot}: ",
  powerOfManyNote: "可変ブースター（金色・Game Plan 依存）・比較の順位に不反映",
  verifiedScreenshotNoteTemplate: "参考画面で実測確認{fixedSuffix}・比較に反映",
  fixedEstimateSuffix: "・固定型推定",
  externalCrossVerifiedNoteTemplate: "外部照合済み（公式未確認）{fixedSuffix}・比較に反映",
  underVerificationNote: "効果未確定・比較に不反映",
  additionalBoosterPrefix: "追加ブースター（B2・付属を上書き・",
  additionalBoosterHighlight: "確認済みは比較の順位へ反映",
  additionalBoosterSuffix: "）",
  boosterLevelAriaTemplate: "{name} のブースターレベル",
  additionalBoosterAriaTemplate: "{name} の追加ブースター（B2）",
  noneOption: "なし",
  boosterFootnotePrefix: "カード付属ブースターは ",
  boosterFootnoteHighlight: "標準モード",
  boosterFootnoteSuffix:
    "で比較へ反映（スクリーンショット実測 2 種 ＋ eFootball World と EFScout の外部2ソース整合 27 種。発動方式は固定型と推定のものを含む。KONAMI 公式未確認）。追加ブースター（B2）はそのカードのみ・スロットの付属を上書きします。確認済みのB2（この一覧はすべて確認済み）は通常の最終値・比較の順位へも反映します。",
  managerLabel: "監督",
  managerClearButton: "解除",
  noManagerLabel: "監督なし",
  managerChangeButton: "変更",
  managerChooseButton: "監督一覧から選択",
  };

registerJaNamespace("playerControlColumn", playerControlColumn);

export default playerControlColumn;
