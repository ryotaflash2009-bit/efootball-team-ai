import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 managersPage（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const managersPage: Dictionary["managersPage"] = {
  metaTemplate: "{count} 名の監督",
  descriptionTemplate: "データ提供: {source}。age・国籍・チーム・Coaching Affinity・フォーメーションはソース非収録。",
  importedAtPrefix: "取り込み: ",
  dataUnavailableTitle: "監督データがまだ用意されていません",
  dataUnavailableDescription: "ターミナルで `node scripts/sync-managers.mjs` を実行して SQLite に取り込んでください。",
  failedTitle: "監督データを読み込めませんでした",
  failedDescription: "時間をおいて再読み込みしてください。",
  noResultsTitle: "条件に一致する監督がいません",
  noResultsDescription: "検索語やフィルターを変えてみてください。",
  clearFiltersLink: "条件を解除",
  showingCountTemplate: "{total} 名中 {from}〜{to} 名を表示",
  prevPageLink: "前へ",
  nextPageLink: "次へ",
  pageOfTemplate: "{page} / {totalPages}",
  paginationAriaLabel: "ページ送り",
  };

registerJaNamespace("managersPage", managersPage);

export default managersPage;
