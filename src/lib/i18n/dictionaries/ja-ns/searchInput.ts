import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 searchInput（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const searchInput: Dictionary["searchInput"] = {
  rejectedTitle: "この検索語では検索できません",
  rejectedDescription: "記号や特殊な文字を減らして、もう一度お試しください。",
  clearSearch: "検索条件をクリア",
  };

registerJaNamespace("searchInput", searchInput);

export default searchInput;
