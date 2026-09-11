import { downloadTextFile } from "./browser-download";

/**
 * 対応ブラウザーでは File System Access API（`showSaveFilePicker`）でユーザーに保存場所を選ばせ、
 * 非対応・失敗・例外時は既存 `browser-download.ts` の Blob + `<a download>` 方式へ安全にフォールバックする。
 *
 * - **保存先はユーザーが選ぶ**。アプリが Windows の「ドキュメント」フォルダーやその他の絶対パスを
 *   コードへ埋め込む・推測する・強制することは一切しない（`startIn: "documents"` は OS 標準の
 *   「候補ディレクトリ」ヒートに過ぎず、ユーザーはピッカー内で自由に別の場所へ移動・キャンセルできる）。
 * - ユーザーがピッカーをキャンセルした場合（`AbortError`）は、エラーでも成功でもない `reason:"cancelled"`
 *   として区別する。
 * - `write` → `close` の順で行い、両方成功したときだけ `ok:true` を返す。`FileSystemFileHandle` は
 *   関数のローカル変数としてのみ扱い、どこにも永続化しない（localStorage / IndexedDB へは保存しない）。
 * - `showSaveFilePicker` はユーザー操作（クリックハンドラー）から**同期的に**呼び出すこと
 *   （呼び出し前に `await` を挟むとユーザーアクティベーションが失われ、ブラウザーによっては失敗する）。
 * - SSR / hydration 前（`window` 不在）では何もせず `{ ok:false, reason:"ssr" }` を返す。
 */

export interface FileSystemWritableFileStreamLike {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}
export interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}
export interface ShowSaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  /** OS 標準の「候補ディレクトリ」（絶対パスではない・ユーザーは自由に変更できる）。 */
  startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
}
export type ShowSaveFilePicker = (options?: ShowSaveFilePickerOptions) => Promise<FileSystemFileHandleLike>;

/** この環境で `showSaveFilePicker` が使えるかどうか（同期・副作用なし）。 */
export function isSaveFilePickerSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { showSaveFilePicker?: unknown };
  return typeof w.showSaveFilePicker === "function";
}

function getPicker(): ShowSaveFilePicker | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { showSaveFilePicker?: ShowSaveFilePicker };
  return typeof w.showSaveFilePicker === "function" ? w.showSaveFilePicker : null;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === "AbortError";
  return typeof err === "object" && err !== null && "name" in err && (err as { name?: unknown }).name === "AbortError";
}

export type SaveTextFileMethod = "picker" | "download";

export type SaveTextFileOutcome =
  | { ok: true; method: SaveTextFileMethod }
  | { ok: false; reason: "cancelled"; method: "picker" }
  | { ok: false; reason: "ssr" | "error"; method: SaveTextFileMethod };

export interface SaveTextFileOptions {
  mimeType?: string;
  /** ピッカーのファイル種類フィルターに出す説明（例:「JSON ファイル」）。 */
  typeDescription?: string;
  /** `.json` のような拡張子（先頭のドットを含む）。 */
  extension?: string;
  /** OS 標準の候補ディレクトリ（`showSaveFilePicker` 対応時のみ有効・絶対パスではない）。 */
  startIn?: ShowSaveFilePickerOptions["startIn"];
}

/**
 * `text` を `filename` として保存する。
 * 対応ブラウザー: `showSaveFilePicker` でユーザーに保存場所を選ばせる。
 * 非対応・例外時: 既存 `downloadTextFile`（Blob + `<a download>`）へフォールバック。
 */
export async function saveTextFile(
  filename: string,
  text: string,
  opts: SaveTextFileOptions = {},
): Promise<SaveTextFileOutcome> {
  const mimeType = opts.mimeType ?? "application/json";

  if (typeof window === "undefined") {
    return { ok: false, reason: "ssr", method: "picker" };
  }

  const picker = getPicker();
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: opts.typeDescription ?? "JSON ファイル", accept: { [mimeType]: [opts.extension ?? ".json"] } }],
        ...(opts.startIn ? { startIn: opts.startIn } : {}),
      });
      const writable = await handle.createWritable();

      try {
        await writable.write(text);
      } catch {
        try {
          await writable.close();
        } catch {
          /* 書き込み失敗が主因のため close 側のエラーは握りつぶす */
        }
        return { ok: false, reason: "error", method: "picker" };
      }

      try {
        await writable.close();
      } catch {
        return { ok: false, reason: "error", method: "picker" };
      }

      return { ok: true, method: "picker" };
    } catch (err) {
      if (isAbortError(err)) return { ok: false, reason: "cancelled", method: "picker" };
      return { ok: false, reason: "error", method: "picker" };
    }
  }

  const dl = downloadTextFile(filename, text, mimeType);
  return dl.ok ? { ok: true, method: "download" } : { ok: false, reason: dl.reason ?? "error", method: "download" };
}
