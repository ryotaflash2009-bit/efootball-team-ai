import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 formationSelect（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const formationSelect: Dictionary["formationSelect"] = {
  ariaLabel: "フォーメーションを選択",
  };

registerJaNamespace("formationSelect", formationSelect);

export default formationSelect;
