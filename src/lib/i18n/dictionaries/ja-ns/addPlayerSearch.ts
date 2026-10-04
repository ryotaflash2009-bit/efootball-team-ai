import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 addPlayerSearch（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const addPlayerSearch: Dictionary["addPlayerSearch"] = {
  selectCardHeadingTemplate: "{slot}に追加するカードを選択",
  closeButton: "閉じる",
  maxPlayersNoteTemplate: "比較は最大 {max} 人です。追加するには先に選手を削除してください。",
  searchPlaceholder: "選手名・World ID・ポジションで検索...",
  searchAriaLabelTemplate: "{slot}に追加する選手を検索",
  duplicateNote: "同じカード（World ID 一致）は重複追加できません。同一人物でも別カード（World ID 違い）は比較できます。並び: 名前一致 → 最大 OVR 高い順。",
  minLengthPromptTemplate: "選手名・World ID・ポジションを入力してください（{min} 文字以上）。",
  tooShortTemplate: "あと {remaining} 文字入力してください（全カードの一括表示を避けるため）。",
  searchFailedError: "選手を検索できませんでした。",
  retryButton: "再試行",
  noResults: "条件に一致するカードがありません。",
  resultCountTemplate: "{count} 件",
  addingLabel: "追加中…",
  addToSlotTemplate: "{slot}へ追加",
  alreadyAddedReason: "比較に追加済み",
  processingReason: "追加処理中",
  addFailedError: "この選手を比較へ追加できませんでした。もう一度お試しください。",
  };

registerJaNamespace("addPlayerSearch", addPlayerSearch);

export default addPlayerSearch;
