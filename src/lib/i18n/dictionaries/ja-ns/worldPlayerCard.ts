import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 worldPlayerCard（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const worldPlayerCard: Dictionary["worldPlayerCard"] = {
  noEnglishName: "（英語名なし）",
  baseOvrLabel: "基礎 {value}",
  levelCapLabel: "Lv上限 {value}",
  };

registerJaNamespace("worldPlayerCard", worldPlayerCard);

export default worldPlayerCard;
