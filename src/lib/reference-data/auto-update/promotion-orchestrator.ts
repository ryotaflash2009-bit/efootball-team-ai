import { decideCommitOrRollback, sanitizeErrorMessage, type GuardCheck } from "../real-import-guards";
import { validateApproval, type ApprovalArtifact } from "./approval";
import { checkNoJobInProgress, checkDatasetChecksumNotApplied, checkRemovedCount, evaluateDiffGates, type DiffGateThresholds } from "./safety-gates";
import type { DiffReport } from "./diff";
import {
  checkPromotionPlanTablesAllowed,
  checkPromotionPlanNotExpired,
  checkStagingChecksumUnchanged,
  validatePromotionPlanAgainstApproval,
  computeRecordSetChecksum,
  type PromotionPlan,
} from "./promotion";
import {
  buildPromotionUpsertSql,
  buildPromotionSelectByIdsSql,
  buildPromotionCountSql,
  buildSourceMetadataUpsertSql,
  buildSourceMetadataSelectSql,
  mapFieldsToParams,
  getPromotionTableSpec,
  PROMOTION_STAGING_SCHEMA,
  PROMOTION_FINAL_SCHEMA,
} from "./promotion-sql";
import { buildBackupSnapshotEntries, evaluateSnapshotGates } from "./backup-snapshot";
import { compareAppliedResult } from "./shadow-comparison";
import { lockKeyForTable } from "./lock";
import type { UpdateJob } from "./job";
import type { QueryClient } from "./apply-orchestrator";
import type { SourceMeta, StagingRecord } from "./types";

/**
 * Phase 3(promotion検証): reference_data_ops_test(staging)からreference_data_test
 * (確定相当)への「隔離PostgreSQL専用」昇格オーケストレーション(25手順、単一transaction)。
 *
 * **このファイルはProduction向けではない。** `PROMOTION_STAGING_SCHEMA`/
 * `PROMOTION_FINAL_SCHEMA`は常にテスト専用schema名(`reference_data_ops_test`/
 * `reference_data_test`)であり、`QueryClient`はGitHub ActionsのPostgreSQL service
 * container、またはテスト内の合成フェイク実装だけを想定している。
 *
 * 既存のjob.ts/approval.ts/diff.tsが「1ジョブ=1テーブル」というモデルであることに合わせ、
 * 1回のpromotionも1テーブル(world_player_cards/managers/player_card_analysisのいずれか)を
 * 対象にする設計にしている(3テーブルへの対応は、このオーケストレーターを3回呼び出すことで
 * 実現する。テストでは3テーブルそれぞれについて個別に実証する)。
 *
 * 事前ゲート(BEGIN前)を1件でも通過しなければトランザクションを開始しない。
 * 事前ゲート通過後はBEGIN〜COMMITを単一transactionで完結させ、いずれかの手順が
 * 失敗すれば必ずROLLBACKする(一部だけのcommitを許可しない)。
 */

export interface PromotionExecutionInput {
  job: UpdateJob;
  plan: PromotionPlan;
  approval: ApprovalArtifact;
  diff: DiffReport;
  diffThresholds: DiffGateThresholds;
  added: readonly StagingRecord[];
  updated: readonly StagingRecord[];
  unchangedIds: readonly string[];
  removedCandidateIds: readonly string[];
  /** updated・unchanged・removedCandidateの現在DB状態(readback済み)。addedのIDは含まれない。 */
  existingBeforeRecords: readonly StagingRecord[];
  /** promotion前に対象テーブルが持っているべき期待行数(前回スナップショットの件数)。 */
  expectedBeforeRowCount: number;
  currentStagingChecksum: string;
  previousJobStatus: "idle" | "running" | "completed" | "failed";
  appliedChecksumHistory: ReadonlySet<string>;
  maxRemovedCandidateCount: number;
  bypassFlagsDetected: readonly string[];
  sourceMeta: SourceMeta;
  now: Date;
}

