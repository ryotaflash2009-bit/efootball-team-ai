import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 tierPackPreview（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const tierPackPreview: Dictionary["tierPackPreview"] = {
  pageTitle: "ティアリスト・パック（表示の試作）",
  pageDescription: "合成データだけで表示の形を確かめる試作です。外部のデータは取得・保存していません。",
  banner: "試作: 表示している名前と値はすべて架空です。外部の情報源は権利の確認が済むまで使いません。",
  tierHeading: "ティアリスト",
  packHeading: "パック",
  source: "情報源",
  updatedAt: "更新",
  rights: "権利",
  rights_synthetic: "合成（例）",
  rights_own_data: "自前のデータ",
  rights_pending: "確認待ち",
  rights_cleared: "確認済み",
  hiddenPending: "権利の確認待ちのため表示しません",
  period: "期間",
  jaOnlyNote: "表示例の文言は日本語だけです。",
  };

registerJaNamespace("tierPackPreview", tierPackPreview);

export default tierPackPreview;
