import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 tagEditor（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const tagEditor: Dictionary["tagEditor"] = {
  duplicateTag: "同じタグがすでにあります",
  maxTagsTemplate: "タグは最大 {max} 個です",
  labelTemplate: "タグ（任意・最大 {maxTags} 個・1 個 {maxLen} 文字まで）",
  removeTagAriaTemplate: "タグ「{tag}」を削除",
  placeholder: "例: 主力 / ドリブラー / 育成候補",
  addButton: "追加",
  };

registerJaNamespace("tagEditor", tagEditor);

export default tagEditor;
