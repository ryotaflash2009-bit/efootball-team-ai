import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 diagnosisShare（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const diagnosisShare: Dictionary["diagnosisShare"] = {
  createButton: "共有URLを作成",
  previewTitle: "共有URLのプレビュー",
  previewIncludes: "このURLに含まれる情報",
  includeDate: "診断日（時刻は含みません）",
  includeOverall: "総合評価の点数とランク",
  includeCategories: "8カテゴリの点数とランク",
  includeFindings: "主な強み・弱点の種類（選手名は含みません）",
  includeRules: "診断規則の版",
  includeFormation: "フォーメーション",
  notIncluded: "スカッド名、選手名、カードID、保存ビルド、スカッドID、アカウント情報、メールアドレスは含みません。",
  visibilityNote: "URLを知っている人は誰でも内容を見られます。共有データはサーバーに保存されません。",
  notSecretNote: "検索エンジンには表示されませんが、秘密の情報を共有するためのものではありません。",
  urlLabel: "共有URL",
  copyButton: "コピー",
  copied: "コピーしました。",
  copyFailed: "コピーできませんでした。URLを選択して手動でコピーしてください。",
  shareButton: "共有…",
  shareFailed: "共有を完了できませんでした。",
  closeButton: "閉じる",
  createFailed: "共有URLを作成できませんでした。",
  pageTitle: "共有されたスカッド診断",
  readOnlyBadge: "読み取り専用",
  sharedNote: "共有した人の端末で計算された診断結果です。このページは形式と整合性だけを確認しており、内容の正しさは保証しません。",
  diagnosedOn: "診断日",
  formation: "フォーメーション",
  overall: "総合評価",
  notRated: "判定対象外",
  categoriesHeading: "カテゴリ別評価",
  strength: "強み",
  weakness: "弱点",
  none: "該当なし",
  findingAbilityHigh: "{category}の評価が高水準",
  findingAbilityLow: "{category}の評価が低水準",
  findingCompatibility: "配置適性に確認が必要な選手がいます",
  findingReferenceError: "保存ビルドの参照に確認が必要です",
  findingConfig: "選手配置の充足状況に改善余地があります",
  olderRules: "この診断は現在とは異なる診断規則（{version}）で作成されています。点数の基準が異なる場合があります。",
  disclaimer: "登録データにもとづく構成評価です。試合結果、全国順位、勝率を保証するものではありません。",
  invalidTitle: "この共有URLは開けません",
  invalidBody: "URLが途中で切れているか、内容が正しくありません。共有した人にもう一度URLを送ってもらってください。",
  unsupportedBody: "このサイトが対応していない形式の共有URLです。",
  emptyBody: "共有データが含まれていません。",
  openSite: "TeamAIXI を開く",
  loading: "読み込み中…",
  };

registerJaNamespace("diagnosisShare", diagnosisShare);

export default diagnosisShare;
