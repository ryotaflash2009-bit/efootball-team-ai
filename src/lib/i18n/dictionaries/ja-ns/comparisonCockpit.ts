import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 comparisonCockpit（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const comparisonCockpit: Dictionary["comparisonCockpit"] = {
  abilitiesTableLink: "26 能力値表へ ↓",
  backToTrainingLink: "育成へ戻る ↑",
  ariaLabel: "比較コックピット（育成・能力値レーダー・カテゴリプレビュー）",
  heading: "比較コックピット",
  headingHint: "育成スライダーを操作すると、レーダーとカテゴリ値・26 能力値表が即時更新されます。",
  selectPlayerAriaLabel: "育成する選手を選択",
  playerTabTemplate: "{index}人目 {name}",
  activeSuffix: "（育成中）",
  };

registerJaNamespace("comparisonCockpit", comparisonCockpit);

export default comparisonCockpit;
