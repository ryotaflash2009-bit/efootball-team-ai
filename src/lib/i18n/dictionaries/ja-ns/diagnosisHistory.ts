import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 diagnosisHistory（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const diagnosisHistory: Dictionary["diagnosisHistory"] = {
  pageTitle: "診断履歴",
  pageDescription: "保存したスカッド診断の履歴です。このブラウザー内だけに保存され、サーバーや他の端末には送られません。",
  limitNote: "最大50件まで保存され、超えると古いものから削除されます。",
  saveButton: "診断を履歴に保存",
  saved: "履歴に保存しました。",
  savedTrimmed: "履歴に保存しました（上限を超えた古い履歴を{count}件削除しました）。",
  duplicate: "前回と同じ結果のため、履歴には追加しませんでした。",
  saveFailed: "履歴に保存できませんでした。このブラウザーでは保存できない設定の可能性があります。",
  scopePending: "ログイン状態を確認しています。少し待ってからもう一度お試しください。",
  openHistory: "診断履歴を見る",
  loading: "読み込み中…",
  empty: "保存された診断はまだありません。スカッド編集画面の診断から保存できます。",
  unavailable: "このブラウザーでは履歴を保存・表示できません（プライベートブラウズやストレージの制限など）。",
  corruptedNotice: "読み込めない履歴が{count}件あったため、表示から除外しました。",
  savedAt: "保存日時",
  overall: "総合評価",
  notRated: "判定対象外",
  openShare: "共有URLで表示",
  deleteButton: "削除",
  deleteConfirm: "この履歴を削除しますか？",
  confirmDelete: "削除する",
  cancel: "キャンセル",
  deleted: "削除しました。",
  deleteFailed: "削除できませんでした。",
  deleteAll: "すべて削除",
  deleteAllConfirm: "すべての診断履歴を削除します。元に戻せません。",
  deleteAllDone: "すべての診断履歴を削除しました。",
  exportButton: "JSONで保存",
  exportNote: "書き出したファイルには、スカッドIDなどの内部IDは含まれません（スカッド名は含まれます）。",
  exportFailed: "ファイルを保存できませんでした。",
  dataManagementHeading: "診断履歴",
  dataManagementBody: "スカッド診断の履歴はこのブラウザー内だけに保存されます。診断履歴ページで1件ずつ、またはすべて削除できます。",
  dataManagementLink: "診断履歴を開く",
  };

registerJaNamespace("diagnosisHistory", diagnosisHistory);

export default diagnosisHistory;
