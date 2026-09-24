/**
 * Supabase参照データ経路の障害を、秘密情報を一切含まない形でサーバー側だけに記録する。
 *
 * - ログはこのファイルの`logReferenceDataFailure`に一元化する(呼び出し元へ散在させない)。
 * - 失敗時のみ記録する(成功リクエストは記録しない。全件記録するとノイズ・コストが増えるため)。
 * - 出力するのは固定フィールドだけ(event/operation/dataSource/errorCategory/statusCode/
 *   elapsedMs/pageIndex)。Errorオブジェクトそのもの、message全文、URL、スタックトレース、
 *   接続文字列、鍵、トークン、Cookie、SQL本文、ユーザー入力・検索語は一切含めない。
 * - ログ出力自体が失敗しても、呼び出し元のエラー処理を壊さない(必ずtry/catchで包む)。
 * - この関数はSupabase経路(dataSource: "supabase")の失敗専用。SQLite経路からは呼ばれない
 *   (SQLite側のエラー正規化は`@/lib/world/db.ts`の既存実装のままで、この観測基盤とは無関係)。
 */

/** 許可されたoperation識別子だけを使う(自由文字列を渡させない)。 */
export type ReferenceDataOperation =
  | "world.list"
  | "world.detail"
  | "world.byIds"
  | "world.image"
  | "world.facets"
  | "world.sourceMeta"
  | "managers.list"
  | "managers.detail"
  | "managers.count"
  | "managers.sourceMeta"
  | "analysis.detail";

/**
 * 実際に`@supabase/postgrest-js`(インストール済みバージョンのソースで確認済み)から
 * 取得できる情報だけを根拠に分類する。存在しないプロパティは参照しない。
 *
 * - ネットワーク断・タイムアウト(AbortSignal.timeout到達を含む)は、PostgrestBuilderの
 *   fetch失敗ハンドラで`status: 0`に正規化される(ライブラリソース確認済み)。
 * - 401/403/429/5xxは、PostgRESTが返す実際のHTTPステータスがそのまま`status`に入る。
 * - どちらとも判別できない場合は"unknown"にする(推測で埋めない)。
 */
export type ReferenceDataErrorCategory =
  | "timeout"
  | "network"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "server_error"
  | "malformed_response"
  | "schema_mismatch"
  | "upstream_request_rejected"
  | "unknown";

function messageOf(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "";
}

/**
 * `status`は、クエリ結果`{ data, error, status, statusText }`の`status`をそのまま渡すこと。
 * `error`オブジェクト自体には`status`が乗らない(ライブラリソース確認済み)ため、
 * 呼び出し側で結果の`status`を破棄せずここまで運ぶ必要がある。
 */
export function classifyReferenceDataFailure(status: number | undefined, err: unknown): ReferenceDataErrorCategory {
  if (status === undefined) return "unknown";
  if (status === 0) {
    // ライブラリはAbortError発生時、message先頭を`${fetchError.name}: ...`の形にする
    // (例: "AbortError: The operation was aborted")。timeoutかどうかはここでしか判別できない。
    return /abort|timeout/i.test(messageOf(err)) ? "timeout" : "network";
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status >= 500 && status < 600) return "server_error";
  return "unknown";
}

export interface ReferenceDataFailureContext {
  operation: ReferenceDataOperation;
  status?: number;
  elapsedMs?: number;
  pageIndex?: number;
}

/**
 * 唯一のログ出力箇所。失敗時のみ呼び出すこと(成功時は呼ばない)。
 * ログ出力自体が例外を投げても、呼び出し元(エラー正規化処理)を巻き込まない。
 */
export function logReferenceDataFailure(context: ReferenceDataFailureContext & { errorCategory: ReferenceDataErrorCategory }): void {
  try {
    const payload: Record<string, unknown> = {
      event: "reference_data_query_failed",
      operation: context.operation,
      dataSource: "supabase",
      errorCategory: context.errorCategory,
    };
    if (context.status !== undefined) payload.statusCode = context.status;
    if (context.elapsedMs !== undefined) payload.elapsedMs = context.elapsedMs;
    if (context.pageIndex !== undefined) payload.pageIndex = context.pageIndex;
    // eslint-disable-next-line no-console -- 唯一の集約ログ出力箇所
    console.error(JSON.stringify(payload));
  } catch {
    /* ログ出力の失敗が元のエラー処理を妨げないようにする */
  }
}
