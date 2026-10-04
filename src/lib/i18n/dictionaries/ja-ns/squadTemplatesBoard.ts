import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 squadTemplatesBoard（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const squadTemplatesBoard: Dictionary["squadTemplatesBoard"] = {
  pageTitle: "スカッドテンプレート",
  pageDescription: "フォーメーションや選手配置（自由配置座標を含む）をテンプレートとして保存し、新しいスカッドの雛形にできます。テンプレートはこの端末のブラウザ内（localStorage）にのみ保存され、通常のスカッドとは別に管理されます。",
  scopeLoadingMessage: "アカウント情報を確認しています…",
  storageUnavailableHeading: "この環境ではテンプレートを保存できません",
  storageUnavailableNote: "ブラウザの localStorage が使用できません（プライベートモード等）。",
  backToSquadListLink: "← スカッド一覧へ",
  createEmptyHeading: "空テンプレートを作成（フォーメーションのみ）",
  createEmptyNote: "選手を含む「完全テンプレート」は、スカッド一覧の各スカッドの「テンプレ保存」から作成できます（自由配置座標も保存されます）。",
  templateNameLabel: "テンプレート名",
  newTemplateNameAria: "新しいテンプレート名",
  formationLabel: "フォーメーション",
  createButton: "作成",
  defaultEmptyTemplateName: "空テンプレート",
  templatesHeadingTemplate: "テンプレート{countSuffix}",
  templatesCountSuffixTemplate: "（{count}）",
  loadingText: "読み込み中…",
  noTemplatesNote: "テンプレートはまだありません。",
  emptyTypeBadge: "空",
  fullTypeBadge: "完全",
  customPlacementBadge: "カスタム配置",
  startersTemplate: "先発 {count}/11",
  benchTemplate: "ベンチ {count}",
  hasManagerLabel: "監督あり",
  noManagerLabel: "監督なし",
  createFromTemplateButton: "このテンプレートから作成",
  renameButton: "名前変更",
  deleteButton: "削除",
  newSquadNamePrompt: "新しいスカッド名",
  templateNamePrompt: "テンプレート名",
  deleteConfirmTemplate: "テンプレート「{name}」を削除します（このテンプレートだけ・作成済みスカッドは影響を受けません）。",
  deleteConfirmButton: "削除する",
  cancelDeleteButton: "やめる",
  backToSquadListButton: "スカッド一覧へ",
  };

registerJaNamespace("squadTemplatesBoard", squadTemplatesBoard);

export default squadTemplatesBoard;
