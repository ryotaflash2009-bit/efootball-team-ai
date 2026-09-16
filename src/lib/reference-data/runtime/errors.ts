/**
 * Supabase(PostgREST)呼び出しの失敗を、既存のエラークラス(`src/lib/world/db.ts`)へ安全に正規化する。
 *
 * - 通常利用者へは常に定型の安全な日本語メッセージだけを見せる(既存エラークラスのdefaultメッセージを
 *   そのまま使う)。接続先URL・Project ref・テーブル名・SQL・スタックトレースは一切含めない。
 * - 環境変数未設定・クライアント生成失敗 → WorldDataUnavailableError
 *   (「そもそもデータへ到達できない」という既存のSQLite欠落時と同じ意味に揃える)。
 * - それ以外の通信・クエリ失敗(タイムアウト・DNS・TLS・4xx/5xx・不正レスポンス等)
 *   → WorldQueryError(「クエリに失敗した」という既存の意味に揃える)。
 * - 正規化と同時に、`observability.ts`経由でサーバー側だけの障害ログ(秘密情報を含まない)を
 *   1箇所に集約して記録する。ログ出力はベストエフォートで、失敗しても外部へ返す例外の種類は
 *   一切変えない(既存の呼び出し元・利用者からは見た目上の挙動が変わらない)。
 */
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";
import { ReferenceDataEnvError } from "./supabase-client";
import { classifyReferenceDataFailure, logReferenceDataFailure, type ReferenceDataOperation } from "./observability";

export interface PostgrestLikeError {
  code?: string;
  message?: string;
}

export interface ClientErrorContext {
  operation: ReferenceDataOperation;
}

export interface QueryErrorContext {
  operation: ReferenceDataOperation;
  /** クエリ結果`{ data, error, status }`の`status`をそのまま渡すこと(`error`自体には乗らない)。 */
  status?: number;
  elapsedMs?: number;
  pageIndex?: number;
}

/** クライアント生成自体の失敗(環境変数未設定・不正)を安全に正規化する。 */
export function normalizeClientError(err: unknown, context: ClientErrorContext): WorldDataUnavailableError {
  // クライアント生成失敗はHTTPレスポンスを伴わない設定不備のため、ステータスで分類できない。
  logReferenceDataFailure({ operation: context.operation, errorCategory: "unknown" });
  if (err instanceof ReferenceDataEnvError) return new WorldDataUnavailableError();
  return new WorldDataUnavailableError();
}

/** クエリ実行(PostgREST)由来のエラーを安全に正規化する。 */
export function normalizeQueryError(err: PostgrestLikeError | Error | unknown, context: QueryErrorContext): WorldQueryError {
  const errorCategory = classifyReferenceDataFailure(context.status, err);
  logReferenceDataFailure({ ...context, errorCategory });
  return new WorldQueryError();
}
