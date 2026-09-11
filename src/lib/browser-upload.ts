/**
 * ブラウザーで選択されたテキストファイルを安全に読み込む最小ユーティリティ。
 *
 * - クライアント専用。SSR（`window` 不在）や File API 不在では読み込まず理由を返す。
 * - サーバー / 外部へ送信しない。`eval` / `Function` / 動的 import を使わない。
 * - サイズ上限を超えるファイルは**読み込む前に**拒否する（`file.size`）。
 * - 例外は握りつぶして安全な理由コードにする（内容・パスは返さない）。
 */

export type ReadUploadedTextReason = "ssr" | "no-file-api" | "too-large" | "read-error";

export type ReadUploadedTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: ReadUploadedTextReason };

export async function readUploadedTextFile(
  file: File | null | undefined,
  maxBytes: number,
): Promise<ReadUploadedTextResult> {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  if (!file || typeof (file as File).text !== "function") return { ok: false, reason: "no-file-api" };

  if (typeof file.size === "number" && file.size > maxBytes) {
    return { ok: false, reason: "too-large" };
  }

  try {
    const text = await file.text();
    if (typeof text !== "string") return { ok: false, reason: "read-error" };
    // file.size が取れない環境向けの二重チェック
    let bytes: number;
    try {
      bytes = new TextEncoder().encode(text).length;
    } catch {
      bytes = text.length;
    }
    if (bytes > maxBytes) return { ok: false, reason: "too-large" };
    return { ok: true, text };
  } catch {
    return { ok: false, reason: "read-error" };
  }
}
