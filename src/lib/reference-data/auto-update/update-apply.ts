import { createHash, randomUUID } from "node:crypto";
import { assertIsolatedSchemaName } from "./isolated-reference-schema";
import { CONCURRENCY_GROUPS, UPDATE_TABLE_CONTRACTS, computeUpdateTableChecksum, rowIdentity } from "./update-contract";
import type { UpdateDiffPlan, DiffTable } from "./update-diff";
import type { UpdateCandidate } from "./update-candidate";
import { evaluateApplyPrerequisites, type ApplyGateFailure, type ApplyPrerequisites } from "./update-policy";
import { UPDATER_ROLE_NAME, updaterInsertableColumns, updaterUpdatableColumns } from "./updater-role";

/**
 * 自動更新 Phase H: 承認済み計画の適用executor(Production接続コードは含まない)。
 *
 * 呼び出し側が渡したPostgreSQL client(接続・role切替は呼び出し側の責務)に対して、次を1 transactionで行う:
 *   1. apply前提条件(evaluateApplyPrerequisites)を全件満たすこと・session roleがreference_data_updaterであること
 *   2. advisory lock(production write group)の取得
 *   3. 現在行のtable checksumが計画のbeforeChecksumと一致すること(古い計画は適用しない)
 *   4. import_batches行(pending)の追加
 *   5. 列単位grantの範囲だけでのINSERT/UPDATE(物理削除・removed/resurrectedの適用はしない)
 *   6. 読み戻したtable checksumが計画のafterChecksumと一致すること
 *   7. import_batchesをverifiedへ
 * どこかで失敗すればtransactionをrollbackし、Productionには何も残らない(第一のrollback手段)。
 * commit後の取り消しは、before snapshotから作るundo計画(本人承認で別実行)で行う。
 */

export interface ApplyPgClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export const PRODUCTION_REFERENCE_SCHEMA = "reference_data";

export type ApplyFailureCode =
  | "prerequisites_failed"
  | "plan_blocked"
  | "unsupported_changes"
  | "wrong_session_role"
  | "lock_not_acquired"
  | "stale_plan"
  | "after_checksum_mismatch"
  | "write_failed";

export interface ApplyTableResult {
  readonly table: DiffTable;
  readonly batchId: string;
  readonly inserted: number;
  readonly updated: number;
  readonly beforeChecksum: string;
  readonly afterChecksum: string;
}

export interface UndoPlan {
  readonly table: DiffTable;
  readonly batchId: string;
  /** 更新前の行(updatable列だけを戻す)。 */
  readonly restoreRows: readonly Readonly<Record<string, unknown>>[];
  /** 新規に追加した行。updaterはDELETEできないため、除去は本人判断の別手順。 */
  readonly insertedIdentities: readonly string[];
  /** undo後に期待するtable checksum(追加行が残る場合は一致しないため参考値)。 */
  readonly beforeChecksum: string;
}

export type ApplyResult =
  | { readonly ok: true; readonly tables: readonly ApplyTableResult[]; readonly undo: readonly UndoPlan[] }
  | { readonly ok: false; readonly code: ApplyFailureCode; readonly failures: readonly (ApplyGateFailure | string)[] };

export interface ApplyInput {
  readonly schema: string;
  readonly plans: readonly UpdateDiffPlan[];
  readonly candidate: Pick<UpdateCandidate, "idempotencyKey" | "sourceChecksum">;
  readonly prerequisites: ApplyPrerequisites;
  readonly datasetVersion: string;
  readonly approvedBy: string;
  /** 各tableのsource行数(import_batches.source_row_count)。 */
  readonly sourceRowCounts: Readonly<Partial<Record<DiffTable, number>>>;
  readonly newBatchId?: () => string;
}

/** production write groupのadvisory lock key(bigint範囲の決定的な値)。 */
export function productionWriteLockKey(): string {
  const hex = createHash("sha256").update(CONCURRENCY_GROUPS.productionWrite).digest("hex").slice(0, 15);
  return BigInt(`0x${hex}`).toString();
}

function assertTargetSchema(schema: string): string {
  if (schema === PRODUCTION_REFERENCE_SCHEMA) return schema;
  return assertIsolatedSchemaName(schema);
}

