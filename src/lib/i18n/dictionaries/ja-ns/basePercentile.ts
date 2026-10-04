import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 basePercentile（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const basePercentile: Dictionary["basePercentile"] = {
  heading: "基礎能力値の位置（パーセンタイル）",
  explanation: "この順位は育成前の基礎能力値を、現在のWorldカード分布と比較したものです",
  notBuildNotice: "表示中のビルドや育成プレビューの値ではありません。",
  fallback: "パーセンタイルデータを現在の選手データと照合できません",
  loading: "読み込み中…",
  scopeLabel: "比べる範囲",
  scopeAll: "全Worldカード",
  scopePositionTemplate: "同じ登録ポジション（{pos}）",
  scopeField: "フィールドプレイヤー",
  scopeGk: "GK",
  populationTemplate: "母数 {n} 枚・{date} 時点の分布",
  scopeTooSmall: "この範囲はカードが少ないため表示しません。",
  bucketTopLt1: "上位1%未満",
  bucketTop1: "上位1%",
  bucketTop5: "上位5%",
  bucketTop10: "上位10%",
  bucketTop25: "上位25%",
  bucketTop50: "上位50%",
  bucketBelowMedian: "中央値未満",
  compareToggle: "基礎能力値のパーセンタイルを表示",
  compareScopeNote: "全選手を同じ範囲（全Worldカード）で比べます。",
  };

registerJaNamespace("basePercentile", basePercentile);

export default basePercentile;
