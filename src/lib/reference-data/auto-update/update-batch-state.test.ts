import { describe, it, expect } from "vitest";
import {
  UPDATE_BATCH_STATES,
  UPDATE_BATCH_TRANSITIONS,
  canTransition,
  assertTransition,
  isTerminalState,
  isPreApplyState,
  requiresManualApprovalForTransition,
  isProductionWriteTransition,
  isProductionWriteState,
  transitionUpdateBatch,
  validateStateHistory,
  toLegacyJobStatus,
  canRetryState,
  RETRY_POLICIES,
  isRetryAllowed,
  type UpdateBatchState,
  type RetryStage,
} from "./update-batch-state";

const HAPPY_PATH: UpdateBatchState[] = [
  "detected", "source_fetched", "normalized", "diff_generated", "awaiting_review", "backup_requested", "backup_verified",
  "dry_run_started", "dry_run_verified", "awaiting_production_approval", "applying", "applied", "completed",
];

/** fromから到達可能な状態の集合(グラフ全体の性質を検証するため)。 */
function reachable(from: UpdateBatchState): Set<UpdateBatchState> {
  const seen = new Set<UpdateBatchState>();
  const stack = [...UPDATE_BATCH_TRANSITIONS[from]];
  while (stack.length > 0) {
    const s = stack.pop()!;
    if (seen.has(s)) continue;
    seen.add(s);
    stack.push(...UPDATE_BATCH_TRANSITIONS[s]);
  }
  return seen;
}

/** applyingへ至るすべての経路が必ず通る状態(detectedから、その状態を除去するとapplyingへ到達できなくなる)。 */
function isMandatoryBeforeApplying(state: UpdateBatchState): boolean {
  const seen = new Set<UpdateBatchState>(["detected"]);
  const stack: UpdateBatchState[] = ["detected"];
  while (stack.length > 0) {
    const s = stack.pop()!;
    for (const n of UPDATE_BATCH_TRANSITIONS[s]) {
      if (n === state || seen.has(n)) continue;
      if (n === "applying") return false;
      seen.add(n);
      stack.push(n);
    }
  }
  return true;
}

describe("update batch state machine", () => {
  it("20状態を持ち、正規経路の各遷移が許可され、履歴として妥当", () => {
    expect(UPDATE_BATCH_STATES.length).toBe(20);
    expect(Object.keys(UPDATE_BATCH_TRANSITIONS).sort()).toEqual([...UPDATE_BATCH_STATES].sort());
    for (let i = 1; i < HAPPY_PATH.length; i++) expect(canTransition(HAPPY_PATH[i - 1], HAPPY_PATH[i]), `${HAPPY_PATH[i - 1]}→${HAPPY_PATH[i]}`).toBe(true);
    expect(validateStateHistory(HAPPY_PATH)).toEqual([]);
  });

  it("policy block経路: diff_generated → policy_blocked、そこからは中止しかできない(自動applyなし)", () => {
    expect(canTransition("diff_generated", "policy_blocked")).toBe(true);
    expect([...UPDATE_BATCH_TRANSITIONS.policy_blocked].sort()).toEqual(["cancelled", "superseded"]);
    expect(reachable("policy_blocked").has("applying")).toBe(false);
  });

  it("dry run失敗経路: dry_run_started → dry_run_failed、そこからapplyへ進めない", () => {
    expect(canTransition("dry_run_started", "dry_run_failed")).toBe(true);
    expect(reachable("dry_run_failed").has("applying")).toBe(false);
  });

  it("post verify失敗経路: applied → post_verify_failed → rollback_required → rolled_back(completedへは進めない)", () => {
    expect(validateStateHistory([...HAPPY_PATH.slice(0, 12), "post_verify_failed", "rollback_required", "rolled_back"])).toEqual([]);
    expect(canTransition("post_verify_failed", "completed")).toBe(false);
    expect(canTransition("applying", "rollback_required")).toBe(true);
  });

  it("終端状態はcompleted・rolled_back・cancelled・supersededだけで、そこからの遷移は無い", () => {
    const terminal = UPDATE_BATCH_STATES.filter(isTerminalState).sort();
    expect(terminal).toEqual(["cancelled", "completed", "rolled_back", "superseded"]);
    for (const t of terminal) for (const s of UPDATE_BATCH_STATES) expect(canTransition(t, s)).toBe(false);
  });

  it("backup_verified・dry_run_verified・awaiting_production_approvalは、applyingへ至るどの経路でも省略できない", () => {
    for (const s of ["backup_requested", "backup_verified", "dry_run_started", "dry_run_verified", "awaiting_production_approval"] as const) {
      expect(isMandatoryBeforeApplying(s), s).toBe(true);
    }
    expect(canTransition("backup_requested", "dry_run_started")).toBe(false);
    expect(canTransition("backup_verified", "applying")).toBe(false);
    expect(canTransition("dry_run_started", "applying")).toBe(false);
    expect(canTransition("dry_run_verified", "applying")).toBe(false);
    expect(() => assertTransition("dry_run_verified", "applying")).toThrow(/許可されていない/);
  });

  it("apply開始後はcancel・supersedeできない", () => {
    for (const s of ["applying", "applied", "post_verify_failed", "rollback_required"] as const) {
      expect(canTransition(s, "cancelled"), s).toBe(false);
      expect(canTransition(s, "superseded"), s).toBe(false);
      expect(isPreApplyState(s)).toBe(false);
    }
    for (const s of UPDATE_BATCH_STATES.filter(isPreApplyState)) {
      if (!isTerminalState(s)) expect(canTransition(s, "cancelled"), s).toBe(true);
    }
  });

  it("同じbatchの二重applyは構造的に不可能(applyingからapplyingへ戻る経路が無い)", () => {
    expect(reachable("applying").has("applying")).toBe(false);
    expect(validateStateHistory([...HAPPY_PATH.slice(0, 11), "applying"]).join(" ")).toMatch(/不正な遷移|二重/);
  });

  it("Production書込み遷移(apply開始・rollback実行)は人の明示承認が必要で、自動実行はblocked", () => {
    expect(isProductionWriteTransition("awaiting_production_approval", "applying")).toBe(true);
    expect(isProductionWriteTransition("rollback_required", "rolled_back")).toBe(true);
    for (const [f, t] of [["awaiting_production_approval", "applying"], ["rollback_required", "rolled_back"], ["awaiting_review", "backup_requested"]] as const) {
      expect(requiresManualApprovalForTransition(f, t)).toBe(true);
      expect(() => transitionUpdateBatch(f, t, { manualApproval: false })).toThrow(/承認が必要/);
      expect(transitionUpdateBatch(f, t, { manualApproval: true })).toBe(t);
    }
    expect(transitionUpdateBatch("detected", "source_fetched", { manualApproval: false })).toBe("source_fetched");
  });

  it("Production書込み遷移は上記2つだけで、それ以外の遷移はProductionへ書き込まない", () => {
    let count = 0;
    for (const f of UPDATE_BATCH_STATES) for (const t of UPDATE_BATCH_TRANSITIONS[f]) if (isProductionWriteTransition(f, t)) count++;
    expect(count).toBe(2);
    expect(isProductionWriteState("applying")).toBe(true);
    expect(isProductionWriteState("dry_run_verified")).toBe(false);
  });

  it("不正な状態履歴を検出する(初期状態・未知の遷移)", () => {
    expect(validateStateHistory([])).toEqual(["状態履歴が空"]);
    expect(validateStateHistory(["normalized", "diff_generated"]).join(" ")).toMatch(/detectedから/);
    expect(validateStateHistory(["detected", "applying"]).join(" ")).toMatch(/不正な遷移/);
    expect(canTransition("detected", "unknown" as UpdateBatchState)).toBe(false);
  });

  it("既存job.tsの状態へ対応付けられる(既存moduleは変更しない)", () => {
    expect(toLegacyJobStatus("detected")).toBe("pending");
    expect(toLegacyJobStatus("awaiting_production_approval")).toBe("pending");
    expect(toLegacyJobStatus("applying")).toBe("running");
    expect(toLegacyJobStatus("completed")).toBe("completed");
    expect(toLegacyJobStatus("rolled_back")).toBe("rolled_back");
    expect(toLegacyJobStatus("policy_blocked")).toBe("failed");
    expect(toLegacyJobStatus("superseded")).toBe("failed");
  });
});

