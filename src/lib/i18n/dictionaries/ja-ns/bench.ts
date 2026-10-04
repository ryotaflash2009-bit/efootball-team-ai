import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 bench（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const bench: Dictionary["bench"] = {
  modeNone: "育成なし",
  modeAttack: "攻撃",
  modeDefense: "守備",
  modeBalance: "バランス",
  modeGk: "GK",
  heading: "ベンチ",
  addButton: "＋ ベンチ選手を追加",
  empty: "ベンチ選手は未登録です。",
  moveCandidatePrefix: "移動先候補 — ",
  movingPrefix: "移動中 — ",
  benchSlotLabel: "ベンチ",
  moveSwapSuffix: "・選ぶと入れ替え",
  moveStartSuffix: "・選ぶと移動・交代を開始",
  positionUnknown: "?",
  displayedOvrPrefix: "表示OVR ",
  ovrUnknown: "–",
  loadingLabel: "読み込み中…",
  errorLabel: "取得失敗",
  moveUpAriaTemplate: "{name} を上へ",
  moveDownAriaTemplate: "{name} を下へ",
  removeButton: "外す",
  staleBuildLabel: "旧規則ビルド",
  buildModeAriaTemplate: "{name} のベンチ育成方針",
  squadBuildLabelPrefix: "スカッド用ビルド: ",
  buildNotSet: "未設定",
  buildDeleted: "削除済み",
  chooseBuildButton: "保存ビルドを選ぶ",
  moveToBenchAria: "移動先候補 — ベンチへ移動",
  moveToBenchButton: "ここへ（ベンチへ移動）",
  };

registerJaNamespace("bench", bench);

export default bench;
