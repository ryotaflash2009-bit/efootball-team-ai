import { decideCommitOrRollback, sanitizeErrorMessage, assertAllowedTable, type GuardCheck } from "../real-import-guards";
import { checkLockAcquired, checkNoJobInProgress, checkDatasetChecksumNotApplied } from "./safety-gates";
import { validateApproval, type ApprovalArtifact } from "./approval";
import { compareAppliedResult } from "./shadow-comparison";
import type { UpdatePlan } from "./plan";
import type { UpdateJob } from "./job";
import type { StagingRecord } from "./types";

/**
 * Phase 2: 承認済み更新候補の適用オーケストレーション。
 *
 * `client`は`pg.Client`/`node:sqlite`いずれとも互換の最小インターフェース
 * (`query(sql, params): Promise<{rows}>`)だけを要求する。実行時に実際に使うのは
 * ローカルの一時SQLiteファイル(`scripts/migration/reference-data-auto-update-apply.mjs`)
 * だけであり、Supabase/Postgresへの接続コードはこのモジュールに一切含まれない。
 *
 * 事前ゲート(ロック・二重実行・冪等性・plan判定・承認検証)を1件でも通過しなければ、
 * トランザクションを開始すること自体をしない(BEGINへ到達しない)。
 * 事前ゲートを通過した場合だけBEGINし、UPSERT→shadow comparison→COMMIT、いずれかの
 * 失敗でROLLBACKする。一部だけCOMMITされることを防ぐため、単一トランザクション内で
 * 完結させる。
 */

export interface QueryResult {
  rows: Array<Record<string, unknown>>;
}

export interface QueryClient {
  query(sql: string, params?: readonly unknown[]): Promise<QueryResult>;
}

export interface ApplyJobInput {
  job: UpdateJob;
  plan: UpdatePlan;
  approval: ApprovalArtifact;
  stagingRecords: readonly StagingRecord[];
  appliedChecksumHistory: ReadonlySet<string>;
  previousJobStatus: "idle" | "running" | "completed" | "failed";
  lockAcquired: boolean;
  now: Date;
}

export interface ApplyJobResult {
  decision: "commit" | "rollback";
  reasons: string[];
  appliedCount: number | null;
}

/**
 * 対象テーブルが`real-import-guards.ts`の許可リスト(`PUBLIC_REFERENCE_TABLES`・
 * `ADMIN_ONLY_TABLES`、参照データ専用)に含まれるかを確認する。`auth.users`・
 * `my_team_snapshots`・`rls_probe_records`等の利用者データテーブルは、この許可リストに
 * 含まれていないため、構造的に更新対象にできない(Phase 1の初回投入と同じ多層防御)。
 */
function checkAllowedTable(table: string): GuardCheck {
  try {
    assertAllowedTable(table);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** 事前ゲート(トランザクション開始前に必ず全件合格させる)。 */
export function evaluatePreApplyGates(input: ApplyJobInput): GuardCheck[] {
  return [
    checkAllowedTable(input.job.table),
    checkLockAcquired(input.lockAcquired),
    checkNoJobInProgress(input.previousJobStatus),
    checkDatasetChecksumNotApplied(input.job.datasetChecksum, input.appliedChecksumHistory),
    {
      ok: input.plan.decision === "apply-candidate",
      reason:
        input.plan.decision === "apply-candidate"
          ? undefined
          : `更新計画がreject判定のため適用しない(理由: ${input.plan.reasons.join("; ") || "不明"})`,
    },
    ...validateApproval(input.approval, input.job, input.plan.diff, input.now),
  ];
}

export async function applyUpdateJob(client: QueryClient, input: ApplyJobInput): Promise<ApplyJobResult> {
  const preChecks = evaluatePreApplyGates(input);
  const preDecision = decideCommitOrRollback(preChecks);
  if (preDecision.decision === "rollback") {
    return { decision: "rollback", reasons: preDecision.reasons, appliedCount: null };
  }

  await client.query("begin");
  try {
    for (const record of input.stagingRecords) {
      await client.query(
        "insert into target_records (record_id, fields_json) values (?, ?) on conflict(record_id) do update set fields_json = excluded.fields_json",
        [record.id, JSON.stringify(record.fields)],
      );
    }

    const readBackResult = await client.query("select record_id as id, fields_json from target_records");
    const actual: StagingRecord[] = readBackResult.rows
      .filter((r) => input.stagingRecords.some((s) => s.id === r.id))
      .map((r) => ({ id: String(r.id), fields: JSON.parse(String(r.fields_json)) }));

    const comparison = compareAppliedResult(input.stagingRecords, actual);
    if (!comparison.ok) {
      await client.query("rollback");
      return {
        decision: "rollback",
        reasons: [`shadow comparison失敗: 期待${comparison.expectedCount}件/実際${comparison.actualCount}件、不一致${comparison.mismatches.length}件`],
        appliedCount: null,
      };
    }

    await client.query(
      "update update_jobs set status = 'completed', completed_at = ?, added_count = ?, updated_count = ?, removed_candidate_count = ?, unchanged_count = ? where job_id = ?",
      [
        input.now.toISOString(),
        input.plan.diff.addedCount,
        input.plan.diff.updatedCount,
        input.plan.diff.removedCount,
        input.plan.diff.unchangedCount,
        input.job.jobId,
      ],
    );
    await client.query("insert into applied_checksums (dataset_checksum, job_id, applied_at) values (?, ?, ?)", [
      input.job.datasetChecksum,
      input.job.jobId,
      input.now.toISOString(),
    ]);

    await client.query("commit");
    return { decision: "commit", reasons: [], appliedCount: input.stagingRecords.length };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    return { decision: "rollback", reasons: [sanitizeErrorMessage(err instanceof Error ? err.message : String(err))], appliedCount: null };
  }
}
