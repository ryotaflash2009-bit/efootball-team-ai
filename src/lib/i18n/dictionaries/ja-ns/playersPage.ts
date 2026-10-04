import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 playersPage（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const playersPage: Dictionary["playersPage"] = {
  title: "プレイヤー",
  metaTemplate: "{count} 人の選手",
  descriptionTemplate: "eFootball World の全カードを検索・絞り込み。{importedAt}",
  importedAtPrefix: "取り込み: ",
  compareLink: "選手比較へ",
  noDataTitle: "World データがまだ用意されていません",
  noDataDescription: "ターミナルで `node scripts/sync-world-players-initial.mjs` を実行して SQLite に取り込んでください。",
  loadErrorTitle: "選手データを読み込めませんでした",
  loadErrorDescription: "時間をおいて再読み込みしてください。解決しない場合は SQLite の状態を確認してください。",
  noResultsTitle: "条件に一致する選手がいません",
  noResultsDescription: "検索語やフィルターを変えてみてください。フィルターのチップを押すと個別に解除できます。",
  clearAllFiltersButton: "すべての条件を解除",
  noCardsTitle: "表示できるカードがありません",
  noCardsDescription: "World データの取り込みを確認してください。",
  showingRangeTemplate: "{total} 人中 {from}〜{to} 人を表示",
  dataSourcePrefix: "データソース: ",
  defaultSourceName: "eFootball World",
  };

registerJaNamespace("playersPage", playersPage);

export default playersPage;
