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
import { SearchInputRejectedError } from "@/lib/search/search-input";

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

function hasPostgrestErrorCode(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("code" in err)) return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && code.trim() !== "";
}

/**
 * 検索語付きの一覧クエリの失敗を正規化する。
 *
 * 上流(Supabase手前の防御)が検索リクエストだけを拒否した場合を、認証・RLS・権限の本当の失敗と
 * 取り違えないよう、次の全条件を満たすときだけ「検索入力の拒否」(SearchInputRejectedError)とする:
 *   1. 検索語がある
 *   2. HTTP 403
 *   3. PostgREST/PostgreSQLのerror codeを持たない(本当の権限エラーは42501・PGRST3xx等のcodeを持つ)
 *   4. 同じ条件から検索語だけを外した確認クエリ(件数のみ)は成功する(=拒否は検索語に起因する)
 * それ以外(401・429・5xx・code付き403・確認クエリも失敗)は既存どおりWorldQueryError。
 * 利用者向けの内容は定型文だけで、上流の本文はログにも応答にも含めない(ログは安全なreason codeのみ)。
 */
export async function normalizeSearchQueryFailure(
  err: unknown,
  context: QueryErrorContext,
  searchTerm: string | null | undefined,
  probeWithoutSearchTerm: () => PromiseLike<{ error: unknown; status?: number }>,
): Promise<WorldQueryError | SearchInputRejectedError> {
  if (!searchTerm || context.status !== 403 || hasPostgrestErrorCode(err)) return normalizeQueryError(err, context);
  let probe: { error: unknown; status?: number };
  try {
    probe = await probeWithoutSearchTerm();
  } catch {
    return normalizeQueryError(err, context);
  }
  if (probe.error) return normalizeQueryError(err, context);
  logReferenceDataFailure({ ...context, errorCategory: "upstream_request_rejected" });
  return new SearchInputRejectedError("rejected_by_upstream");
}
