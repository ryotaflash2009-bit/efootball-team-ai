/**
 * 古い承認待ちの Production Apply の判定（pure・2026-10-11・本人の指示「完全自動更新を完成させて」）。
 *
 * 2026-10-09 の World の更新は、手動の経路（承認者の承認が必要）で Apply が待ち状態のまま 40 時間止まり、
 * 書き込みの concurrency（reference-data-production-write）が埋まって、次の候補の Plan も保留のままになった。
 * 承認待ちの Apply は、binding した Backup の有効期限（24 時間）を過ぎると、承認しても `backup_expired` で止まる＝実行できない。
 * そのような run を watchdog が取り消し、次の検出の候補が新しい Plan・Backup・Dry run で進めるようにする。
 *
 * 取り消すのは: reference-data-production-apply.yml の run で、状態が waiting / pending / queued / requested、作成から 24 時間以上。
 * 実行中（in_progress）・完了済みには触れない。Production への書き込みは無い（GitHub の run の取り消しだけ）。
 */
export const STALE_APPROVAL_MS = 24 * 60 * 60 * 1000;
const WAITING = new Set(["waiting", "pending", "queued", "requested"]);

/**
 * @param {{ now: string, runs: { id: number, status: string, createdAt: string, workflowPath?: string }[], staleMs?: number }} p
 * @returns {{ cancel: number[], kept: number }}
 */
export function staleApprovalRunsToCancel({ now, runs, staleMs = STALE_APPROVAL_MS }) {
  const t = Date.parse(now);
  if (!Number.isFinite(t)) return { cancel: [], kept: 0 };
  const cancel = [];
  let kept = 0;
  for (const r of runs ?? []) {
    if (!r || !Number.isInteger(r.id)) continue;
    if (r.workflowPath && !r.workflowPath.endsWith("reference-data-production-apply.yml")) continue;
    if (!WAITING.has(r.status)) continue;
    const c = Date.parse(r.createdAt);
    if (!Number.isFinite(c) || c > t) continue;
    if (t - c >= staleMs) cancel.push(r.id);
    else kept += 1;
  }
  return { cancel, kept };
}
