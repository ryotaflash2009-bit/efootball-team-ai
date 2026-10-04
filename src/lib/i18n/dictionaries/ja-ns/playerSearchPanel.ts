import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 playerSearchPanel（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const playerSearchPanel: Dictionary["playerSearchPanel"] = {
  searchAriaLabel: "スカッドへ追加する選手を検索",
  duplicateNotePrefix: "同じカードの重複配置はできません。同一人物でも別カード（World ID 違い）は追加できます。",
  sortNoteWithPositionTemplate: " 並び: 名前一致 → {position} 一致 → OVR 高い順。",
  sortNoteDefault: " 並び: 名前一致 → OVR 高い順。",
  placedLabel: "配置済み",
  placedWithLocationTemplate: "配置済み: {where}",
  };

registerJaNamespace("playerSearchPanel", playerSearchPanel);

export default playerSearchPanel;
