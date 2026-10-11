import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 squadsCloud（保存スカッドのクラウド保存・2026-10-11・ja/en だけ）。 */
const squadsCloud: Dictionary["squadsCloud"] = {
  pageTitle: "保存スカッドのクラウド保存（アルファ機能）",
  introBody: "保存スカッドを、ログイン中のアカウントのクラウドに手動で保存できます。別の端末やブラウザーでは「足りないスカッドだけ追加」して戻せます。",
  manualNotice: "ログインやページの表示だけでは、保存も反映もしません。下のボタンを押したときだけ実行します。",
  scopeNotice: "対象は保存スカッドだけです（My Team と保存ビルドは、それぞれのクラウド保存で保存します。スカッドが使うビルドの中身は「保存ビルドのクラウド保存」で一緒に保存してください）。",
  unavailableNotice: "準備中です（運営によるデータベースの準備の後に使えるようになります）。保存スカッドは今まで通りこの端末に保存されています。",
  signInRequired: "この機能を使うにはログインが必要です。",
  signInLink: "ログイン",
  localCountLabel: "この端末の保存スカッド",
  cloudLabel: "クラウド",
  cloudNone: "クラウドデータなし",
  cloudNotChecked: "未確認（「クラウドデータを確認」を押してください）",
  cloudExistsTemplate: "クラウド保存済み（{count} 件・更新 {date}）",
  checkButton: "クラウドデータを確認",
  checking: "確認中…",
  saveButton: "クラウドへ保存",
  saving: "保存中…",
  saveConfirmTemplate: "この端末の保存スカッド {count} 件で、クラウドのデータを置き換えます。この端末の保存スカッドは消えません。",
  saveConfirmButton: "保存する",
  cancelButton: "キャンセル",
  saveEmptyBlocked: "この端末に保存スカッドがないため、クラウドのデータを空で上書きしません。",
  saved: "クラウドへ保存しました。",
  restorePreviewTemplate: "追加できるスカッド {add} 件・すでにあるもの {same} 件・同じ ID で内容が違うもの {diff} 件（端末を優先して変えません）",
  restoreButton: "端末に足りないスカッドを追加",
  restoredTemplate: "{count} 件のスカッドを端末に追加しました。",
  restoreNothing: "追加するスカッドはありません。",
  deleteButton: "クラウドデータを削除",
  deleteConfirm: "クラウドの保存スカッドを削除します。この端末の保存スカッドは消えません。",
  deleteConfirmButton: "削除する",
  deleted: "クラウドデータを削除しました。",
  errorGeneric: "処理できませんでした。時間をおいてもう一度お試しください。",
  errorUnauthenticated: "ログインの有効期限が切れました。もう一度ログインしてください。",
  errorInvalidLocal: "この端末の保存スカッドに読み込めないデータがあるため、保存しませんでした。",
  errorInvalidCloud: "クラウドのデータを読み込めませんでした（形式が違う可能性があります）。この端末のデータは変えていません。",
  errorConflict: "この端末の保存スカッドが途中で変わりました。もう一度確認してください。",
  accountLinkHint: "保存スカッドのクラウド保存（アルファ機能）",
  accountLinkLabel: "保存スカッドのクラウド保存",
  errorLimit: "端末の保存スカッドの上限（50 件）を超えるため、追加しませんでした。不要なスカッドを消してからもう一度お試しください。",
};

registerJaNamespace("squadsCloud", squadsCloud);

export default squadsCloud;
