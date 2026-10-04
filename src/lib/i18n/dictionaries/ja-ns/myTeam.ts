import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 myTeam（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const myTeam: Dictionary["myTeam"] = {
  pageTitle: "My Team",
  pageDescription: "実際に保有しているカードを管理し、育成ビルド・比較・スカッドへつなげます。お気に入りとは独立した管理です。",
  emptyTitle: "My Team にはまだカードがありません",
  emptyDescription: "所有しているカードを追加して、育成ビルドやスカッドへつなげられます。",
  findPlayersLink: "選手を探す",
  viewFavoritesLink: "お気に入りを見る",
  notAvailableNotice: "このブラウザでは保存できません。追加・変更はページを閉じると失われる可能性があります。",
  ownedCardCountLabel: "所有カード数",
  totalFavoriteCountLabel: "お気に入り数（全体）",
  mainCardCountLabel: "主力カード数",
  buildsSavedCountLabel: "TeamAIXI 内ビルド保存済み",
  buildsSavedNote: "「ビルド保存済み」は TeamAIXI 内の保存状態です。ゲーム内の実際の育成状態とは別です。",
  noResultsTitle: "条件に一致するカードがありません",
  noResultsDescription: "検索語やフィルターを変えてみてください。",
  clearFiltersButton: "条件をクリア",
  resolvingCards: "カード情報を解決中…",
  editButton: "編集",
  useInSquadLink: "スカッドで使用",
  removeFromMyTeamLabel: "My Team から削除",
  savedBuildHeading: "保存ビルド",
  selectedPrefix: "選択中: ",
  favoritePrefix: "お気に入り: ",
  noneLabel: "なし",
  buildMissingLabel: "見つかりません（削除済み）",
  savedCountSuffix: "保存 {count} 件",
  quickSelectLabel: "かんたん選択:",
  quickSelectNone: "なし",
  legacyRulesSuffix: "（旧規則）",
  chooseBuildButton: "保存ビルドを選ぶ",
  openInProgressionLink: "育成で開く",
  removeConfirmTitle: "My Team から削除しますか？",
  removeConfirmButton: "My Team から削除",
  removeConfirmBodyTemplate: "{name} を My Team から削除します。",
  removeConfirmNote: "お気に入り、保存した育成ビルド、保存スカッド、比較の状態は削除されません（関連付けだけ解除されます）。",
  customUsageSuffix: "・カスタム",
  starterUsageTemplate: "先発 {role}",
  captainUsageSuffix: "・C",
  benchUsageLabel: "ベンチ",
  selectedBuildAriaTemplate: "{name} の選択中ビルド",
  scopeLoadingMessage: "アカウント情報を確認しています…",
  legacyNoticeTemplate: "アカウント分離前に、このブラウザーへ保存されたMy Teamが{count}件あります。データは削除されていません。現在のアカウントで使用するには、ローカルデータ移行画面を開いてください。",
  migrationLinkLabel: "ローカルデータ移行画面を開く",
  };

registerJaNamespace("myTeam", myTeam);

export default myTeam;
