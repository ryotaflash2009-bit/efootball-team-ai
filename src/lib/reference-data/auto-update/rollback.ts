import { sanitizeErrorMessage } from "../real-import-guards";
import type { QueryClient } from "./apply-orchestrator";
import type { StagingRecord } from "./types";

/**
 * Phase 2: 成功適用「後」の明示rollback(undo)。
 *
 * トランザクション内失敗時のROLLBACK(apply-orchestrator.tsが処理する、DBエンジンの
 * トランザクション機構そのもの)とは別物。こちらは「一度COMMIT済みのジョブを、後から
 * 人間の判断で元の状態へ戻す」ための、before-snapshotを使った明示的な逆適用である。
 *
 * before-snapshot(適用前の対象レコード全件)を保持していることが前提。保持していない
 * 場合、正確な復元はできない(推測で元状態を作らない)。
 */
export interface RollbackPlan {
  jobId: string;
  /** 適用前に存在した行(復元先)。 */
  beforeSnapshot: readonly StagingRecord[];
  /** 適用によって新規追加された行のID(rollbackで削除する対象)。 */
  addedIds: readonly string[];
}

export interface RollbackResult {
  ok: boolean;
  reasons: string[];
  restoredCount: number;
  removedCount: number;
}

export function buildRollbackPlan(jobId: string, beforeSnapshot: readonly StagingRecord[], addedIds: readonly string[]): RollbackPlan {
  return { jobId, beforeSnapshot, addedIds };
}

export async function executeRollback(client: QueryClient, plan: RollbackPlan, now: Date): Promise<RollbackResult> {
  await client.query("begin");
  try {
    for (const record of plan.beforeSnapshot) {
      await client.query(
        "insert into target_records (record_id, fields_json) values (?, ?) on conflict(record_id) do update set fields_json = excluded.fields_json",
        [record.id, JSON.stringify(record.fields)],
      );
    }
    for (const id of plan.addedIds) {
      await client.query("delete from target_records where record_id = ?", [id]);
    }
    await client.query("update update_jobs set status = 'rolled_back', completed_at = ? where job_id = ?", [
      now.toISOString(),
      plan.jobId,
    ]);
    await client.query("delete from applied_checksums where job_id = ?", [plan.jobId]);

    await client.query("commit");
    return { ok: true, reasons: [], restoredCount: plan.beforeSnapshot.length, removedCount: plan.addedIds.length };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    return {
      ok: false,
      reasons: [sanitizeErrorMessage(err instanceof Error ? err.message : String(err))],
      restoredCount: 0,
      removedCount: 0,
    };
  }
}
