import { sanitizeErrorMessage, type GuardCheck } from "../real-import-guards";
import { computeBeforeStateChecksum, type PromotionPlan } from "./promotion";
import {
  buildPromotionUpsertSql,
  buildPromotionSelectByIdsSql,
  buildPromotionDeleteByIdSql,
  buildSourceMetadataUpsertSql,
  buildSourceMetadataDeleteSql,
  mapFieldsToParams,
  canonicalizeFieldsForComparison,
  getPromotionTableSpec,
} from "./promotion-sql";
import { lockKeyForTable } from "./lock";
import type { UpdateJob } from "./job";
import type { QueryClient } from "./apply-orchestrator";
import type { StagingRecord } from "./types";

/**
 * Phase 3(promotion検証): 成功「後」の明示rollback(隔離PostgreSQL専用)。
 *
 * `promotion-orchestrator.ts`のトランザクション内自動ROLLBACK(失敗時に即座に戻す)とは
 * 別物。こちらは「一度COMMIT済みのpromotion jobを、後から人間の承認で元へ戻す」ための、
 * `promotion_before_snapshots`を使った明示的な逆適用である。
 *
 * 単純なフラグでの実行は許可しない: `rollbackPlanId`・`targetJobId`・`appliedChecksum`が
 * すべて元のPromotionPlan・記録済みapplied_checksumsと一致しなければ拒否する。
 */

export interface PromotionRollbackApproval {
  rollbackPlanId: string;
  targetJobId: string;
  appliedChecksum: string;
  approvedBy: string;
  nonce: string;
  approvedAt: string;
}

export interface PromotionRollbackInput {
  approval: PromotionRollbackApproval;
  plan: PromotionPlan;
  job: UpdateJob;
  /** `applied_checksums`から読み取った、このjobに対する記録済みchecksum(存在しなければnull)。 */
  appliedChecksumRecorded: string | null;
  /** `rollback_jobs`に、このjobに対する未失敗のrollbackが既に存在するか(二重rollback防止)。 */
  alreadyRolledBack: boolean;
  now: Date;
}

/** rollback実行前のゲート(トランザクション開始前に純関数だけで判定する)。 */
export function evaluatePromotionRollbackGates(input: PromotionRollbackInput): GuardCheck[] {
  const checks: GuardCheck[] = [];
  checks.push(
    input.approval.rollbackPlanId === input.plan.rollbackPlanId
      ? { ok: true }
      : { ok: false, reason: "rollback承認のrollbackPlanIdが元のPromotionPlanと一致しない" },
  );
  checks.push(
    input.approval.targetJobId === input.plan.jobId && input.plan.jobId === input.job.jobId
      ? { ok: true }
      : { ok: false, reason: "rollback対象のjobIdが一致しない(別jobへのrollbackは許可されない)" },
  );
  checks.push(
    input.job.status === "completed" ? { ok: true } : { ok: false, reason: `completed状態のjobだけrollback可能(現在: ${input.job.status})` },
  );
  checks.push(
    input.appliedChecksumRecorded !== null && input.appliedChecksumRecorded === input.job.datasetChecksum
      ? { ok: true }
      : { ok: false, reason: "applied checksumが記録されていない、またはjobのdatasetChecksumと一致しない" },
  );
  checks.push(
    input.appliedChecksumRecorded !== null && input.approval.appliedChecksum === input.appliedChecksumRecorded
      ? { ok: true }
      : { ok: false, reason: "rollback承認のappliedChecksumが記録値と一致しない" },
  );
  checks.push(
    input.alreadyRolledBack ? { ok: false, reason: "このjobは既にrollback済み(二重rollbackを拒否)" } : { ok: true },
  );
  checks.push(
    input.approval.approvedBy.trim().length > 0 ? { ok: true } : { ok: false, reason: "rollback承認にapprovedByが設定されていない" },
  );
  checks.push(
    input.approval.nonce.trim().length > 0
      ? { ok: true }
      : { ok: false, reason: "rollback承認にnonceが設定されていない(単純フラグでのrollbackを防ぐための必須項目)" },
  );
  return checks;
}

export interface PromotionRollbackResult {
  ok: boolean;
  reasons: string[];
  restoredCount: number;
  removedCount: number;
}

