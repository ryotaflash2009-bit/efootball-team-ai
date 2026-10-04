import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 localBackup（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const localBackup: Dictionary["localBackup"] = {
  heading: "この領域のデータのバックアップ・読み込み・削除",
  intro: "このブラウザーの「{region}」に保存しているデータを、1つの JSON ファイルへ書き出したり、書き出したファイルから戻したり、まとめて削除したりできます。",
  regionGuest: "未ログイン（ゲスト）の領域",
  regionAccount: "ログイン中のアカウントの領域",
  scopePending: "データの領域を確認しています…",
  storageUnavailable: "このブラウザーではデータを保存・読み込みできません。",
  currentDataHeading: "現在のデータ",
  noData: "この領域に保存されたデータはありません。",
  sectionMyTeam: "My Team",
  sectionFavorites: "お気に入り",
  sectionBuilds: "保存ビルド（カード数）",
  sectionSquads: "保存スカッド",
  sectionTemplates: "スカッドテンプレート",
  sectionHistory: "診断履歴",
  noteNoIdentity: "ファイルには、アカウントを識別する情報（ユーザー ID・メールアドレス）を含めません。",
  noteSharing: "ファイルには、メモ・タグ・スカッド名など、あなたが入力した内容が含まれます。他の人へ送らないでください。",
  noteExcluded: "表示言語・サイドバーの状態・一時的な選択は含めません。",
  exportButton: "JSON に書き出す",
  importButton: "JSON から読み込む",
  deleteButton: "この領域のデータを削除",
  exportDone: "書き出しました。",
  exportDoneWithSkipped: "書き出しました。壊れていた項目は含めていません。",
  exportFailed: "書き出せませんでした。",
  importTooLarge: "ファイルが大きすぎます（上限 5 MB）。",
  importReadFailed: "ファイルを読み込めませんでした。",
  importNotBackup: "このアプリで書き出したバックアップのファイルではありません。",
  importInvalidSectionTemplate: "「{section}」の内容が正しくないため、読み込みません（何も変更していません）。",
  importConfirmTitle: "読み込んで置き換えますか？",
  importConfirmBody: "ファイルにある項目について、「{region}」の今のデータを置き換えます。ファイルに無い項目は変わりません。元に戻せません。",
  importExportFirst: "念のため、先に今のデータを書き出しておくことをおすすめします。",
  importConfirmButton: "読み込む",
  importScopeChanged: "ログイン状態が変わったため、読み込みを取り消しました。もう一度ファイルを選んでください。",
  importDone: "読み込みました。",
  importFailedRolledBack: "読み込めませんでした。データは読み込む前の状態のままです。",
  importFailedPartial: "読み込みの途中で失敗し、一部を元に戻せませんでした。書き出したファイルから読み込み直してください。",
  deleteConfirmTitle: "この領域のデータを削除しますか？",
  deleteConfirmBody: "「{region}」の My Team・お気に入り・保存ビルド・保存スカッド・テンプレート・診断履歴を削除します。他の領域と表示の設定は残ります。元に戻せません。",
  deleteConfirmButton: "削除する",
  deleteDone: "この領域のデータを削除しました。",
  deleteFailed: "一部のデータを削除できませんでした。",
  cancel: "キャンセル",
  };

registerJaNamespace("localBackup", localBackup);

export default localBackup;