describe("retry policy", () => {
  it("自動retryは更新検出とsource取得だけ(network/5xx/timeout、最大2回の再試行)", () => {
    for (const stage of ["update_detection", "source_fetch"] as const) {
      expect(RETRY_POLICIES[stage].maxAttempts).toBe(3);
      expect([...RETRY_POLICIES[stage].retryableReasons].sort()).toEqual(["http_5xx", "network_error", "timeout"]);
      expect(isRetryAllowed(stage, "http_5xx", 1)).toBe(true);
      expect(isRetryAllowed(stage, "http_5xx", 2)).toBe(true);
      expect(isRetryAllowed(stage, "http_5xx", 3)).toBe(false);
    }
  });

  it("429・403・CAPTCHA・schema driftは即停止(retryしない)", () => {
    for (const reason of ["http_429", "http_403", "captcha", "schema_drift"] as const) {
      expect(isRetryAllowed("source_fetch", reason, 1), reason).toBe(false);
      expect(RETRY_POLICIES.source_fetch.nonRetryableReasons).toContain(reason);
    }
  });

  it("parse・normalize・diff・policy・Backup・dry run・承認・apply・検証・rollback・Restoreは自動retryしない", () => {
    const noRetry: RetryStage[] = ["parse", "normalize", "diff", "policy", "backup", "dry_run", "production_approval", "production_apply", "post_apply_verification", "rollback", "restore"];
    for (const stage of noRetry) {
      expect(RETRY_POLICIES[stage].maxAttempts, stage).toBe(1);
      expect(RETRY_POLICIES[stage].retryableReasons, stage).toEqual([]);
      for (const reason of ["network_error", "http_5xx", "timeout", "apply_failure"] as const) expect(isRetryAllowed(stage, reason, 1)).toBe(false);
    }
  });

  it("retry契約はEvidence項目を持ち、不正なattemptは拒否する", () => {
    for (const p of Object.values(RETRY_POLICIES)) expect([...p.evidenceFields].sort()).toEqual(["at", "attempt", "reason", "stage"]);
    expect(isRetryAllowed("source_fetch", "network_error", 0)).toBe(false);
    expect(isRetryAllowed("source_fetch", "network_error", 1.5)).toBe(false);
    expect(canRetryState("detected")).toBe(true);
    expect(canRetryState("applying")).toBe(false);
    expect(canRetryState("rollback_required")).toBe(false);
  });
});
