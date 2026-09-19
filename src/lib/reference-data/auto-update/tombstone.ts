import type { GuardCheck } from "../real-import-guards";
import type { DiffReport } from "./diff";

/**
 * Phase 2: 削除候補(tombstone)の扱い(純関数、副作用なし)。
 *
 * タスクの明示的要求: 外部データから消えたレコードを即座に物理削除しない。
 * 連続して不在が確認された場合に「無効化候補」として記録し、実際の削除(または無効化)は
 * 常に人間の承認を経てから別途行う。このファイル自体は削除もUPDATEも実行しない
 * (候補の計算だけを行う純関数)。
 */

export interface MissingRecord {
  id: string;
  consecutiveMissingCount: number;
}

export interface TombstoneComputation {
  /** 今回初めて不在になったID、またはconsecutiveMissingCountが閾値未満のID。 */
  stillTracking: MissingRecord[];
  /** 閾値に達し、無効化(tombstone)候補として差分レポートへ計上すべきID。物理削除はしない。 */
  readyForTombstone: string[];
}

/**
 * @param diff 今回の差分(removedIdsが「今回不在だったID」)
 * @param previousMissingCounts 前回までの連続不在回数(id → 回数)
 * @param thresholdConsecutiveMisses この回数に達したら無効化候補として扱う
 */
export function computeTombstoneCandidates(
  diff: DiffReport,
  previousMissingCounts: ReadonlyMap<string, number>,
  thresholdConsecutiveMisses: number,
): TombstoneComputation {
  const stillTracking: MissingRecord[] = [];
  const readyForTombstone: string[] = [];

  for (const id of diff.removedIds) {
    const count = (previousMissingCounts.get(id) ?? 0) + 1;
    if (count >= thresholdConsecutiveMisses) {
      readyForTombstone.push(id);
    } else {
      stillTracking.push({ id, consecutiveMissingCount: count });
    }
  }

  readyForTombstone.sort();
  stillTracking.sort((a, b) => a.id.localeCompare(b.id));
  return { stillTracking, readyForTombstone };
}

/** 無効化候補の件数そのものが閾値を超えていないかを確認する(大量削除候補の即reject)。 */
export function checkTombstoneCandidateCount(readyForTombstoneCount: number, maxCount: number): GuardCheck {
  if (readyForTombstoneCount > maxCount) {
    return { ok: false, reason: `無効化候補が${readyForTombstoneCount}件(許容上限${maxCount}件)を超えている` };
  }
  return { ok: true };
}

/**
 * 適用SQLの静的監査用: 物理削除(DELETE/TRUNCATE)を一切含まないことを確認する。
 * apply-orchestrator.tsが組み立てるSQL文字列の集合に対して呼び出す想定。
 */
export function assertNoPhysicalDeletion(statements: readonly string[]): GuardCheck {
  const deleteRe = /\b(delete\s+from|truncate)\b/i;
  const offending = statements.filter((s) => deleteRe.test(s));
  if (offending.length > 0) {
    return { ok: false, reason: `物理削除(DELETE/TRUNCATE)を含む文が見つかった: ${offending.length}件` };
  }
  return { ok: true };
}
