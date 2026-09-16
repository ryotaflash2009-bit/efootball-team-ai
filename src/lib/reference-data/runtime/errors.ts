/**
 * Supabase(PostgREST)呼び出しの失敗を、既存のエラークラス(`src/lib/world/db.ts`)へ安全に正規化する。
 *
 * - 通常利用者へは常に定型の安全な日本語メッセージだけを見せる(既存エラークラスのdefaultメッセージを
 *   そのまま使う)。接続先URL・Project ref・テーブル名・SQL・スタックトレースは一切含めない。
 * - 環境変数未設定・クライアント生成失敗 → WorldDataUnavailableError
 *   (「そもそもデータへ到達できない」という既存のSQLite欠落時と同じ意味に揃える)。
 * - それ以外の通信・クエリ失敗(タイムアウト・DNS・TLS・4xx/5xx・不正レスポンス等)
 *   → WorldQueryError(「クエリに失敗した」という既存の意味に揃える)。
 */
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";
import { ReferenceDataEnvError } from "./supabase-client";

export interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/** クライアント生成自体の失敗(環境変数未設定・不正)を安全に正規化する。 */
export function normalizeClientError(err: unknown): WorldDataUnavailableError {
  if (err instanceof ReferenceDataEnvError) return new WorldDataUnavailableError();
  return new WorldDataUnavailableError();
}

/** クエリ実行(PostgREST)由来のエラーを安全に正規化する。 */
export function normalizeQueryError(_err: PostgrestLikeError | Error | unknown): WorldQueryError {
  // 理由分類はログ(サーバー側のみ、秘密情報を含まない範囲)に残す余地を将来的に持たせるが、
  // 利用者・API応答へはいずれの場合も定型の安全なメッセージだけを返す。
  return new WorldQueryError();
}