export async function executePromotionRollback(client: QueryClient, input: PromotionRollbackInput): Promise<PromotionRollbackResult> {
  const preChecks = evaluatePromotionRollbackGates(input);
  const failed = preChecks.filter((c) => !c.ok);
  if (failed.length > 0) {
    return { ok: false, reasons: failed.map((c) => c.reason ?? "理由不明"), restoredCount: 0, removedCount: 0 };
  }

  const spec = getPromotionTableSpec(input.plan.targetTable);
  const nowIso = input.now.toISOString();
  const lockKey = lockKeyForTable(`promotion:${input.job.jobId}`);

  await client.query("begin");
  try {
    const lockResult = await client.query("select pg_try_advisory_xact_lock(?) as acquired", [lockKey]);
    const acquired = lockResult.rows[0]?.acquired === true || lockResult.rows[0]?.acquired === "t";
    if (!acquired) {
      await client.query("rollback");
      return { ok: false, reasons: ["advisory lockを取得できなかったため中止"], restoredCount: 0, removedCount: 0 };
    }

    // このjob自身のbefore snapshotを読み取る(他jobのsnapshotへは絶対に触れない、job_idで厳密に絞り込む)。
    const snapshotResult = await client.query(
      "select record_id, operation, before_fields_json from promotion_before_snapshots where job_id = ? and table_name = ?",
      [input.job.jobId, input.plan.targetTable],
    );
    const updateEntries = snapshotResult.rows.filter((r) => r.operation === "update");
    const insertEntries = snapshotResult.rows.filter((r) => r.operation === "insert");

    // updated行をbefore状態へ復元する。
    let restoredCount = 0;
    if (updateEntries.length > 0) {
      const records: StagingRecord[] = updateEntries.map((r) => ({
        id: String(r.record_id),
        fields: JSON.parse(String(r.before_fields_json)),
      }));
      const sql = buildPromotionUpsertSql(input.plan.targetTable, records.length);
      const params = records.flatMap((r) => mapFieldsToParams(spec, r.fields, nowIso));
      await client.query(sql, params);
      restoredCount = records.length;
    }

    // このjobが新規追加した行だけを削除する(明示rollbackだけに許可された例外)。
    let removedCount = 0;
    if (insertEntries.length > 0) {
      const idsToRemove = insertEntries.map((r) => String(r.record_id));
      const deleteSql = buildPromotionDeleteByIdSql(input.plan.targetTable);
      for (const id of idsToRemove) {
        await client.query(deleteSql, [id]);
      }
      removedCount = idsToRemove.length;
    }

    // source_metadataを昇格前の状態へ復元する(存在しなかった場合は削除)。
    const beforeMetaResult = await client.query("select before_json from promotion_source_metadata_before where job_id = ?", [
      input.job.jobId,
    ]);
    const beforeMetaJson = beforeMetaResult.rows[0]?.before_json ?? null;
    if (beforeMetaJson) {
      const beforeMeta = JSON.parse(String(beforeMetaJson)) as {
        table_name: string;
        last_job_id: string;
        last_applied_at: string;
        source: string;
        schema_version: string;
      };
      await client.query(buildSourceMetadataUpsertSql(), [
        beforeMeta.table_name,
        beforeMeta.last_job_id,
        beforeMeta.last_applied_at,
        beforeMeta.source,
        beforeMeta.schema_version,
      ]);
    } else {
      await client.query(buildSourceMetadataDeleteSql(), [input.plan.targetTable]);
    }

    // rollback後checksum確認: updated行が復元された状態でのchecksumが、PromotionPlanの
    // beforeChecksum(昇格前の「更新される行」の状態)と再一致することを確認する。
    if (updateEntries.length > 0) {
      const ids = updateEntries.map((r) => String(r.record_id));
      const readback = await client.query(buildPromotionSelectByIdsSql(input.plan.targetTable, ids.length), ids);
      const restoredRecords: StagingRecord[] = readback.rows.map((row) => ({
        id: String(row[spec.primaryKey]),
        fields: canonicalizeFieldsForComparison(spec, row),
      }));
      const restoredChecksum = computeBeforeStateChecksum(restoredRecords);
      if (restoredChecksum !== input.plan.beforeChecksum) {
        await client.query("rollback");
        return {
          ok: false,
          reasons: ["rollback後のchecksumがPromotionPlanのbeforeChecksumと一致しない(正確な復元に失敗した可能性)"],
          restoredCount: 0,
          removedCount: 0,
        };
      }
    }

    // rollback_jobsへ記録(二重rollbackはDB側のunique indexでも構造的に拒否される)。
    await client.query(
      "insert into rollback_jobs (rollback_job_id, target_job_id, status, requested_at, completed_at, restored_count, removed_count) values (?, ?, ?, ?, ?, ?, ?)",
      [input.plan.rollbackPlanId, input.job.jobId, "applied", nowIso, nowIso, restoredCount, removedCount],
    );

    // update_jobsをrolled_backへ遷移。
    await client.query("update update_jobs set status = 'rolled_back', completed_at = ? where job_id = ?", [nowIso, input.job.jobId]);

    // applied_checksumsは削除せず、監査のため履歴として維持する(update_jobs側がrolled_backへ
    // 遷移していることで「rollback済み」と判別できる。詳細はreference-data-backup-decision.md参照)。

    await client.query("commit");
    return { ok: true, reasons: [], restoredCount, removedCount };
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
