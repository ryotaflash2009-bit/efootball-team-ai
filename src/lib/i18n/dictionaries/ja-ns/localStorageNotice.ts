import type { Dictionary } from "../ja";
import { registerJaNamespace } from "../ja-registry";

/** 日本語の辞書の名前空間 localStorageNotice（2026-10-04: 全画面の初回 JS から外し、使う画面だけが読み込む）。 */
const localStorageNotice: Dictionary["localStorageNotice"] = {
  whatFavorites: "お気に入り",
  whatMyTeam: "My Team",
  whatBuilds: "保存した育成ビルド",
  whatFavoritesAndMyTeam: "お気に入りと My Team",
  bodyPrefixTemplate: "{what}は、現在",
  bodyBold: "このブラウザにのみ",
  bodySuffix:
    "保存されます。別の端末との同期やバックアップ、サーバーへの保存には未対応です。ログイン・アカウント同期は今後のバージョンで対応予定です。",
  bodySuffixMyTeam:
    "保存されます。ログイン後は、アカウント画面から明示的な操作でMy Teamをクラウドへ保存・取得できる試験機能（アルファ）を利用できます。端末間の自動同期ではありません。",
  };

registerJaNamespace("localStorageNotice", localStorageNotice);

export default localStorageNotice;
