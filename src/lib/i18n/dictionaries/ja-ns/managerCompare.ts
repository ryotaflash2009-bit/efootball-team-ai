import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 managerCompare（2026-10-07・監督の比較の画面だけが読み込む）。 */
const managerCompare: Dictionary["managerCompare"] = {
  pageTitle: "監督の比較 | TeamAIXI",
  heading: "監督の比較",
  intro: "2〜4 人の監督の戦術の適性・ブースター・フォーメーションを並べます（データの事実だけで、総合点は付けません）。",
  addManager: "監督を追加",
  removeTemplate: "{name} を外す",
  pickerTitle: "比較する監督を選ぶ",
  emptyTitle: "監督が選ばれていません",
  emptyDescription: "「監督を追加」から 2〜4 人を選んでください。",
  needMoreHint: "比較するには、もう 1 人以上を追加してください。",
  maxReached: "比較できるのは 4 人までです。",
  loading: "読み込み中…",
  loadFailed: "監督のデータを読み込めませんでした。時間をおいて再読み込みしてください。",
  tacticsTitle: "戦術の適性",
  bestNote: "★ は各行で最も高い値です（同点は全員）。",
  bestMarker: "最高",
  boostersTitle: "監督ブースター",
  noBoosters: "ブースターはありません",
  unconfirmedBadge: "未確認",
  factsTitle: "そのほかの情報",
  formationLabel: "フォーメーション",
  releasedLabel: "登場日",
  linkUpLabel: "Link-Up Play の数",
  backToList: "監督一覧へ戻る",
  managerColumn: "監督",
};

registerJaNamespace("managerCompare", managerCompare);

export default managerCompare;
