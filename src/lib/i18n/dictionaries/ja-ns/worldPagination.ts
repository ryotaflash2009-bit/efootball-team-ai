import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 worldPagination（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const worldPagination: Dictionary["worldPagination"] = {
  ariaLabel: "ページ送り",
  rangeTemplate: "{total} 件中 {from}〜{to} 件を表示",
  prevLabel: "← 前へ",
  nextLabel: "次へ →",
  pageOfTemplate: "{page} / {totalPages}",
  };

registerJaNamespace("worldPagination", worldPagination);

export default worldPagination;