export interface PromotionExecutionResult {
  decision: "commit" | "rollback";
  reasons: string[];
  addedCount: number | null;
  updatedCount: number | null;
}

/** 事前ゲート(トランザクション開始前に必ず全件合格させる、純粋関数のみ)。 */
export function evaluatePrePromotionGates(input: PromotionExecutionInput): GuardCheck[] {
  return [
    checkNoJobInProgress(input.previousJobStatus),
    checkDatasetChecksumNotApplied(input.job.datasetChecksum, input.appliedChecksumHistory),
    checkStagingChecksumUnchanged(input.plan, input.currentStagingChecksum),
    checkPromotionPlanNotExpired(input.plan, input.now),
    ...checkPromotionPlanTablesAllowed(input.plan),
    ...validatePromotionPlanAgainstApproval(input.plan, input.approval),
    ...validateApproval(input.approval, input.job, input.diff, input.now),
    ...evaluateDiffGates(input.diff, input.diffThresholds),
    checkRemovedCount(input.removedCandidateIds.length, input.maxRemovedCandidateCount),
    {
      ok: input.bypassFlagsDetected.length === 0,
      reason: input.bypassFlagsDetected.length === 0 ? undefined : `bypass/force系フラグが検出された: ${input.bypassFlagsDetected.join(", ")}`,
    },
  ];
}

function toRecordMap(records: readonly StagingRecord[]): Map<string, StagingRecord> {
  return new Map(records.map((r) => [r.id, r]));
}

