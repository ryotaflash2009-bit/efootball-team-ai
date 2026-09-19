/**
 * Phase 2: 更新ジョブ(update_job)の状態モデル(純関数、副作用なし)。
 *
 * 実Supabase・実ネットワークへは一切接続しない。ジョブの永続化先(Supabase管理テーブルか
 * ローカルSQLiteか)は呼び出し側の責務であり、ここでは型と状態遷移の妥当性だけを扱う。
 */

export type JobStatus = "pending" | "running" | "completed" | "failed" | "rolled_back";

export interface UpdateJob {
  jobId: string;
  table: string;
  source: string;
  schemaVersion: string;
  datasetChecksum: string;
  previousChecksum: string | null;
  status: JobStatus;
  startedAt: string | null;
  completedAt: string | null;
  expectedTables: readonly string[];
  fetchedTables: readonly string[];
  counts: { added: number; updated: number; removedCandidate: number; unchanged: number } | null;
}

export interface CreatePendingJobInput {
  jobId: string;
  table: string;
  source: string;
  schemaVersion: string;
  datasetChecksum: string;
  previousChecksum: string | null;
  expectedTables: readonly string[];
  fetchedTables: readonly string[];
}

export function createPendingJob(input: CreatePendingJobInput): UpdateJob {
  return {
    ...input,
    status: "pending",
    startedAt: null,
    completedAt: null,
    counts: null,
  };
}

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  pending: ["running"],
  running: ["completed", "failed"],
  completed: ["rolled_back"],
  failed: [],
  rolled_back: [],
};

export interface JobTransitionResult {
  ok: boolean;
  reason?: string;
  job?: UpdateJob;
}

/** 許可された状態遷移だけを行う(pending→running→completed/failed→(completedのみ)rolled_back)。 */
export function transitionJob(job: UpdateJob, next: JobStatus, at: string, extra?: Partial<UpdateJob>): JobTransitionResult {
  if (!ALLOWED_TRANSITIONS[job.status].includes(next)) {
    return { ok: false, reason: `${job.status}から${next}への遷移は許可されていない` };
  }
  const updated: UpdateJob = { ...job, ...extra, status: next };
  if (next === "running") updated.startedAt = at;
  if (next === "completed" || next === "failed") updated.completedAt = at;
  return { ok: true, job: updated };
}

/** 「直前のジョブが実行中」を判定するための単純な状態マッピング(safety-gates.checkNoJobInProgressへ渡す)。 */
export function toSafetyGateJobStatus(job: UpdateJob | null): "idle" | "running" | "completed" | "failed" {
  if (!job) return "idle";
  if (job.status === "pending") return "idle";
  if (job.status === "rolled_back") return "completed";
  return job.status;
}
