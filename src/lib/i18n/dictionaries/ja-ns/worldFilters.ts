import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 worldFilters（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const worldFilters: Dictionary["worldFilters"] = {
  sortOvrMaxDesc: "最大OVR 高い順",
  sortOvrMaxAsc: "最大OVR 低い順",
  sortOvrBaseDesc: "基礎OVR 高い順",
  sortOvrBaseAsc: "基礎OVR 低い順",
  sortName: "名前順（英語）",
  sortUpdatedDesc: "更新が新しい順",
  filterLabelQ: "検索",
  filterLabelPosition: "ポジション",
  filterLabelCardType: "カードタイプ",
  filterLabelPlayingStyle: "攻撃PS",
  filterLabelPlayingStyleDef: "守備PS",
  filterLabelMinOvr: "最大OVR ≥",
  filterLabelMaxOvr: "最大OVR ≤",
  filterLabelBooster: "ブースター",
  searchPlaceholder: "日本語名・英語名・World ID・eFHUB ID",
  searchAriaLabel: "選手を検索",
  sortAriaLabel: "並べ替え",
  filterToggleTemplate: "フィルター{count}",
  positionAriaLabel: "ポジション",
  positionAll: "ポジション: 全て",
  cardTypeAriaLabel: "カードタイプ",
  cardTypeAll: "タイプ: 全て",
  playingStyleAriaLabel: "攻撃プレースタイル",
  playingStyleAll: "攻撃PS: 全て",
  playingStyleDefAriaLabel: "守備プレースタイル",
  playingStyleDefAll: "守備PS: 全て",
  minOvrPlaceholder: "最大OVR ≥",
  minOvrAriaLabel: "最大OVR 下限",
  maxOvrPlaceholder: "最大OVR ≤",
  maxOvrAriaLabel: "最大OVR 上限",
  clearAllButton: "すべて解除",
  };

registerJaNamespace("worldFilters", worldFilters);

export default worldFilters;
