import type { JobStatus } from "./job";

/**
 * Production参照データ自動更新のupdate batch状態機械(Phase A、純関数のみ)。
 *
 * 既存の`job.ts`(pending/running/completed/failed/rolled_back)は変更せず、
 * `toLegacyJobStatus`で対応付ける。永続化先(Production reference_data_ops等)はPhase G以降の責務。
 */

export type UpdateBatchState =
  | "detected"
  | "source_fetched"
  | "normalized"
  | "diff_generated"
  | "policy_blocked"
  | "awaiting_review"
  | "backup_requested"
  | "backup_verified"
  | "dry_run_started"
  | "dry_run_failed"
  | "dry_run_verified"
  | "awaiting_production_approval"
  | "applying"
  | "applied"
  | "post_verify_failed"
  | "completed"
  | "rollback_required"
  | "rolled_back"
  | "cancelled"
  | "superseded";

export const UPDATE_BATCH_STATES: readonly UpdateBatchState[] = Object.freeze([
  "detected", "source_fetched", "normalized", "diff_generated", "policy_blocked", "awaiting_review",
  "backup_requested", "backup_verified", "dry_run_started", "dry_run_failed", "dry_run_verified",
  "awaiting_production_approval", "applying", "applied", "post_verify_failed", "completed",
  "rollback_required", "rolled_back", "cancelled", "superseded",
]);

/** Production書込みが始まる前の状態(ここからだけcancel/supersedeできる)。 */
const PRE_APPLY_STATES: readonly UpdateBatchState[] = Object.freeze([
  "detected", "source_fetched", "normalized", "diff_generated", "policy_blocked", "awaiting_review",
  "backup_requested", "backup_verified", "dry_run_started", "dry_run_failed", "dry_run_verified",
  "awaiting_production_approval",
]);

const ABORT: readonly UpdateBatchState[] = ["cancelled", "superseded"];
const next = (...states: UpdateBatchState[]): readonly UpdateBatchState[] => Object.freeze(states);

/**
 * 許可遷移の完全な一覧。ここに無い遷移はすべて禁止。
 * - applyingへはawaiting_production_approvalからだけ(= backup_verified・dry_run_verified・承認を必ず経由)。
 * - applying開始後はcancel/supersedeできない。
 * - policy_blocked・dry_run_failedからは中止(cancelled/superseded)しかできない(自動applyなし)。
 * - applyingの失敗(transaction失敗・timeout・部分失敗)はrollback_requiredへ進む。
 */
export const UPDATE_BATCH_TRANSITIONS: Readonly<Record<UpdateBatchState, readonly UpdateBatchState[]>> = Object.freeze({
  detected: next("source_fetched", ...ABORT),
  source_fetched: next("normalized", ...ABORT),
  normalized: next("diff_generated", ...ABORT),
  diff_generated: next("awaiting_review", "policy_blocked", ...ABORT),
  policy_blocked: next(...ABORT),
  awaiting_review: next("backup_requested", ...ABORT),
  backup_requested: next("backup_verified", ...ABORT),
  backup_verified: next("dry_run_started", ...ABORT),
  dry_run_started: next("dry_run_verified", "dry_run_failed", ...ABORT),
  dry_run_failed: next(...ABORT),
  dry_run_verified: next("awaiting_production_approval", ...ABORT),
  awaiting_production_approval: next("applying", ...ABORT),
  applying: next("applied", "rollback_required"),
  applied: next("completed", "post_verify_failed"),
  post_verify_failed: next("rollback_required"),
  completed: next(),
  rollback_required: next("rolled_back"),
  rolled_back: next(),
  cancelled: next(),
  superseded: next(),
});

/** 人の明示承認が必要な遷移(review解決・Production apply・rollback実行)。 */
const MANUAL_APPROVAL_TRANSITIONS: ReadonlyArray<readonly [UpdateBatchState, UpdateBatchState]> = Object.freeze([
  ["awaiting_review", "backup_requested"],
  ["awaiting_production_approval", "applying"],
  ["rollback_required", "rolled_back"],
] as const);

