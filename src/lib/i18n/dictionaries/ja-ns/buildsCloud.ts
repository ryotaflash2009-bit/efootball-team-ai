import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 buildsCloud（保存ビルドのクラウド保存・2026-10-11・ja/en だけ）。 */
const buildsCloud: Dictionary["buildsCloud"] = {
  pageTitle: "保存ビルドのクラウド保存（アルファ機能）",
  introBody: "保存ビルド（My Builds）を、ログイン中のアカウントのクラウドに手動で保存できます。別の端末やブラウザーでは「足りないビルドだけ追加」して戻せます。",
  manualNotice: "ログインやページの表示だけでは、保存も反映もしません。下のボタンを押したときだけ実行します。",
  scopeNotice: "対象は保存ビルドだけです（My Team は「My Team クラウド保存」で保存します。スカッドはまだ対象外です）。",
  unavailableNotice: "準備中です（運営によるデータベースの準備の後に使えるようになります）。保存ビルドは今まで通りこの端末に保存されています。",
  signInRequired: "この機能を使うにはログインが必要です。",
  signInLink: "ログイン",
  localCountLabel: "この端末の保存ビルド",
  cloudLabel: "クラウド",
  cloudNone: "クラウドデータなし",
  cloudNotChecked: "未確認（「クラウドデータを確認」を押してください）",
  cloudExistsTemplate: "クラウド保存済み（{count} 件・更新 {date}）",
  checkButton: "クラウドデータを確認",
  checking: "確認中…",
  saveButton: "クラウドへ保存",
  saving: "保存中…",
  saveConfirmTemplate: "この端末の保存ビルド {count} 件で、クラウドのデータを置き換えます。この端末の保存ビルドは消えません。",
  saveConfirmButton: "保存する",
  cancelButton: "キャンセル",
  saveEmptyBlocked: "この端末に保存ビルドがないため、クラウドのデータを空で上書きしません。",
  saved: "クラウドへ保存しました。",
  restorePreviewTemplate: "追加できるビルド {add} 件・すでにあるもの {same} 件・同じ ID で内容が違うもの {diff} 件（端末を優先して変えません）",
  restoreButton: "端末に足りないビルドを追加",
  restoredTemplate: "{count} 件のビルドを端末に追加しました。",
  restoreNothing: "追加するビルドはありません。",
  deleteButton: "クラウドデータを削除",
  deleteConfirm: "クラウドの保存ビルドを削除します。この端末の保存ビルドは消えません。",
  deleteConfirmButton: "削除する",
  deleted: "クラウドデータを削除しました。",
  errorGeneric: "処理できませんでした。時間をおいてもう一度お試しください。",
  errorUnauthenticated: "ログインの有効期限が切れました。もう一度ログインしてください。",
  errorInvalidLocal: "この端末の保存ビルドに読み込めないデータがあるため、保存しませんでした。",
  errorInvalidCloud: "クラウドのデータを読み込めませんでした（形式が違う可能性があります）。この端末のデータは変えていません。",
  errorConflict: "この端末の保存ビルドが途中で変わりました。もう一度確認してください。",
  accountLinkHint: "保存ビルドのクラウド保存（アルファ機能）",
  accountLinkLabel: "保存ビルドのクラウド保存",
};

registerJaNamespace("buildsCloud", buildsCloud);

export default buildsCloud;
