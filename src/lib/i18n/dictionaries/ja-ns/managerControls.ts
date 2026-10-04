import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 managerControls（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const managerControls: Dictionary["managerControls"] = {
  sortNameLabel: "名前順",
  sortReleasedDesc: "リリースが新しい順",
  sortReleasedAsc: "リリースが古い順",
  sortPossessionDesc: "ポゼッション適性 高い順",
  sortQuickCounterDesc: "クイックカウンター適性 高い順",
  searchPlaceholder: "監督名・チームで検索",
  searchAriaLabel: "監督を検索",
  sortAriaLabel: "並べ替え",
  boosterFilterAriaLabel: "ブースター",
  boosterFilterAllOption: "ブースター: 全て",
  boosterFilterHasOption: "ブースターあり",
  boosterFilterNoneOption: "ブースターなし",
  linkUpFilterAriaLabel: "Link-Up Play",
  linkUpFilterAllOption: "Link-Up Play: 全て",
  linkUpFilterHasOption: "Link-Up Play あり",
  linkUpFilterNoneOption: "Link-Up Play なし",
  };

registerJaNamespace("managerControls", managerControls);

export default managerControls;
