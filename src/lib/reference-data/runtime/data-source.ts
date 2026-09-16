/**
 * アプリ本体が参照データ(World選手カード・監督・カード分析)をどこから読むかを解決する。
 *
 * - 既定は"sqlite"(現状維持)。`WORLD_DATA_SOURCE`は`NEXT_PUBLIC_`を付けず、
 *   サーバー側(API Route・Server Component)からのみ読む。クライアントバンドルへは含まれない。
 * - 大文字小文字を曖昧に処理しない("Sqlite"等は不正値として拒否する)。
 * - 空文字・未設定はいずれも「既定値(sqlite)」として明確に扱う(意図的な選択、あいまいさを残さない)。
 * - "sqlite"/"supabase"以外の値は、設定ミスを見逃さないため安全に例外を投げる
 *   (黙って既定値へフォールバックしない。フォールバックすると、Supabaseへ切り替えたつもりの
 *   設定ミスが本番で気づかれないまま放置される恐れがあるため)。
 */

export type WorldDataSource = "sqlite" | "supabase";

export const DEFAULT_WORLD_DATA_SOURCE: WorldDataSource = "sqlite";

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
