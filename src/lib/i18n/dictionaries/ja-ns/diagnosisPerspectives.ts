import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 diagnosisPerspectives（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const diagnosisPerspectives: Dictionary["diagnosisPerspectives"] = {
  title: "診断の追加観点",
  badge: "暫定 / 比較検証用",
  note: "計算式を比べるための暫定の表示です。総合評価・順位・共有画像には使いません。観点ごとに独立していて、合計しません。",
  jaOnlyNote: "観点の詳細は日本語だけで表示します。",
  formulas: "計算式の候補",
  kindFact: "事実",
  kindProvisional: "暫定",
  causes: "原因の選手・ポジション",
  missingData: "足りないデータ",
  improvements: "改善したときの変化",
  confidence: "信頼度",
  confidenceHigh: "高",
  confidenceMedium: "中",
  confidenceLow: "低",
  confidenceInsufficient: "判定できない",
  notComputed: "計算しない",
  rulesVersion: "規則の版",
  };

registerJaNamespace("diagnosisPerspectives", diagnosisPerspectives);

export default diagnosisPerspectives;
