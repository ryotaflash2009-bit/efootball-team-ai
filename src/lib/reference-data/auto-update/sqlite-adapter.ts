import type { DatabaseSync } from "node:sqlite";
import type { QueryClient, QueryResult } from "./apply-orchestrator";

/**
 * `node:sqlite`の`DatabaseSync`を`QueryClient`インターフェースへ適合させるアダプター。
 *
 * 用途はローカル一時SQLiteファイルでの合成検証(トランザクション・ロールバックの実地検証)
 * だけであり、実Supabase/Postgresへは一切接続しない。Production実装では、この関数の
 * かわりに`pg.Client`を直接渡す設計を想定する(`real-import-orchestrator.ts`と同じパターン)。
 */
export function createSqliteQueryClient(db: DatabaseSync): QueryClient {
  return {
    async query(sql: string, params: readonly unknown[] = []): Promise<QueryResult> {
      const trimmed = sql.trim().toLowerCase();
      if (trimmed === "begin" || trimmed === "commit" || trimmed === "rollback") {
        db.exec(trimmed);
        return { rows: [] };
      }
      const stmt = db.prepare(sql);
      const sqlParams = params as readonly (string | number | bigint | null)[];
      if (trimmed.startsWith("select")) {
        const rows = stmt.all(...sqlParams) as Array<Record<string, unknown>>;
        return { rows };
      }
      stmt.run(...sqlParams);
      return { rows: [] };
    },
  };
}
