import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 radarAxis（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const radarAxis: Dictionary["radarAxis"] = {
  attack: "シュート",
  pass: "パス",
  dribble: "ドリブル",
  defense: "ディフェンス",
  physical: "フィジカル",
  speed: "スピード",
  gk: "GK",
  };

registerJaNamespace("radarAxis", radarAxis);

export default radarAxis;
