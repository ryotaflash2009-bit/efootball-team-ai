import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 compareCategory（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const compareCategory: Dictionary["compareCategory"] = {
  attack: "攻撃",
  dribble: "ドリブル",
  pass: "パス",
  defense: "守備",
  physical: "フィジカル",
  speed: "スピード",
  gk: "GK",
  };

registerJaNamespace("compareCategory", compareCategory);

export default compareCategory;
