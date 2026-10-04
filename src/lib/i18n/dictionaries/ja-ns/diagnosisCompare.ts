import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 diagnosisCompare（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const diagnosisCompare: Dictionary["diagnosisCompare"] = {
  selectLabel: "比較に選ぶ",
  selectHint: "2件を選ぶと改善前後を比較できます（保存日時の古い方が「改善前」になります）。",
  compareButton: "改善前後を比較",
  clearSelection: "選択を解除",
  title: "改善前後の比較",
  before: "改善前",
  after: "改善後",
  overall: "総合評価",
  notRated: "判定対象外",
  trendImproved: "改善",
  trendWorsened: "悪化",
  trendUnchanged: "変化なし",
  trendNotComparable: "比較不可",
  summaryTemplate: "改善 {improved}・悪化 {worsened}・変化なし {unchanged}・比較不可 {notComparable}",
  strengthHeading: "主な強み",
  weaknessHeading: "主な弱点",
  changed: "変化あり",
  notChanged: "変化なし",
  disclaimer: "この比較は、同じ診断規則で計算した2つの結果の差だけを示します。変化の原因（選手の入れ替えや育成など）は判定していません。",
  rulesMismatch: "診断規則の版が異なるため比較できません。",
  sameEntry: "同じ履歴どうしは比較できません。別の履歴を選んでください。",
  invalid: "この組み合わせは比較できません。",
  saveImage: "画像を保存",
  imageSaved: "画像を保存しました。",
  imageFailed: "画像を保存できませんでした。",
  shareLabel: "比較の共有URL",
  shareNote: "共有URLには2つの診断の要約（点数・ランク・日付・強み弱点の種類）だけが含まれ、スカッド名・選手名・IDは含まれません。サーバーには保存されません。URLを知っている人は誰でも見られます。",
  copy: "コピー",
  copied: "コピーしました。",
  copyFailed: "コピーできませんでした。URLを選択して手動でコピーしてください。",
  pageTitle: "共有された改善前後の比較",
  viewerNote: "共有した人の端末で計算された結果です。このページは形式と整合性だけを確認しており、内容の正しさは保証しません。",
  invalidTitle: "この共有URLは開けません",
  invalidBody: "URLが途中で切れているか、内容が正しくありません。",
  unsupportedBody: "このサイトが対応していない形式の共有URLです。",
  emptyBody: "共有データが含まれていません。",
  openSite: "TeamAIXI を開く",
  loading: "読み込み中…",
  };

registerJaNamespace("diagnosisCompare", diagnosisCompare);

export default diagnosisCompare;
