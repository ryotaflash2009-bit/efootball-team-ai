/**
 * アプリ本体が参照データ(World選手カード・監督・カード分析)をどこから読むかを解決する。
 *
 * - 既定は"supabase"(Phase E、`docs/production-readiness/app-hybrid-switch-implementation-plan.md`
 *   2章)。Phase D(全件シャドー比較、差分0件)完了済みを前提に切り替えている。
 *   `WORLD_DATA_SOURCE=sqlite`を明示指定すれば、コード変更なしに即座に旧経路へ戻せる
 *   (`docs/production-readiness/reference-data-supabase-default-readiness-runbook.md`6章)。
 * - `WORLD_DATA_SOURCE`は`NEXT_PUBLIC_`を付けず、サーバー側(API Route・Server Component)
 *   からのみ読む。クライアントバンドルへは含まれない。
 * - 大文字小文字を曖昧に処理しない("Sqlite"等は不正値として拒否する)。
 * - 空文字・未設定はいずれも「既定値(supabase)」として明確に扱う(意図的な選択、あいまいさを残さない)。
 * - "sqlite"/"supabase"以外の値は、設定ミスを見逃さないため安全に例外を投げる
 *   (黙って既定値へフォールバックしない。フォールバックすると、SQLiteへ切り戻したつもりの
 *   設定ミスが本番で気づかれないまま放置される恐れがあるため)。
 * - Supabase経路が環境変数不足・障害等で利用できない場合も、SQLiteへの暗黙フォールバックは
 *   行わない(呼び出し元が`WorldDataUnavailableError`/`WorldQueryError`を安全に返す)。
 */

export type WorldDataSource = "sqlite" | "supabase";

export const DEFAULT_WORLD_DATA_SOURCE: WorldDataSource = "supabase";

export class InvalidWorldDataSourceError extends Error {
  readonly code = "INVALID_WORLD_DATA_SOURCE";
  constructor() {
    // 実際に渡された値はメッセージへ含めない(万一の秘密情報混入を防ぐ多層防御。
    // 通常この環境変数に秘密情報が入ることは想定していないが、値を由来問わず表示しない方針を統一する)。
    super('WORLD_DATA_SOURCE has an unsupported value (allowed values: "sqlite" or "supabase")');
    this.name = "InvalidWorldDataSourceError";
  }
}

/** 生の環境変数値から、型安全なデータソース識別子を解決する(純関数、環境変数を直接読まない)。 */
export function resolveWorldDataSource(raw: string | undefined | null): WorldDataSource {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return DEFAULT_WORLD_DATA_SOURCE;
  if (trimmed === "sqlite") return "sqlite";
  if (trimmed === "supabase") return "supabase";
  throw new InvalidWorldDataSourceError();
}

/** 実行時の`process.env.WORLD_DATA_SOURCE`から解決する(サーバー専用コードからのみ呼び出すこと)。 */
export function getWorldDataSource(): WorldDataSource {
  return resolveWorldDataSource(process.env.WORLD_DATA_SOURCE);
}
