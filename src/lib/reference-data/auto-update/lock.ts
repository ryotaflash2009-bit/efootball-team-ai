import { createHash } from "node:crypto";

/**
 * Phase 2: 排他制御(advisory lock)の設計と、テスト用の合成アダプター。
 *
 * Production設計(将来のPhase 2実装向け、今回は未接続):
 *   PostgreSQLの`pg_try_advisory_xact_lock(key)`(トランザクションスコープ、COMMIT/ROLLBACK時に
 *   自動解放される)を第一候補とする。keyは対象テーブル名から決定的に導出した64bit整数とし、
 *   テーブルごとに衝突しない値にする(`lockKeyForTable`)。取得失敗時は即座に更新を拒否し、
 *   ポーリング待機はしない(タスクの明示的要求: 待機し続けない)。
 *
 * このファイル自体は実DBへ一切接続しない。`LockAdapter`はテスト・ローカル検証専用の
 * インターフェースであり、`InMemoryLockAdapter`はプロセス内メモリだけで動作する合成実装。
 */

/** テーブル名から安定した64bit以内の整数を導出する(PostgreSQL advisory lockのkeyに使う想定)。 */
export function lockKeyForTable(table: string): bigint {
  const hash = createHash("sha256").update(`reference-data-auto-update:${table}`).digest();
  // 先頭8バイトを符号なし64bit整数として解釈(pg_try_advisory_xact_lockはbigintを取る)。
  return hash.readBigUInt64BE(0) & 0x7fffffffffffffffn;
}

export interface LockAdapter {
  tryAcquire(key: string): Promise<boolean>;
  release(key: string): Promise<void>;
}

/** テスト専用の合成lockアダプター(実DBへ接続しない、プロセス内メモリのみ)。 */
export class InMemoryLockAdapter implements LockAdapter {
  private readonly held = new Set<string>();

  async tryAcquire(key: string): Promise<boolean> {
    if (this.held.has(key)) return false;
    this.held.add(key);
    return true;
  }

  async release(key: string): Promise<void> {
    this.held.delete(key);
  }

  isHeld(key: string): boolean {
    return this.held.has(key);
  }
}
