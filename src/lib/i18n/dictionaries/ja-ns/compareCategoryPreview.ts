import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 compareCategoryPreview（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const compareCategoryPreview: Dictionary["compareCategoryPreview"] = {
  headingTemplate: "{label} の対象能力（{mode}）",
  headingHint: "育成前 → 現在（差）",
  noInfoTemplate: "{index}人目: 情報なし",
  valueAriaLabelTemplate: "{index}人目 {name} 育成前 {before} 現在 {now} 差 {diff}",
  personPrefixTemplate: "{index}人目: ",
  diffLabelTemplate: "1人目 − 2人目: ",
  statusLineTemplate: "{index}人目 {label} Lv {level}・使用 {used} / 残り {remaining}pt",
  footnote:
    "値は既存の育成計算（calculateBuild）の結果です。fixed booster・Power of Many・監督補正は「標準 / 条件反映後」モードの値に含まれます（26 能力値表の行を開くとレイヤー別の内訳を確認できます）。",
  };

registerJaNamespace("compareCategoryPreview", compareCategoryPreview);

export default compareCategoryPreview;