function params(table: DiffTable, cols: readonly string[], row: Readonly<Record<string, unknown>>, overrides: Readonly<Record<string, unknown>>): unknown[] {
  const jsonb = UPDATE_TABLE_CONTRACTS[table].jsonbColumns;
  return cols.map((c) => {
    const v = c in overrides ? overrides[c] : row[c];
    if (v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    return jsonb.includes(c) && v != null ? JSON.stringify(v) : v;
  });
}

const DATASET_VERSION_RE = /^[0-9A-Za-z._:-]{1,64}$/;
const APPROVER_RE = /^[0-9A-Za-z._@-]{1,64}$/;

export async function applyUpdatePlans(client: ApplyPgClient, input: ApplyInput): Promise<ApplyResult> {
  const schema = assertTargetSchema(input.schema);
  const gate = evaluateApplyPrerequisites(input.prerequisites);
  if (!gate.ok) return { ok: false, code: "prerequisites_failed", failures: gate.failures };
  if (input.prerequisites.sourceChecksum !== input.candidate.sourceChecksum) return { ok: false, code: "prerequisites_failed", failures: ["approval_not_bound_to_candidate"] };
  if (!DATASET_VERSION_RE.test(input.datasetVersion) || !APPROVER_RE.test(input.approvedBy)) return { ok: false, code: "prerequisites_failed", failures: ["invalid_batch_metadata"] };
  for (const p of input.plans) {
    if (p.blockingReasons.length > 0) return { ok: false, code: "plan_blocked", failures: [p.table] };
    // removed(tombstone)・resurrectedの自動適用は未実装。含む計画は適用しない。
    if (p.removedCandidates.length > 0 || p.resurrected.length > 0) return { ok: false, code: "unsupported_changes", failures: [p.table] };
  }
  const newBatchId = input.newBatchId ?? randomUUID;

  const role = await client.query("select current_user::text as u");
  if (role.rows[0]?.u !== UPDATER_ROLE_NAME) return { ok: false, code: "wrong_session_role", failures: [] };

  const tables: ApplyTableResult[] = [];
  const undo: UndoPlan[] = [];
  await client.query("begin");
  try {
    const lock = await client.query("select pg_try_advisory_xact_lock($1::bigint) as ok", [productionWriteLockKey()]);
    if (lock.rows[0]?.ok !== true) throw new ApplyAbort("lock_not_acquired");

    for (const plan of input.plans) {
      const table = plan.table;
      const pk = UPDATE_TABLE_CONTRACTS[table].primaryKeyColumn;
      const current = (await client.query(`select * from ${schema}.${table}`)).rows;
      if (computeUpdateTableChecksum(table, current) !== plan.report.beforeChecksum) throw new ApplyAbort("stale_plan", table);
      const byId = new Map(current.map((r) => [rowIdentity(table, r), r]));

      const batchId = newBatchId();
      await client.query(
        `insert into ${schema}.import_batches (batch_id, dataset_version, target_table, source, source_row_count, inserted_row_count, payload_hash, status, approved_by, notes)
         values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)`,
        [batchId, input.datasetVersion, table, table === "world_player_cards" ? "efootball-world" : "managers-json", input.sourceRowCounts[table] ?? 0, plan.inserts.length, plan.planChecksum, input.approvedBy, `auto-update ${input.candidate.idempotencyKey.slice(0, 12)}`],
      );
      const meta = { dataset_version: input.datasetVersion, import_batch_id: batchId };

      const insertCols = updaterInsertableColumns(table);
      for (const r of plan.inserts) {
        await client.query(
          `insert into ${schema}.${table} (${insertCols.join(", ")}) values (${insertCols.map((_, i) => `$${i + 1}`).join(", ")})`,
          params(table, insertCols, r.row, meta),
        );
      }
      const updateCols = updaterUpdatableColumns(table).filter((c) => c !== "updated_at");
      const restoreRows: Record<string, unknown>[] = [];
      for (const u of plan.updates) {
        const before = byId.get(u.identity);
        if (!before) throw new ApplyAbort("stale_plan", table);
        restoreRows.push({ ...before });
        const res = await client.query(
          `update ${schema}.${table} set ${updateCols.map((c, i) => `${c} = $${i + 1}`).join(", ")}, updated_at = now() where ${pk} = $${updateCols.length + 1}`,
          [...params(table, updateCols, u.row, meta), before[pk]],
        );
        if (res.rowCount !== 1) throw new ApplyAbort("write_failed", table);
      }

      const after = (await client.query(`select * from ${schema}.${table}`)).rows;
      const afterChecksum = computeUpdateTableChecksum(table, after);
      if (afterChecksum !== plan.report.afterChecksum) throw new ApplyAbort("after_checksum_mismatch", table);
      const verified = await client.query(
        `update ${schema}.import_batches set status = 'verified', verified_at = now() where batch_id = $1 and status = 'pending'`,
        [batchId],
      );
      if (verified.rowCount !== 1) throw new ApplyAbort("write_failed", "import_batches");

      tables.push({ table, batchId, inserted: plan.inserts.length, updated: plan.updates.length, beforeChecksum: plan.report.beforeChecksum, afterChecksum });
      undo.push({ table, batchId, restoreRows, insertedIdentities: plan.inserts.map((r) => r.identity), beforeChecksum: plan.report.beforeChecksum });
    }
    await client.query("commit");
    return { ok: true, tables, undo };
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    if (err instanceof ApplyAbort) return { ok: false, code: err.code, failures: err.detail ? [err.detail] : [] };
    return { ok: false, code: "write_failed", failures: [err instanceof Error ? err.message.slice(0, 200) : "unknown"] };
  }
}

class ApplyAbort extends Error {
  constructor(
    readonly code: ApplyFailureCode,
    readonly detail?: string,
  ) {
    super(code);
  }
}

export type UndoResult =
  | { readonly ok: true; readonly undoBatchId: string; readonly restored: number; readonly insertedIdentitiesRequiringManualRemoval: readonly string[] }
  | { readonly ok: false; readonly code: "wrong_session_role" | "lock_not_acquired" | "write_failed"; readonly detail: string | null };

/**
 * commit済みの適用を、before snapshotから明示的に取り消す(本人承認で別実行する手順。自動実行しない)。
 * updatable列だけを更新前の値へ戻す。取り消し自体を新しいimport_batches行(undo batch)として追記し、
 * 元のverified行は変更しない(updaterのRLS policyはpending行だけを更新でき、確定済み履歴は不変)。
 * 追加行は削除しない(updaterにはDELETE権限が無い。除去が必要なら本人判断の別手順)。
 */
export async function applyUndoPlan(client: ApplyPgClient, schema: string, plan: UndoPlan, newBatchId: () => string = randomUUID): Promise<UndoResult> {
  const target = assertTargetSchema(schema);
  const role = await client.query("select current_user::text as u");
  if (role.rows[0]?.u !== UPDATER_ROLE_NAME) return { ok: false, code: "wrong_session_role", detail: null };
  const table = plan.table;
  const pk = UPDATE_TABLE_CONTRACTS[table].primaryKeyColumn;
  const cols = updaterUpdatableColumns(table).filter((c) => c !== "updated_at");
  const undoBatchId = newBatchId();
  const payloadHash = createHash("sha256")
    .update(JSON.stringify([plan.batchId, plan.restoreRows.map((r) => rowIdentity(table, r))]))
    .digest("hex");
  await client.query("begin");
  try {
    const lock = await client.query("select pg_try_advisory_xact_lock($1::bigint) as ok", [productionWriteLockKey()]);
    if (lock.rows[0]?.ok !== true) {
      await client.query("rollback");
      return { ok: false, code: "lock_not_acquired", detail: null };
    }
    await client.query(
      `insert into ${target}.import_batches (batch_id, dataset_version, target_table, source, source_row_count, inserted_row_count, payload_hash, status, approved_by, notes)
       values ($1, $2, $3, 'undo', $4, 0, $5, 'pending', null, $6)`,
      [undoBatchId, `undo-${plan.batchId.slice(0, 8)}`, table, plan.restoreRows.length, payloadHash, `undo of ${plan.batchId}`],
    );
    for (const before of plan.restoreRows) {
      const res = await client.query(
        `update ${target}.${table} set ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")}, updated_at = now() where ${pk} = $${cols.length + 1}`,
        [...params(table, cols, before, {}), before[pk]],
      );
      if (res.rowCount !== 1) throw new Error(`${table}のundo対象が1行ではない`);
    }
    const done = await client.query(`update ${target}.import_batches set status = 'verified', verified_at = now() where batch_id = $1 and status = 'pending'`, [undoBatchId]);
    if (done.rowCount !== 1) throw new Error("undo batchを確定できない");
    await client.query("commit");
    return { ok: true, undoBatchId, restored: plan.restoreRows.length, insertedIdentitiesRequiringManualRemoval: plan.insertedIdentities };
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    return { ok: false, code: "write_failed", detail: err instanceof Error ? err.message.slice(0, 200) : null };
  }
}
