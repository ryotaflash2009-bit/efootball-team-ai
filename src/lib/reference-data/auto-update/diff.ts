import { createHash } from "node:crypto";
import type { PreviousSnapshot, StagingRecord } from "./types";

/**
 * 取得結果(候補データ)と前回反映済みスナップショットの差分計算(純関数、副作用なし)。
 */

/** レコードの内容から安定したchecksumを計算する(キー順を固定してからJSON化)。 */
export function computeRecordChecksum(fields: Readonly<Record<string, unknown>>): string {
  const sortedKeys = Object.keys(fields).sort();
  const stable: Record<string, unknown> = {};
  for (const k of sortedKeys) stable[k] = fields[k];
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export interface DiffReport {
  table: string;
  addedIds: string[];
  removedIds: string[];
  updatedIds: string[];
  unchangedCount: number;
  addedCount: number;
  removedCount: number;
  updatedCount: number;
  previousCount: number;
  candidateCount: number;
}

export function computeDiff(previous: PreviousSnapshot, candidateRecords: readonly StagingRecord[]): DiffReport {
  const previousById = new Map(previous.records.map((r) => [r.id, r.checksum]));
  const candidateById = new Map(candidateRecords.map((r) => [r.id, computeRecordChecksum(r.fields)]));

  const addedIds: string[] = [];
  const updatedIds: string[] = [];
  let unchangedCount = 0;

  for (const [id, checksum] of candidateById) {
    const previousChecksum = previousById.get(id);
    if (previousChecksum === undefined) {
      addedIds.push(id);
    } else if (previousChecksum !== checksum) {
      updatedIds.push(id);
    } else {
      unchangedCount += 1;
    }
  }

  const removedIds: string[] = [];
  for (const id of previousById.keys()) {
    if (!candidateById.has(id)) removedIds.push(id);
  }

  addedIds.sort();
  updatedIds.sort();
  removedIds.sort();

  return {
    table: previous.table,
    addedIds,
    removedIds,
    updatedIds,
    unchangedCount,
    addedCount: addedIds.length,
    removedCount: removedIds.length,
    updatedCount: updatedIds.length,
    previousCount: previous.records.length,
    candidateCount: candidateRecords.length,
  };
}