/** Production reference_dataへの書込みを伴う遷移(apply開始・rollback実行)。 */
const PRODUCTION_WRITE_TRANSITIONS: ReadonlyArray<readonly [UpdateBatchState, UpdateBatchState]> = Object.freeze([
  ["awaiting_production_approval", "applying"],
  ["rollback_required", "rolled_back"],
] as const);

function isKnownState(value: unknown): value is UpdateBatchState {
  return typeof value === "string" && (UPDATE_BATCH_STATES as readonly string[]).includes(value);
}

export function canTransition(from: UpdateBatchState, to: UpdateBatchState): boolean {
  if (!isKnownState(from) || !isKnownState(to)) return false;
  return UPDATE_BATCH_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: UpdateBatchState, to: UpdateBatchState): void {
  if (!canTransition(from, to)) throw new Error(`update batchの状態遷移 ${String(from)} → ${String(to)} は許可されていない(blocked)`);
}

export function isTerminalState(state: UpdateBatchState): boolean {
  return isKnownState(state) && UPDATE_BATCH_TRANSITIONS[state].length === 0;
}

export function isPreApplyState(state: UpdateBatchState): boolean {
  return PRE_APPLY_STATES.includes(state);
}

export function requiresManualApprovalForTransition(from: UpdateBatchState, to: UpdateBatchState): boolean {
  return MANUAL_APPROVAL_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export function isProductionWriteTransition(from: UpdateBatchState, to: UpdateBatchState): boolean {
  return PRODUCTION_WRITE_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

/** Productionへの書込みが進行中または結果として生じている状態。 */
export function isProductionWriteState(state: UpdateBatchState): boolean {
  return state === "applying" || state === "applied" || state === "post_verify_failed" || state === "rollback_required" || state === "completed" || state === "rolled_back";
}

/**
 * 状態遷移を人の承認情報つきで行う。承認が必要な遷移は、承認の有無を明示しない限り拒否する
 * (自動apply・自動rollbackを構造的に禁止する)。
 */
export function transitionUpdateBatch(from: UpdateBatchState, to: UpdateBatchState, context: { manualApproval: boolean }): UpdateBatchState {
  assertTransition(from, to);
  if (requiresManualApprovalForTransition(from, to) && context.manualApproval !== true) {
    throw new Error(`${from} → ${to} は人の明示承認が必要(自動実行はblocked)`);
  }
  return to;
}

/** 状態履歴が契約どおりか検証する(初期状態・各遷移の妥当性・applyingの重複)。 */
export function validateStateHistory(history: readonly UpdateBatchState[]): string[] {
  const problems: string[] = [];
  if (history.length === 0) return ["状態履歴が空"];
  if (history[0] !== "detected") problems.push("状態履歴はdetectedから始まる必要がある");
  for (let i = 1; i < history.length; i++) {
    if (!canTransition(history[i - 1], history[i])) problems.push(`不正な遷移: ${history[i - 1]} → ${history[i]}`);
  }
  if (history.filter((s) => s === "applying").length > 1) problems.push("同じbatchを二重にapplyしている");
  return problems;
}

/** 既存job.tsの状態への対応付け(既存moduleは変更しない)。 */
export function toLegacyJobStatus(state: UpdateBatchState): JobStatus {
  if (state === "applying") return "running";
  if (state === "applied" || state === "completed" || state === "post_verify_failed" || state === "rollback_required") return "completed";
  if (state === "rolled_back") return "rolled_back";
  if (state === "policy_blocked" || state === "dry_run_failed" || state === "cancelled" || state === "superseded") return "failed";
  return "pending";
}

// ---------------------------------------------------------------------------
// Retry policy (contract only; Phase A performs no network I/O)
// ---------------------------------------------------------------------------

export type RetryStage =
  | "update_detection"
  | "source_fetch"
  | "parse"
  | "normalize"
  | "diff"
  | "policy"
  | "backup"
  | "dry_run"
  | "production_approval"
  | "production_apply"
  | "post_apply_verification"
  | "rollback"
  | "restore";

export type RetryReason =
  | "network_error"
  | "http_5xx"
  | "timeout"
  | "http_429"
  | "http_403"
  | "captcha"
  | "schema_drift"
  | "parse_error"
  | "validation_error"
  | "policy_block"
  | "apply_failure"
  | "verification_failure"
  | "unknown";

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly retryableReasons: readonly RetryReason[];
  readonly nonRetryableReasons: readonly RetryReason[];
  readonly backoff: "none" | "fixed_interval_respecting_source_rate_limit";
  /** Evidenceへ残す項目。 */
  readonly evidenceFields: readonly string[];
}

const RETRY_EVIDENCE_FIELDS = Object.freeze(["stage", "attempt", "reason", "at"]);
const STOP_IMMEDIATELY: readonly RetryReason[] = Object.freeze(["http_429", "http_403", "captcha", "schema_drift", "parse_error", "validation_error", "policy_block", "apply_failure", "verification_failure", "unknown"]);

function noRetry(): RetryPolicy {
  const nonRetryable: RetryReason[] = [...STOP_IMMEDIATELY, "network_error", "http_5xx", "timeout"];
  return Object.freeze({
    maxAttempts: 1,
    retryableReasons: Object.freeze([] as RetryReason[]),
    nonRetryableReasons: Object.freeze(nonRetryable),
    backoff: "none",
    evidenceFields: RETRY_EVIDENCE_FIELDS,
  });
}

/**
 * 自動retryは更新検出とsource取得(network/5xx/timeoutのみ、最大2回の再試行=合計3回)だけ。
 * 429は既存Fetcherの方針どおり即停止を優先する(Retry-Afterによる待機は後続Phaseで個別に承認)。
 * 403・CAPTCHA・schema driftは即停止。Backup・dry run・承認・apply・検証・rollback・Restoreは自動retryしない。
 */
export const RETRY_POLICIES: Readonly<Record<RetryStage, RetryPolicy>> = Object.freeze({
  update_detection: Object.freeze({
    maxAttempts: 3,
    retryableReasons: Object.freeze(["network_error", "http_5xx", "timeout"] as RetryReason[]),
    nonRetryableReasons: STOP_IMMEDIATELY,
    backoff: "fixed_interval_respecting_source_rate_limit",
    evidenceFields: RETRY_EVIDENCE_FIELDS,
  }),
  source_fetch: Object.freeze({
    maxAttempts: 3,
    retryableReasons: Object.freeze(["network_error", "http_5xx", "timeout"] as RetryReason[]),
    nonRetryableReasons: STOP_IMMEDIATELY,
    backoff: "fixed_interval_respecting_source_rate_limit",
    evidenceFields: RETRY_EVIDENCE_FIELDS,
  }),
  parse: noRetry(),
  normalize: noRetry(),
  diff: noRetry(),
  policy: noRetry(),
  backup: noRetry(),
  dry_run: noRetry(),
  production_approval: noRetry(),
  production_apply: noRetry(),
  post_apply_verification: noRetry(),
  rollback: noRetry(),
  restore: noRetry(),
});

/** この状態の「次の工程」を自動retryしてよいか(detection/fetchを行うdetected・source_fetched前段だけ)。 */
export function canRetryState(state: UpdateBatchState): boolean {
  return state === "detected";
}

/** attemptは1始まり(1回目の失敗後に2回目を行ってよいかは attempt=1 で判定する)。 */
export function isRetryAllowed(stage: RetryStage, reason: RetryReason, attempt: number): boolean {
  const policy = RETRY_POLICIES[stage];
  if (!policy || !Number.isInteger(attempt) || attempt < 1) return false;
  if (!policy.retryableReasons.includes(reason)) return false;
  return attempt < policy.maxAttempts;
}