export async function executePromotion(client: QueryClient, input: PromotionExecutionInput): Promise<PromotionExecutionResult> {
  const preChecks = evaluatePrePromotionGates(input);
  const preDecision = decideCommitOrRollback(preChecks);
  if (preDecision.decision === "rollback") {
    return { decision: "rollback", reasons: preDecision.reasons, addedCount: null, updatedCount: null };
  }

  const spec = getPromotionTableSpec(input.plan.targetTable);
  const nowIso = input.now.toISOString();
  const lockKey = lockKeyForTable(`promotion:${input.job.jobId}`);

  await client.query("begin");
  try {
    // 2. statement timeout / 3. lock timeout
    await client.query("set local statement_timeout = '30000'");
    await client.query("set local lock_timeout = '5000'");
    // 4. transaction isolation確認
    await client.query("set transaction isolation level serializable");

    // 5. pg_try_advisory_xact_lock
    const lockResult = await client.query("select pg_try_advisory_xact_lock(?) as acquired", [lockKey]);
    const acquired = lockResult.rows[0]?.acquired === true || lockResult.rows[0]?.acquired === "t";
    if (!acquired) {
      await client.query("rollback");
      return { decision: "rollback", reasons: ["advisory lockを取得できなかったため中止(待機しない)"], addedCount: null, updatedCount: null };
    }

    // 6. update job状態確認(running)
    await client.query("update update_jobs set status = 'running', started_at = ? where job_id = ?", [nowIso, input.job.jobId]);

    // 7-10. 承認・PromotionPlan・staging checksum・safety gateの再検証(BEGIN前の判定を
    // lock取得後にもう一度行う多層防御。staging側がロック取得までの間に変化していないことを保証する)。
    const reCheck = decideCommitOrRollback(evaluatePrePromotionGates(input));
    if (reCheck.decision === "rollback") {
      await client.query("rollback");
      return { decision: "rollback", reasons: reCheck.reasons, addedCount: null, updatedCount: null };
    }

    // 11. row count確認(promotion前)
    const countBefore = await client.query(buildPromotionCountSql(input.plan.targetTable));
    const actualBeforeCount = Number(countBefore.rows[0]?.row_count ?? -1);
    if (actualBeforeCount !== input.expectedBeforeRowCount) {
      throw new Error(
        `${input.plan.targetTable}: promotion前の行数が期待値と一致しない(期待${input.expectedBeforeRowCount}件, 実際${actualBeforeCount}件)`,
      );
    }

    // 12. removed candidate確認(件数上限は事前ゲートで確認済み、ここでは非削除方針を後段で検証する)

    // 13. before snapshot作成
    const touchedIds = new Set([...input.updated, ...input.added].map((r) => r.id));
    const snapshotEntries = buildBackupSnapshotEntries({
      jobId: input.job.jobId,
      table: input.plan.targetTable,
      targetRecords: [...input.added, ...input.updated],
      existingBeforeRecords: input.existingBeforeRecords,
      sourceMeta: input.sourceMeta,
      createdAt: nowIso,
    });
    const snapshotDecision = decideCommitOrRollback(
      evaluateSnapshotGates(snapshotEntries, input.added.length, input.updated.length, touchedIds),
    );
    if (snapshotDecision.decision === "rollback") {
      throw new Error(`before snapshotの検証に失敗(${snapshotDecision.reasons.join("; ")})`);
    }
    for (const entry of snapshotEntries) {
      await client.query(
        "insert into promotion_before_snapshots (job_id, table_name, record_id, operation, before_fields_json, before_checksum, source_meta_json, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          entry.jobId,
          entry.table,
          entry.recordId,
          entry.operation,
          entry.beforeRow !== null ? JSON.stringify(entry.beforeRow) : null,
          entry.beforeChecksum,
          JSON.stringify(entry.sourceMeta),
          entry.createdAt,
        ],
      );
    }

    // 14. source metadata snapshot作成(job単位、reference_data_ops_test側の履歴)
    await client.query(
      "insert into source_metadata_test (table_name, last_job_id, last_applied_at, source, schema_version) values (?, ?, ?, ?, ?)",
      [input.plan.targetTable, input.job.jobId, nowIso, input.sourceMeta.source, input.job.schemaVersion],
    );

    // 15. added records insert
    if (input.added.length > 0) {
      const sql = buildPromotionUpsertSql(input.plan.targetTable, input.added.length);
      const params = input.added.flatMap((r) => mapFieldsToParams(spec, r.fields, nowIso));
      await client.query(sql, params);
    }

    // 16. updated records update(同じUPSERT形式、addedとは別呼び出しにして手順を分離する)
    if (input.updated.length > 0) {
      const sql = buildPromotionUpsertSql(input.plan.targetTable, input.updated.length);
      const params = input.updated.flatMap((r) => mapFieldsToParams(spec, r.fields, nowIso));
      await client.query(sql, params);
    }

    // 17. unchanged records不変確認 + 18. removed candidate非削除確認
    // (「行が消えていないか」をここで確認する。内容の一致自体は後段のshadow comparison
    //  (checksumベース)で厳密に検証するため、ここでの役割は物理削除の早期検出に限定する)。
    const verifyIds = [...input.unchangedIds, ...input.removedCandidateIds];
    if (verifyIds.length > 0) {
      const readback = await client.query(buildPromotionSelectByIdsSql(input.plan.targetTable, verifyIds.length), verifyIds);
      const foundIds = new Set(readback.rows.map((row) => String(row[spec.primaryKey])));
      const missing = verifyIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new Error(`unchanged/removed candidateの行が消失している(物理削除は禁止): ${missing.join(", ")}`);
      }
    }

    // 19. source metadata更新(確定テーブル側の「最新1件」)。上書き前に、明示rollbackで
    // 復元できるよう「昇格前の状態」をpromotion_source_metadata_beforeへ保存しておく。
    const beforeMetaResult = await client.query(buildSourceMetadataSelectSql(), [input.plan.targetTable]);
    const beforeMetaRow = beforeMetaResult.rows[0] ?? null;
    await client.query("insert into promotion_source_metadata_before (job_id, table_name, before_json) values (?, ?, ?)", [
      input.job.jobId,
      input.plan.targetTable,
      beforeMetaRow ? JSON.stringify(beforeMetaRow) : null,
    ]);
    await client.query(buildSourceMetadataUpsertSql(), [input.plan.targetTable, input.job.jobId, nowIso, input.sourceMeta.source, "v1"]);

    // 20. readback + 21. shadow comparison
    // added/updatedは、実際にDBへ書き込まれる値(mapFieldsToParamsと全く同じ正規化: 全列・
    // jsonb列はJSON.stringify・updated_atはこのjobのnowで上書き)と同じ形にしてから比較する。
    // 読み戻し結果は常にspec.columns全列を持つ(未指定列はnull)ため、入力の一部列だけの
    // fieldsをそのまま比較すると偽陽性の不一致になる(mapFieldsToParamsを再利用して、
    // 書込み時と全く同じ変換ロジックであることを保証する)。
    const normalizeExpected = (record: StagingRecord): StagingRecord => {
      const params = mapFieldsToParams(spec, record.fields, nowIso);
      const normalized: Record<string, unknown> = {};
      spec.columns.forEach((col, idx) => {
        normalized[col] = params[idx];
      });
      return { id: record.id, fields: normalized };
    };
    const expectedAfterRecords: StagingRecord[] = [...input.added.map(normalizeExpected), ...input.updated.map(normalizeExpected)];
    const beforeById = toRecordMap(input.existingBeforeRecords);
    for (const id of [...input.unchangedIds, ...input.removedCandidateIds]) {
      const before = beforeById.get(id);
      if (before) expectedAfterRecords.push(before);
    }
    const allIds = expectedAfterRecords.map((r) => r.id);
    let actualAfterRecords: StagingRecord[] = [];
    if (allIds.length > 0) {
      const readback = await client.query(buildPromotionSelectByIdsSql(input.plan.targetTable, allIds.length), allIds);
      actualAfterRecords = readback.rows.map((row) => ({ id: String(row[spec.primaryKey]), fields: row }));
    }
    const comparison = compareAppliedResult(expectedAfterRecords, actualAfterRecords);
    if (!comparison.ok) {
      await client.query("rollback");
      return {
        decision: "rollback",
        reasons: [`shadow comparison失敗: 期待${comparison.expectedCount}件/実際${comparison.actualCount}件、不一致${comparison.mismatches.length}件`],
        addedCount: null,
        updatedCount: null,
      };
    }

    // 22. expectedAfterChecksum確認
    const actualAfterChecksum = computeRecordSetChecksum(actualAfterRecords);
    if (actualAfterChecksum !== input.plan.expectedAfterChecksum) {
      await client.query("rollback");
      return {
        decision: "rollback",
        reasons: ["適用後のchecksumがPromotionPlanのexpectedAfterChecksumと一致しない"],
        addedCount: null,
        updatedCount: null,
      };
    }

    // 23. applied checksum記録
    await client.query("insert into applied_checksums (dataset_checksum, job_id, applied_at) values (?, ?, ?)", [
      input.job.datasetChecksum,
      input.job.jobId,
      nowIso,
    ]);

    // 24. audit記録(秘密情報を含まない件数情報だけ)
    await client.query("insert into audit_events (job_id, phase, logged_at, detail_json) values (?, ?, ?, ?)", [
      input.job.jobId,
      "commit",
      nowIso,
      JSON.stringify({ table: input.plan.targetTable, addedCount: input.added.length, updatedCount: input.updated.length }),
    ]);

    // 25. jobをcompletedへ更新
    await client.query(
      "update update_jobs set status = 'completed', completed_at = ?, added_count = ?, updated_count = ?, removed_candidate_count = ?, unchanged_count = ? where job_id = ?",
      [nowIso, input.diff.addedCount, input.diff.updatedCount, input.diff.removedCount, input.diff.unchangedCount, input.job.jobId],
    );

    // 26. COMMIT
    await client.query("commit");
    return { decision: "commit", reasons: [], addedCount: input.added.length, updatedCount: input.updated.length };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    return {
      decision: "rollback",
      reasons: [sanitizeErrorMessage(err instanceof Error ? err.message : String(err))],
      addedCount: null,
      updatedCount: null,
    };
  }
}

export { PROMOTION_STAGING_SCHEMA, PROMOTION_FINAL_SCHEMA };
