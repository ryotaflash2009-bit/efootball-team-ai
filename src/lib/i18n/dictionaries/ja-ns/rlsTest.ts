import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 rlsTest（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const rlsTest: Dictionary["rlsTest"] = {
  pageTitle: "開発用RLS検証（PoC）",
  devNoticeTitle: "これは開発用のRow Level Security検証ページです",
  devNoticeBody: "Supabaseの認証とRow Level Security(RLS)だけで、ログイン中の本人のデータだけが読み書きできることを確認するための技術検証専用ページです。",
  notCloudSyncNotice: "My Team・お気に入り・保存ビルド・保存スカッドなどのクラウド同期ではありません。",
  shortStringOnlyNotice: "ここには短い検証用の文字列だけを入力してください。実名・メールアドレス・パスワードなどの個人情報や秘密情報は入力しないでください。",
  deletableAfterTestNotice: "検証が終わったレコードは、いつでもこの画面から削除できます。",
  loginRequiredMessage: "このページを利用するにはログインが必要です。",
  loadingMessage: "読み込んでいます…",
  createLabel: "検証用の短い文字列",
  createPlaceholder: "例: Probe A",
  createButton: "作成",
  createSubmitting: "作成中…",
  createSuccessMessage: "検証用レコードを作成しました。",
  createEmptyError: "文字列を入力してください。",
  createTooLongError: "100文字以内で入力してください。",
  listHeading: "自分の検証用レコード",
  emptyListMessage: "検証用レコードはまだありません。",
  editButton: "編集",
  saveButton: "保存",
  cancelButton: "キャンセル",
  deleteButton: "削除",
  deleteConfirmTitle: "このレコードを削除しますか？",
  deleteConfirmBody: "この操作は取り消せません。",
  deleteConfirmButton: "削除する",
  updateSuccessMessage: "更新しました。",
  deleteSuccessMessage: "削除しました。",
  genericErrorMessage: "処理に失敗しました。時間をおいて再度お試しください。",
  notFoundOrForbiddenMessage: "対象のレコードが見つからないか、操作する権限がありません。",
  };

registerJaNamespace("rlsTest", rlsTest);

export default rlsTest;
