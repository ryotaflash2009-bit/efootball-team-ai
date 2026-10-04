import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 myBuildCard（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const myBuildCard: Dictionary["myBuildCard"] = {
  selectPlayerDetailAriaTemplate: "{name} の選手詳細",
  cardImageAltResolving: "カード画像（解決中）",
  maxBaseOvrTemplate: "最大 {max} / 基礎 {base}",
  fetchFailedNote: "カード情報を取得できませんでした。時間をおいて再読み込みしてください（ビルドは保持されています）。",
  allocationHeading: "育成配分",
  viewAllAllocationsSummary: "全配分（10カテゴリ）を見る",
  legacyBuildWarningTemplate: "旧規則ビルド（rulesVersion: {version}）。現行規則への自動変換は行っていません。",
  playerBoosterEstimateTemplate: "選手ブースター試算あり（ID {id}・確認済みのゲーム内仕様ではありません）",
  estimatedOvrTemplate: "保存時の推定OVR: {ovr}（{mode}）",
  usageHeading: "使用状況",
  squadUsingSuffixTemplate: "（{areas}）で使用中",
  squadUsingLinkTemplate: "スカッド「{name}」",
  noUsageLabel: "参照なし",
  playerDetailLink: "選手詳細",
  openProgressionLink: "育成で開く",
  addToCompareButton: "比較へ追加",
  useInSquadLink: "スカッドで使用",
  myTeamIntegrationHeading: "My Team 連携",
  notInMyTeamLabel: "My Team未登録（このカードは My Team にありません）",
  registerToMyTeamButton: "My Teamに登録",
  openMyTeamLink: "My Team を開く",
  registerHintNote: "登録時に所有状態・使用状態と、このビルドを選択中ビルド／お気に入りビルドにするかを選べます。既存スカッド・カード自体のお気に入りは変更されません。",
  selectedBuildLabel: "選択中ビルド:",
  selectedInMyTeamBadge: "My Team で選択中",
  clearSelectionButton: "選択を解除",
  useInMyTeamButton: "My Team で使用",
  favoriteBuildLabel: "お気に入りビルド:",
  favoriteInMyTeamBadge: "My Team のお気に入りビルド",
  clearFavoriteButton: "お気に入りを解除",
  setFavoriteButton: "お気に入りビルドに設定",
  favoriteHintNote: "これは保存ビルドのお気に入り設定です。カード自体のお気に入り状態・既存スカッドは変更されません。",
  renameButton: "名前を変更",
  duplicateButton: "複製",
  deleteButton: "削除",
  };

registerJaNamespace("myBuildCard", myBuildCard);

export default myBuildCard;
