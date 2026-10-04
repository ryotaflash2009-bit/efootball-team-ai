import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 duplicateReviewTeaser（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const duplicateReviewTeaser: Dictionary["duplicateReviewTeaser"] = {
  bodyPrefix: "JSON インポートや複製で増えた可能性がある保存ビルドの",
  duplicateCandidatesLabel: "重複候補",
  bodySuffix: "は、保存ビルド分析（Build Inventory）で安全に確認できます。この画面からは削除・統合・上書きしません。",
  openInventoryLink: "Build Inventory で重複候補を確認",
  };

registerJaNamespace("duplicateReviewTeaser", duplicateReviewTeaser);

export default duplicateReviewTeaser;
