import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 compareAddButton（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const compareAddButton: Dictionary["compareAddButton"] = {
  fullMessageTemplate: "比較は最大{max}人です",
  removeFromCompareAria: "比較から外す",
  addToCompareAria: "比較へ追加",
  inCompareLabel: "比較中",
  compareFullLabel: "比較満員",
  addToCompareLabel: "比較へ追加",
  inCompareCheckedLabel: "比較中 ✓",
  viewCompareTemplate: "比較を見る ({count})",
  };

registerJaNamespace("compareAddButton", compareAddButton);

export default compareAddButton;
