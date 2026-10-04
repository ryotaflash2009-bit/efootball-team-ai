import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 yourBest（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const yourBest: Dictionary["yourBest"] = {
  heading: "あなたの一番",
  explanation: "My Team の中で、能力のまとまりごとに育成前の基礎能力値が最も上位のカードです（フィールドプレイヤーどうし・GK どうしで比較）。開くとカードの能力値を読み込みます。",
  none: "表示できるカードがありません（中央値以上のカードが無いか、My Team が空です）。",
  };

registerJaNamespace("yourBest", yourBest);

export default yourBest;
