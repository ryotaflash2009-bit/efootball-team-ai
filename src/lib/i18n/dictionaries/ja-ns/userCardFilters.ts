import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 userCardFilters（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const userCardFilters: Dictionary["userCardFilters"] = {
  sortAddedDesc: "登録が新しい順",
  sortAddedAsc: "登録が古い順",
  sortOvrDesc: "OVR が高い順",
  sortOvrAsc: "OVR が低い順",
  sortName: "名前順",
  sortPosition: "ポジション順",
  searchSrLabel: "検索",
  searchPlaceholder: "選手名 / チーム / 国籍 / カード ID",
  sortAriaLabel: "並び替え",
  positionFilterAriaLabel: "ポジションで絞り込み",
  positionFilterAll: "ポジション: すべて",
  cardTypeFilterAriaLabel: "カードタイプで絞り込み",
  cardTypeFilterAll: "カードタイプ: すべて",
  ownershipFilterAriaLabel: "所有状態で絞り込み",
  ownershipFilterAll: "所有状態: すべて",
  ownershipOwned: "所有済み",
  ownershipWanted: "欲しい",
  ownershipReleased: "手放した",
  ownershipUnknown: "未設定",
  inTeamFilterAriaLabel: "所有で絞り込み",
  inTeamFilterAll: "所有: すべて",
  inTeamFilterYes: "My Team にあり",
  inTeamFilterNo: "My Team になし",
  boosterFilterAriaLabel: "ブースターで絞り込み",
  boosterFilterAll: "ブースター: すべて",
  boosterFilterHas: "ブースターあり",
  boosterFilterPom: "Power of Many あり",
  clearFiltersButton: "条件をクリア",
  countTemplate: "{shown} / {total} 件",
  };

registerJaNamespace("userCardFilters", userCardFilters);

export default userCardFilters;
