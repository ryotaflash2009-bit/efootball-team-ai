import { buildScopedStorageKey } from "@/lib/local-storage-scope/keys";
import { DATA_KINDS, type StorageScope } from "@/lib/local-storage-scope/types";

/**
 * 利用者自身によるアカウントの削除（2026-10-11）。サーバーの処理は Supabase の関数 `public.delete_my_account(confirm)`
 * （docs/production-readiness/sql/create-account-deletion.sql・apply package は account-deletion-apply-package.md）。
 *
 * - 公開の状態はコードの値。Production に関数を適用・検証した後（本人の操作）に PR で "enabled" に変える。既定は "disabled"（fail closed）:
 *   画面は削除の対象と手順の説明・サポートへの連絡の案内だけを出し、関数を呼ばない。
 * - 削除の対象の判定・他人のデータの保護はサーバーの関数が行う（auth.uid() だけ・引数で対象を受け取らない）。画面の確認は誤操作の防止。
 */
export type AccountDeletionMode = "disabled" | "enabled";
export const ACCOUNT_DELETION_MODE: AccountDeletionMode = "disabled";

/** サーバーの確認の文字列（関数の引数）。画面で入力させる語とは別（言語に依存しない）。 */
export const DELETE_CONFIRM_TOKEN = "DELETE";

/** 画面で入力させる確認の語（言語ごと・大文字小文字と前後の空白は無視）。 */
export function isConfirmPhraseValid(input: string, expected: string): boolean {
  const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();
  return norm(expected) !== "" && norm(input) === norm(expected);
}

/** ローカルのプレビュー（?deletionPreview=1・localhost だけ）。black-box でテストダブルを使って流れを検証する。 */
export function isAccountDeletionAvailable(
  hostname: string,
  search: string,
  isLocalDevHostname: (h: string) => boolean,
  mode: AccountDeletionMode = ACCOUNT_DELETION_MODE,
): boolean {
  if (mode === "enabled") return true;
  if (!isLocalDevHostname(hostname)) return false;
  return new URLSearchParams(search).get("deletionPreview") === "1";
}

export type AccountDeletionFailure = "reauth_required" | "confirmation_required" | "billing_active" | "not_authenticated" | "unavailable" | "failed";

/** rpc の失敗の一般化（生のエラー文は画面に出さない）。関数の例外の message は理由コードそのもの。 */
export function classifyAccountDeletionError(error: { message?: string | null; code?: string | null; status?: number | null } | null | undefined): AccountDeletionFailure {
  if (!error) return "failed";
  const m = error.message ?? "";
  if (m === "reauthentication_required") return "reauth_required";
  if (m === "confirmation_required") return "confirmation_required";
  if (m === "billing_active") return "billing_active";
  if (m === "not_authenticated" || error.status === 401) return "not_authenticated";
  // 関数がまだ無い（未適用）・認証サービスの障害
  if (error.code === "PGRST202" || error.code === "42883" || (typeof error.status === "number" && error.status >= 500)) return "unavailable";
  return "failed";
}

/** 成功の応答の検証（{ deleted: true } のときだけ成功とみなす）。 */
export function isDeletionSucceeded(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { deleted?: unknown }).deleted === true;
}

/**
 * この端末の、そのアカウントの領域（5 種類）を消す（本人が選んだときだけ）。ゲストの領域・アカウント分離前の共通データ・
 * 他のアカウントの領域には触れない。戻り値は消したキーの数。
 */
export function clearAccountLocalData(scope: StorageScope, storage: Pick<Storage, "removeItem" | "getItem"> | null): number {
  if (!storage || scope.kind !== "account") return 0;
  let n = 0;
  for (const kind of DATA_KINDS) {
    const key = buildScopedStorageKey(scope, kind);
    try {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key);
        n += 1;
      }
    } catch {
      /* 消せない環境は 0 件扱い */
    }
  }
  return n;
}
