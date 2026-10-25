import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 tierList（ポジション別 Tier・F-090・2026-10-14）。 */
const tierList: Dictionary["tierList"] = {
  pageTitle: "ポジション別 Tier",
  heading: "ポジション別 Tier（最大 OVR の上位）",
  intro: "登録ポジションごとに、最大 OVR（レベル最大のとき）が高いカードを S・A・B・C に分けています。TeamAIXI のデータから計算しています。",
  rulesBody: "規則: そのポジションの全カードの中で、最大 OVR の順位が上位 1% 以内なら S、3% 以内なら A、6% 以内なら B、10% 以内なら C。同じ最大 OVR は同じ Tier です。外部の Tier・投票は使っていません。",
  notStrengthNotice: "最大 OVR だけの順位で、ゲーム内の強さ・使いやすさ・プレースタイル・相性の評価ではありません。",
  sourceTemplate: "規則の版 {version}・データの時点 {date}",
  positionNavLabel: "ポジション",
  populationTemplate: "{position} の登録カード {count} 枚の中での順位です。",
  tooFewCards: "このポジションはカードが少ないため、Tier を作っていません。",
  tierRangeS: "上位 1% 以内",
  tierRangeA: "上位 3% 以内",
  tierRangeB: "上位 6% 以内",
  tierRangeC: "上位 10% 以内",
  entryTemplate: "最大 OVR {ovr}・{rank} 位（上位 {pct}%）",
  showMoreTemplate: "残り {count} 件を表示",
  dataUnavailable: "選手データを読み込めませんでした。時間をおいてもう一度お試しください。",
  newCardsLinkTemplate: "{position} の新しいカードを見る",
};

registerJaNamespace("tierList", tierList);
export default tierList;
