import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 compareRadarChart（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const compareRadarChart: Dictionary["compareRadarChart"] = {
  seriesStyleSolid: "実線・丸",
  seriesStyleDashedSquare: "破線・四角",
  seriesStyleDottedTriangle: "点線・三角",
  seriesStyleDashDotDiamond: "一点鎖線・ひし形",
  altLinePersonTemplate: "{index}人目 {name}（{cardType}）: ",
  graphDisplayLabel: "グラフ表示:",
  personOrdinalTemplate: "{n}人目",
  showPreBuildTemplate: "育成前を表示（{target}）",
  showPreBuildFallback: "選択中",
  chartAriaLabelTemplate: "能力値レーダー（{mode}・カテゴリ単純平均・ポジション別 OVR ではありません）。{altLines}",
  legendPersonTemplate: "{index}人目 {name}（{cardType}・{styleLabel}）",
  categoryValuesSummaryTemplate: "カテゴリ値（数値・{mode}）",
  playerHeader: "選手",
  managerNote: "一部の系列に監督補正が含まれます（標準 / 条件反映後モード）。",
  };

registerJaNamespace("compareRadarChart", compareRadarChart);

export default compareRadarChart;
