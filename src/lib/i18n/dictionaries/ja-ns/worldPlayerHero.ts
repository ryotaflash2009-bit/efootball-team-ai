import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 worldPlayerHero（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const worldPlayerHero: Dictionary["worldPlayerHero"] = {
  backToList: "プレイヤー一覧へ",
  noImage: "画像なし（NO IMAGE）",
  maxOvrLabel: "最大 OVR",
  baseAndCapTemplate: "基礎 {base} / Lv上限 {cap}",
  noEnglishName: "（英語名なし）",
  idBadgeTemplate: "ID {id}",
  baseOvrLabel: "基礎OVR",
  maxOvrFactLabel: "最大OVR",
  maxLevelLabel: "最大レベル",
  preferredFootLabel: "利き足",
  heightWeightTemplate: "身長 / 体重",
  teamLabel: "チーム",
  };

registerJaNamespace("worldPlayerHero", worldPlayerHero);

export default worldPlayerHero;
