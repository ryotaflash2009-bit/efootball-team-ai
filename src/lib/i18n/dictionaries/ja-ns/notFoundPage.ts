import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 notFoundPage（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const notFoundPage: Dictionary["notFoundPage"] = {
  title: "ページが見つかりません",
  description: "指定されたページまたは選手は存在しないか、移動された可能性があります。",
  playersLink: "プレイヤー一覧へ",
  };

registerJaNamespace("notFoundPage", notFoundPage);

export default notFoundPage;
