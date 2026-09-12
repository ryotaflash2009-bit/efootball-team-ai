/**
 * オープンリダイレクト対策: 「アプリ内の相対パス」だけを遷移先として許可する純関数。
 *
 * サインインの`redirectTo`クエリや、認証コールバックの遷移先など、
 * 外部から渡された文字列を遷移先として使う場合は必ずこれを通す。
 * `//evil.example.com`(プロトコル相対URL)や`https://evil.example.com`のような
 * 外部URL、`javascript:`のようなスキーム付き文字列は一切許可しない。
 */

const DEFAULT_SAFE_PATH = "/account";

/** U+0000-U+001F, U+007F (制御文字)を検出する。 */
const CONTROL_CHAR_RE = new RegExp("[\\u0000-\\u001F\\u007F]");

function isSafeInternalPath(value: string): boolean {
  if (value.length === 0) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false; // プロトコル相対URL
  if (value.startsWith("/\\")) return false; // バックスラッシュを使った回避策
  if (/\s/.test(value)) return false;
  if (value.includes("://")) return false;
  if (CONTROL_CHAR_RE.test(value)) return false;
  return true;
}

/** 未検証の文字列を受け取り、安全な内部パスのみ返す。それ以外は既定の遷移先へフォールバックする。 */
export function resolveSafeInternalPath(raw: string | null | undefined, fallback: string = DEFAULT_SAFE_PATH): string {
  if (typeof raw !== "string") return fallback;
  return isSafeInternalPath(raw) ? raw : fallback;
}
