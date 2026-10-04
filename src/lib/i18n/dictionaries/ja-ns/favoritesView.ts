import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 favoritesView（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const favoritesView: Dictionary["favoritesView"] = {
  pageTitle: "お気に入り",
  pageDescription: "気になるカードを保存して、あとで育成・比較を確認できます。所有していないカードも登録できます。",
  emptyTitle: "お気に入りはまだありません",
  emptyDescription: "選手一覧や選手詳細の星アイコンから追加できます。所有していないカードも登録できます。",
  noResultsTitle: "条件に一致するお気に入りがありません",
  removeLabel: "お気に入り解除",
  scopeLoadingMessage: "アカウント情報を確認しています…",
  };

registerJaNamespace("favoritesView", favoritesView);

export default favoritesView;
