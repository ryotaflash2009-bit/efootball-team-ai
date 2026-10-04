import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 compareSaveBuildDialog（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const compareSaveBuildDialog: Dictionary["compareSaveBuildDialog"] = {
  defaultName: "比較画面の育成",
  nameRequiredError: "ビルド名を入力してください（1〜60文字）。",
  saveFailedTemplate: "保存できませんでした: {error}",
  saveErrorGeneric: "保存中にエラーが発生しました（localStorage を利用できない可能性があります）。比較の配分はそのままです。",
  modalTitleTemplate: "{index}人目 {name} の育成を保存",
  intro: "この配分を保存ビルドとして保存します。保存後は選手詳細・My Team・各スカッド編集画面から選択できます。既存スカッドへ自動適用はしません。",
  allocationHeadingTemplate: "育成配分（使用 {used} / 合計 {total}pt）",
  buildNameLabel: "ビルド名",
  buildNameAriaLabel: "保存する育成ビルドの名前",
  saveMethodLegend: "保存方法",
  saveAsNewOption: "新しいビルドとして保存",
  overwriteExistingOption: "既存の保存ビルドを上書き",
  overwriteSelectAriaLabel: "上書きする保存ビルド",
  includePomLabel: "Power of Many のユーザー指定段階を含める",
  pomCurrentTemplate: "（現在: {tier}）",
  pomUnspecifiedNote: "（このカードに指定なし）",
  pomNoSpecificValue: "指定あり",
  footnote: "実験的試算・監督設定は保存ビルドに含まれません（既存の保存ビルド仕様）。fixed booster はカードデータから解決されるため保存しません。",
  cancelButton: "キャンセル",
  overwriteWarningTemplate: "「{name}」を上書きします（元の配分へは自動で戻せません）。",
  overwriteSaveButton: "上書きして保存",
  confirmOverwriteButton: "上書きを確認",
  savingButton: "保存中…",
  saveButton: "保存",
  };

registerJaNamespace("compareSaveBuildDialog", compareSaveBuildDialog);

export default compareSaveBuildDialog;
