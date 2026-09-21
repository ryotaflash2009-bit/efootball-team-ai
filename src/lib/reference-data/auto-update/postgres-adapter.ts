import type { QueryClient, QueryResult } from "./apply-orchestrator";
import { POSTGRES_TEST_SCHEMA } from "./postgres-staging";

/**
 * Phase 2: PostgreSQL隔離検証専用アダプター(GitHub Actions service container専用)。
 *
 * **接続先の安全性はここで構造的に強制する**:
 *   - ホストは`localhost`/`127.0.0.1`のみ許可。Supabaseを含むあらゆる外部ホストは拒否する。
 *   - データベース名はテスト専用ホワイトリスト(`phase2_test_db`)または隔離schema名と
 *     同名(`reference_data_ops_test`)のみ許可する。
 *   - `SUPABASE_`/`DATABASE_URL`等の既存Production環境変数は一切読まない。専用の
 *     `PHASE2_TEST_PG_*`環境変数だけを読む(CI service container起動時にworkflow内の
 *     非機密固定値として設定される想定)。
 *   - 接続情報(パスワード含む)をログへ出力する処理はこのファイルに存在しない。
 *
 * Production向けのPostgreSQL adapterはこのファイルではない(実装していない)。
 */

export interface PostgresTestConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);
const ALLOWED_DATABASES = new Set(["phase2_test_db", POSTGRES_TEST_SCHEMA]);

/** 接続先が安全なテスト専用ターゲットであることを確認する。違反時は例外を投げる。 */
export function assertSafeTestConnectionTarget(config: PostgresTestConnectionConfig): void {
  if (!ALLOWED_HOSTS.has(config.host)) {
    throw new Error(`許可されていない接続先ホスト(localhost/127.0.0.1以外は拒否): ${config.host}`);
  }
  if (/supabase/i.test(config.host) || /supabase/i.test(config.database)) {
    throw new Error("Supabase関連のホスト名/データベース名は許可されていない");
  }
  if (!ALLOWED_DATABASES.has(config.database)) {
    throw new Error(`許可されていないデータベース名: ${config.database}(ホワイトリスト外)`);
  }
}

/**
 * `PHASE2_TEST_PG_*`環境変数だけから接続設定を組み立てる(既存のSupabase/Production環境変数は
 * 一切参照しない)。GitHub ActionsのPostgreSQL integrationジョブ以外では、これらの環境変数は
 * 設定されていないため、この関数は呼び出されない(通常のUnit Testはこの関数を使わない)。
 */
export function buildTestOnlyPgConfigFromEnv(env: Readonly<Record<string, string | undefined>>): PostgresTestConnectionConfig {
  const host = env.PHASE2_TEST_PG_HOST ?? "localhost";
  const port = Number(env.PHASE2_TEST_PG_PORT ?? "5432");
  const user = env.PHASE2_TEST_PG_USER ?? "";
  const password = env.PHASE2_TEST_PG_PASSWORD ?? "";
  const database = env.PHASE2_TEST_PG_DATABASE ?? "";
  if (!user || !password || !database) {
    throw new Error("PHASE2_TEST_PG_USER / PHASE2_TEST_PG_PASSWORD / PHASE2_TEST_PG_DATABASE が未設定");
  }
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`PHASE2_TEST_PG_PORTが不正: ${env.PHASE2_TEST_PG_PORT}`);
  }
  const config: PostgresTestConnectionConfig = { host, port, user, password, database };
  assertSafeTestConnectionTarget(config);
  return config;
}

/** `pg.Client`互換の最小インターフェース(実際の型は`pg`パッケージ、テスト側で注入する)。 */
export interface MinimalPgClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/**
 * jsonb列はnode-postgresが既定でJS objectへ自動パースするため、SQLite adapter
 * (fields_jsonを文字列のまま返す)との契約を揃えるために、object値をJSON文字列へ
 * 戻してから呼び出し元(apply-orchestrator.ts/rollback.ts、いずれもSQLite想定のまま
 * 変更していない)へ渡す。
 */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value !== null && typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value;
  }
  return out;
}

/**
 * `apply-orchestrator.ts`/`rollback.ts`のSQL文字列(SQLite方言、`?`プレースホルダー、
 * 非修飾テーブル名)を、一切変更せずにPostgreSQLへ流すためのアダプター。
 * - `?`をPostgreSQLの`$1,$2,...`へ変換する。
 * - セッションの`search_path`を隔離schemaへ設定し、非修飾テーブル名を解決させる。
 */
export function createPostgresQueryClient(pgClient: MinimalPgClient): QueryClient {
  let searchPathReady: Promise<void> | null = null;

  async function ensureSearchPath(): Promise<void> {
    if (!searchPathReady) {
      searchPathReady = pgClient.query(`set search_path to ${POSTGRES_TEST_SCHEMA}, public`).then(() => undefined);
    }
    await searchPathReady;
  }

  return {
    async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
      await ensureSearchPath();
      const trimmed = sql.trim().toLowerCase();
      if (trimmed === "begin" || trimmed === "commit" || trimmed === "rollback") {
        await pgClient.query(trimmed);
        return { rows: [] };
      }
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      // paramsが空の場合は第2引数を渡さない(simple query protocolのまま実行する)。
      // node-postgresは第2引数(たとえ空配列でも)を渡すとparameterized/extended
      // protocolへ切り替わり、PostgreSQLは複数文を含むSQL文字列をそのprotocolでは
      // 受け付けない(実際にPostgreSQL integrationで確認済みの不具合: 複数
      // CREATE TABLE文をまとめたDDLをこの経路で実行するとresult.rowsが
      // undefinedになった)。以前このメソッドは常にparamsを渡していたため、
      // 単一SELECT/INSERTだけを送るこれまでの呼び出し元(すべて単一文)では
      // この問題が発生していなかった。
      //
      // 2026-09-21追記: simple protocolで複数文を送った場合、driverによっては
      // 単一の結果objectではなく、文ごとの結果を並べた配列を返す可能性がある
      // (このセッションではローカルに実PostgreSQLが無く、この分岐を実際には
      // 検証できていない)。どちらの形でも安全に扱えるよう、配列なら最後の
      // 要素、`rows`が無ければ空配列として扱う(DDLの戻り値は元々使わないため、
      // ここでの「空配列」は正しい既定値であり、エラーを握りつぶすものではない)。
      const rawResult = params.length > 0 ? await pgClient.query(pgSql, params as unknown[]) : await pgClient.query(pgSql);
      const resolvedResult = Array.isArray(rawResult) ? rawResult[rawResult.length - 1] : rawResult;
      return { rows: (resolvedResult?.rows ?? []).map(normalizeRow) };
    },
  };
}
