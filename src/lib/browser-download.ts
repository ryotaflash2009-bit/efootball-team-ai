/**
 * ブラウザー内だけでテキストファイルをユーザー端末へ保存させる最小ユーティリティ。
 *
 * - クライアント専用。サーバー API・外部アクセス・アップロードは一切しない。
 * - SSR / hydration 前（`window` / `document` 不在）では **false を返すだけ**で何もしない。
 * - Blob と Object URL を使い、生成した一時要素と Object URL は必ず後始末する。
 * - ダウンロード内容を console へ出さない。
 */

export interface DownloadResult {
  ok: boolean;
  /** 失敗理由（ok=false のとき）。"ssr" | "error"。 */
  reason?: "ssr" | "error";
}

/**
 * `text` を `filename` として保存させる。既定 MIME は `application/json`。
 * 成功したら `{ ok: true }`、SSR なら `{ ok: false, reason: "ssr" }`、例外時は `{ ok: false, reason: "error" }`。
 */
export function downloadTextFile(
  filename: string,
  text: string,
  mimeType = "application/json",
): DownloadResult {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return { ok: false, reason: "ssr" };
  }

  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;
  try {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    url = URL.createObjectURL(blob);
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  } finally {
    if (anchor && anchor.parentNode) anchor.parentNode.removeChild(anchor);
    if (url) {
      const toRevoke = url;
      // クリック直後に revoke するとダウンロードが始まらないブラウザーがあるため、少し遅らせる。
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(toRevoke);
        } catch {
          /* noop */
        }
      }, 10_000);
    }
  }
}
