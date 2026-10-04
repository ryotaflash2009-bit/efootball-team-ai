import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 comparisonBoard（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const comparisonBoard: Dictionary["comparisonBoard"] = {
  sameTrainingLabel: "全員に同じ育成:",
  sameManagerLabel: "全員に同じ監督:",
  chooseFromManagerListButton: "監督一覧から選択",
  clearAllManagersButton: "全員の監督を解除",
  perPlayerManagerNote: "個別に監督を変える場合は各選手の列で設定できます。",
  sharedManagerPickerTitle: "全員に適用する監督を選択",
  perPlayerManagerPickerTitleTemplate: "{name} の監督を選択",
  fallbackPlayerName: "選手",
  maxPlayersErrorTemplate: "比較は最大{max}人です。",
  duplicateCardError: "同じカードは重複して追加できません。",
  fetchPlayerFailedError: "選手を取得できませんでした。",
  fetchPlayerErrorGeneric: "選手の取得に失敗しました。",
  buildSavedNoticeTemplate: "「{name}」を保存しました（選手詳細・My Team・スカッドから選択できます）。",
  confirmOverwriteWarningTemplate: "手動配分 / 保存ビルドを設定した列があります。「{mode}」を全員へ適用すると上書きされます。",
  overwriteTargetsLabel: "上書き対象: ",
  overwriteTargetTemplate: "{index}人目（{name}）",
  overwriteApplyButton: "上書きして適用",
  overwriteCancelButton: "やめる",
  selectSlotOrdinalTemplate: "{n}人目を選択",
  addPlayerToSlotButtonTemplate: "＋ {n}人目へ選手を追加",
  maxPlayersNoteTemplate: "比較は最大{max}人です。別の選手を追加するには、いずれかの ✕ で削除してください。",
  needTwoPlayersTitle: "比較するには選手を2人以上選んでください",
  needTwoPlayersDescriptionTemplate:
    "上の空きスロットの「＋ 比較へ選手を追加」から選択できます（最大{max}人）。同一人物の別カードも比較できます。",
  browseHighOvrButton: "高OVRカードから探す",
  };

registerJaNamespace("comparisonBoard", comparisonBoard);

export default comparisonBoard;
