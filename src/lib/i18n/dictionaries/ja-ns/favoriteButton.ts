import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 favoriteButton（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const favoriteButton: Dictionary["favoriteButton"] = {
  saveFailedFallback: "保存できませんでした",
  removeLabel: "お気に入りから解除",
  addLabel: "お気に入りに追加",
  favoritedCompactLabel: "お気に入り済み",
  notFavoritedCompactLabel: "お気に入り",
  favoritedLabel: "お気に入り済み",
  addFavoriteLabel: "お気に入りに追加",
  unavailableNote: "このブラウザでは保存できません（閉じると失われます）",
  };

registerJaNamespace("favoriteButton", favoriteButton);

export default favoriteButton;
