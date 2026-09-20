import type { GuardCheck } from "../real-import-guards";
import { computeRecordChecksum } from "./diff";
import type { SourceMeta, StagingRecord } from "./types";

/**
 * Phase 3(promotion検証): promotion「前」に変更対象だけを対象にしたbackup snapshotの
 * 純関数群(副作用なし)。
 *
 * 採用したbackup方式(`reference-data-backup-decision.md`参照)の中核部分:
 * 「変更対象の行単位before snapshot + source metadata + inverse operation plan」を
 * 具体的な型として表現する。Supabase platform backupのような全体バックアップは
 * 補助条件であり、これ単体では「特定jobの変更だけを正確に戻す」用途には使えないため、
 * 行単位snapshotを必須要件とする(`reference-data-backup-decision.md`4章)。
 */

export type BackupOperation = "insert" | "update";

export interface BackupSnapshotEntry {
  jobId: string;
  table: string;
  recordId: string;
  operation: BackupOperation;
  /** insert対象は事前に行が存在しなかったことを明示するため、常にnull。 */
  beforeRow: Readonly<Record<string, unknown>> | null;
  /** insert対象は比較対象が無いため、常にnull。 */
  beforeChecksum: string | null;
  sourceMeta: SourceMeta;
  createdAt: string;
}

export interface BuildBackupSnapshotInput {
  jobId: string;
  table: string;
  /** promotion対象の全レコード(追加・更新の両方を含む)。 */
  targetRecords: readonly StagingRecord[];
  /** 昇格前に実際に存在した行(読み戻し結果)。追加対象のIDはここに含まれない。 */
  existingBeforeRecords: readonly StagingRecord[];
  sourceMeta: SourceMeta;
  createdAt: string;
}

/**
 * `targetRecords`のうち、`existingBeforeRecords`に存在するIDは"update"(beforeRow付き)、
 * 存在しないIDは"insert"(beforeRow=null)としてsnapshotエントリを組み立てる。
 * `existingBeforeRecords`に無関係な行(promotion対象外のID)は一切含めない。
 */
export function buildBackupSnapshotEntries(input: BuildBackupSnapshotInput): BackupSnapshotEntry[] {
  const existingById = new Map(input.existingBeforeRecords.map((r) => [r.id, r]));
  return input.targetRecords
    .map((record) => {
      const existing = existingById.get(record.id);
      if (existing) {
        return {
          jobId: input.jobId,
          table: input.table,
          recordId: record.id,
          operation: "update" as const,
          beforeRow: existing.fields,
          beforeChecksum: computeRecordChecksum(existing.fields),
          sourceMeta: input.sourceMeta,
          createdAt: input.createdAt,
        };
      }
      return {
        jobId: input.jobId,
        table: input.table,
        recordId: record.id,
        operation: "insert" as const,
        beforeRow: null,
        beforeChecksum: null,
        sourceMeta: input.sourceMeta,
        createdAt: input.createdAt,
      };
    })
    .sort((a, b) => a.recordId.localeCompare(b.recordId));
}

/** insert件数+update件数が、期待した追加件数+更新件数と一致することを確認する。 */
export function checkSnapshotCountMatchesExpected(
  entries: readonly BackupSnapshotEntry[],
  expectedAddedCount: number,
  expectedUpdatedCount: number,
): GuardCheck {
  const insertCount = entries.filter((e) => e.operation === "insert").length;
  const updateCount = entries.filter((e) => e.operation === "update").length;
  if (insertCount !== expectedAddedCount || updateCount !== expectedUpdatedCount) {
    return {
      ok: false,
      reason: `snapshot件数が期待値と一致しない(insert: 期待${expectedAddedCount}/実際${insertCount}, update: 期待${expectedUpdatedCount}/実際${updateCount})`,
    };
  }
  return { ok: true };
}

/** snapshotに含まれるrecordIdが、すべてpromotion対象IDの集合に含まれることを確認する(無関係な行の混入を拒否)。 */
export function checkSnapshotExcludesUnrelatedRows(
  entries: readonly BackupSnapshotEntry[],
  allowedRecordIds: ReadonlySet<string>,
): GuardCheck {
  const unrelated = entries.filter((e) => !allowedRecordIds.has(e.recordId)).map((e) => e.recordId);
  if (unrelated.length > 0) {
    return { ok: false, reason: `promotion対象外のrecordIdがsnapshotに含まれている: ${unrelated.slice(0, 5).join(", ")}${unrelated.length > 5 ? " ..." : ""}` };
  }
  return { ok: true };
}

/** update操作のエントリはbeforeRow/beforeChecksumが必須、insert操作は必ずnullであることを確認する(整合性の自己検証)。 */
export function checkSnapshotOperationConsistency(entries: readonly BackupSnapshotEntry[]): GuardCheck {
  for (const e of entries) {
    if (e.operation === "update" && (e.beforeRow === null || e.beforeChecksum === null)) {
      return { ok: false, reason: `update操作のsnapshotエントリにbeforeRow/beforeChecksumが欠落している: ${e.recordId}` };
    }
    if (e.operation === "insert" && (e.beforeRow !== null || e.beforeChecksum !== null)) {
      return { ok: false, reason: `insert操作のsnapshotエントリにbeforeRow/beforeChecksumが設定されている(insertは事前に行が存在しないはず): ${e.recordId}` };
    }
  }
  return { ok: true };
}

export function evaluateSnapshotGates(
  entries: readonly BackupSnapshotEntry[],
  expectedAddedCount: number,
  expectedUpdatedCount: number,
  allowedRecordIds: ReadonlySet<string>,
): GuardCheck[] {
  return [
    checkSnapshotCountMatchesExpected(entries, expectedAddedCount, expectedUpdatedCount),
    checkSnapshotExcludesUnrelatedRows(entries, allowedRecordIds),
    checkSnapshotOperationConsistency(entries),
  ];
}
