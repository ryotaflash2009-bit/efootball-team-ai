import type { GuardCheck } from "../real-import-guards";
import type { DiffReport } from "./diff";

/**
 * 参照データ自動更新(Phase 1: dry-run)専用の安全ゲート純関数群。
 *
 * 初回投入用の`real-import-guards.ts`(`checkAllTablesEmpty`等)は「投入前は0件である」ことを
 * 前提にしており、既存データを更新する自動更新シナリオにはそのまま適用できない。
 * ここでは「前回件数からの増減率」「NULL率の増加」「未知フィールド」「部分取得失敗」
 * 「ロック競合」「重複適用防止」など、更新シナリオ固有のゲートだけを定義する。
 *
 * `GuardCheck`型・`decideCommitOrRollback`等の合否判定パターンは`real-import-guards.ts`と
 * 共通化し、二重実装しない。
 */
export type { GuardCheck } from "../real-import-guards";

/** 前回比の件数増減率が許容範囲内かを確認する(大量削除・大量増加の事故を防ぐ)。 */
export function checkCountDelta(
  previousCount: number,
  candidateCount: number,
  maxDecreaseRatio: number,
  maxIncreaseRatio: number,
): GuardCheck {
  if (previousCount === 0) {
    return candidateCount === 0
      ? { ok: true }
      : { ok: false, reason: "前回件数が0件のため増減率を判定できない(初回投入相当、別経路で扱うこと)" };
  }
  const ratio = candidateCount / previousCount;
  const minAllowed = 1 - maxDecreaseRatio;
  const maxAllowed = 1 + maxIncreaseRatio;
  if (ratio < minAllowed) {
    return {
      ok: false,
      reason: `件数が前回比${((1 - ratio) * 100).toFixed(1)}%減少(許容${(maxDecreaseRatio * 100).toFixed(0)}%まで): 前回${previousCount}件→今回${candidateCount}件`,
    };
  }
  if (ratio > maxAllowed) {
    return {
      ok: false,
      reason: `件数が前回比${((ratio - 1) * 100).toFixed(1)}%増加(許容${(maxIncreaseRatio * 100).toFixed(0)}%まで): 前回${previousCount}件→今回${candidateCount}件`,
    };
  }
  return { ok: true };
}

/** 削除件数そのものが閾値を超えていないかを確認する(件数比だけでは見逃す小規模全削除等への保険)。 */
export function checkRemovedCount(removedCount: number, maxRemovedCount: number): GuardCheck {
  if (removedCount > maxRemovedCount) {
    return { ok: false, reason: `削除候補が${removedCount}件(許容上限${maxRemovedCount}件)を超えている` };
  }
  return { ok: true };
}

/** NULL率(0〜1)の増加が許容ポイント数以内かを確認する。 */
export function checkNullRateIncrease(
  previousNullRate: number,
  candidateNullRate: number,
  maxIncreasePoints: number,
): GuardCheck {
  const increase = candidateNullRate - previousNullRate;
  if (increase > maxIncreasePoints) {
    return {
      ok: false,
      reason: `NULL率が${(increase * 100).toFixed(1)}ポイント増加(許容${(maxIncreasePoints * 100).toFixed(0)}ポイントまで): 前回${(previousNullRate * 100).toFixed(1)}%→今回${(candidateNullRate * 100).toFixed(1)}%`,
    };
  }
  return { ok: true };
}

/** 未知フィールド(スキーマ変更の兆候)が検出された場合に停止する。 */
export function checkNoUnknownFields(unknownFields: readonly string[]): GuardCheck {
  if (unknownFields.length > 0) {
    return { ok: false, reason: `未知フィールドを検出(要確認): ${unknownFields.join(", ")}` };
  }
  return { ok: true };
}

/** 対象テーブルの一部だけ取得に成功した状態(部分取得失敗)を拒否する。 */
export function checkAllTablesFetched(fetchedTables: readonly string[], expectedTables: readonly string[]): GuardCheck {
  const missing = expectedTables.filter((t) => !fetchedTables.includes(t));
  if (missing.length > 0) {
    return { ok: false, reason: `一部テーブルの取得に失敗(未取得: ${missing.join(", ")})` };
  }
  return { ok: true };
}

/** 直前のジョブが実行中の場合、二重実行を拒否する。 */
export function checkNoJobInProgress(previousJobStatus: "idle" | "running" | "completed" | "failed"): GuardCheck {
  if (previousJobStatus === "running") {
    return { ok: false, reason: "直前のジョブが実行中のため中止(二重実行防止)" };
  }
  return { ok: true };
}

/** advisory lock等の排他制御が取得できなかった場合に中止する。 */
export function checkLockAcquired(lockAcquired: boolean): GuardCheck {
  if (!lockAcquired) {
    return { ok: false, reason: "排他ロックを取得できなかったため中止" };
  }
  return { ok: true };
}

/** 同一checksumの候補データが既に適用済みの場合、重複適用を拒否する(内容ベースの冪等性)。 */
export function checkDatasetChecksumNotApplied(
  candidateChecksum: string,
  appliedChecksums: ReadonlySet<string>,
): GuardCheck {
  if (appliedChecksums.has(candidateChecksum)) {
    return { ok: false, reason: `このデータセット内容(checksum ${candidateChecksum.slice(0, 12)}…)は既に適用済み` };
  }
  return { ok: true };
}

/** DiffReportから代表的なゲート群をまとめて評価する補助関数。 */
export interface DiffGateThresholds {
  maxDecreaseRatio: number;
  maxIncreaseRatio: number;
  maxRemovedCount: number;
}

export function evaluateDiffGates(diff: DiffReport, thresholds: DiffGateThresholds): GuardCheck[] {
  return [
    checkCountDelta(diff.previousCount, diff.candidateCount, thresholds.maxDecreaseRatio, thresholds.maxIncreaseRatio),
    checkRemovedCount(diff.removedCount, thresholds.maxRemovedCount),
  ];
}
