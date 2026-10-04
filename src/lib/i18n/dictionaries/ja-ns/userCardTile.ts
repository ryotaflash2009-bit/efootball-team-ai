import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 userCardTile（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const userCardTile: Dictionary["userCardTile"] = {
  compareAddedMsg: "比較へ追加しました",
  compareAlreadyMsg: "すでに比較にあります",
  compareFullMsg: "比較は最大人数です",
  compareFailedMsg: "追加できませんでした",
  resolvingCardInfo: "カード情報を解決中…",
  boosterGold: "金",
  boosterBlue: "青",
  noBuildsSaved: "TeamAIXI 内ビルドなし",
  selectedBuildTemplate: "選択中ビルド: {name}（保存 {count} 件）",
  buildsSavedTemplate: "TeamAIXI 内ビルド保存済み（{count} 件）",
  usedInSquadsCountTemplate: "{count} スカッドで使用中: ",
  detailLink: "詳細",
  progressionLink: "育成",
  addToCompareButton: "比較へ追加",
  defaultRemoveLabel: "解除",
  ownershipOwned: "所有済み",
  ownershipWanted: "欲しい",
  ownershipReleased: "手放した",
  ownershipUnknown: "未設定",
  usageMain: "主力",
  usageRotation: "ローテーション",
  usageReserve: "控え",
  usageUnused: "未使用",
  usageUnknown: "未設定",
  };

registerJaNamespace("userCardTile", userCardTile);

export default userCardTile;
