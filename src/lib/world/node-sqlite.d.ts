/**
 * `node:sqlite`（Node.js 24 標準・実験的）の最小型定義。
 * `@types/node@20` にはまだ含まれないため、本アプリで使う分だけをここで宣言する。
 * 新しい npm パッケージは追加しない。
 */
declare module "node:sqlite" {
  interface DatabaseSyncOptions {
    readOnly?: boolean;
    open?: boolean;
    enableForeignKeyConstraints?: boolean;
  }

  type SqlValue = string | number | bigint | null | Uint8Array;

  class StatementSync {
    get(...params: SqlValue[]): Record<string, SqlValue> | undefined;
    all(...params: SqlValue[]): Record<string, SqlValue>[];
    run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    prepare(sql: string): StatementSync;
    exec(sql: string): void;
    close(): void;
  }
}
