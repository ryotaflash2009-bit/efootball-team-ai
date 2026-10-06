import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 yourBest（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const yourBest: Dictionary["yourBest"] = {
  heading: "あなたの一番",
  explanation: "My Team の中で、能力のまとまりごとに育成前の基礎能力値が最も上位のカードです（フィールドプレイヤーどうし・GK どうしで比較）。開くとカードの能力値を読み込みます。",
  none: "表示できるカードがありません（中央値以上のカードが無いか、My Team が空です）。",
    extrasHeading: "チームの中での一番（公式のデータ）",
  extraHighestRated: "最高の総合値",
  extraLargestGrowth: "伸びしろが最大",
  extraRarestPosition: "チームで最も少ないポジション",
  extraRarestCardType: "チームで最も少ないカード種別",
  extraOvrTemplate: "最大 OVR {value}",
  extraGrowthTemplate: "最大 OVR − 基礎 OVR = +{value}",
  extraCountTemplate: "{label}（{count}）",
  extrasNote: "My Team の中だけで比べます。同じ値のときは World の ID の順で決めます。監督との相性・多用途さ・控えの強さ・育成の伸びは、必要なデータが無いため出しません。",
};

registerJaNamespace("yourBest", yourBest);

export default yourBest;
