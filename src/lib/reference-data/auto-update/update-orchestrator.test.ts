import { describe, it, expect } from "vitest";
import { buildApprovalRequest, decideFromDetection, evaluateBackupGate, evaluateDryRunGate, evaluatePlanGate, type PlanFacts } from "./update-orchestrator";

import { PLAN, SHA, SRC, backupSummary, dryRunSummary, planSummary } from "./__fixtures__/orchestrator-fixtures";

describe("Detection → 自動で進めるdataset", () => {
  it("update_available のdatasetだけ（World優先）。attention・ok=false・変化なしは進まない", () => {
    const d = (world: string, managers: string, ok = true) => JSON.stringify({ ok, world: { decision: world }, managers: { decision: managers } });
    expect(decideFromDetection(d("update_available", "no_change"))).toEqual({ ok: true, value: { dataset: "world", pending: [] } });
    expect(decideFromDetection(d("update_available", "update_available"))).toEqual({ ok: true, value: { dataset: "world", pending: ["managers"] } });
    expect(decideFromDetection(d("no_change", "update_available"))).toEqual({ ok: true, value: { dataset: "managers", pending: [] } });
    expect(decideFromDetection(d("no_change", "no_change"))).toEqual({ ok: false, reasons: ["no_update_available"] });
    expect(decideFromDetection(d("update_available", "attention_required"))).toEqual({ ok: false, reasons: ["detection_attention_required"] });
    expect(decideFromDetection(d("update_available", "no_change", false))).toEqual({ ok: false, reasons: ["detection_not_ok"] });
    expect(decideFromDetection("not json").ok).toBe(false);
  });
});

describe("Plan gate（Apply runを作らない条件）", () => {
  it("Run #11 と同じ内容なら通り、承認に必要な値を取り出す", () => {
    const g = evaluatePlanGate(planSummary(), "world", SHA);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.value).toMatchObject({ sourceChecksum: SRC, planChecksum: PLAN, acknowledge: "baseline_missing", added: 0, changed: 2, structuralChanged: 2, cardRatingOnlyChanged: 0, changedFields: ["maximum_level", "ovr_max"] });
  });

  it.each([
    ["removed > 0", (p: Record<string, unknown>) => { p.removedCount = 1; }, "plan_removed_not_zero"],
    ["duplicate > 0", (p: Record<string, unknown>) => { p.duplicateCount = 1; }, "plan_duplicate_not_zero"],
    ["invalid > 0", (p: Record<string, unknown>) => { p.invalidCount = 2; }, "plan_invalid_not_zero"],
    ["hard block", (p: Record<string, unknown>) => { (p.findings as unknown[]).push({ severity: "hard_block", code: "count_drop" }); }, "plan_hard_block"],
    ["future timestamp", (p: Record<string, unknown>) => { p.sourceTimestamps = { futureCount: 3, regression: false }; }, "plan_future_timestamps"],
    ["timestamp regression", (p: Record<string, unknown>) => { p.sourceTimestamps = { futureCount: 0, regression: true }; }, "plan_timestamp_regression"],
    ["unexpected target", (p: Record<string, unknown>) => { p.targetTables = ["world_player_cards", "managers"]; }, "plan_unexpected_target_tables"],
    ["plan problems", (p: Record<string, unknown>) => { p.planProblems = ["removal_not_allowed"]; }, "plan_problem:removal_not_allowed"],
    ["no changes", (p: Record<string, unknown>) => { p.changedCount = 0; }, "plan_no_changes"],
  ])("%s → 停止", (_l, patch, reason) => {
    const g = evaluatePlanGate(planSummary((p) => patch(p)), "world", SHA);
    expect(g.ok).toBe(false);
    expect(!g.ok && g.reasons).toContain(reason);
  });

  it("失敗したplan・別のSHA・checksum不正・dataset違いは停止", () => {
    expect(evaluatePlanGate(planSummary((_p, _f, s) => { s.ok = false; s.reasons = ["source_schema_drift"]; }), "world", SHA)).toMatchObject({ ok: false, reasons: expect.arrayContaining(["plan_not_ok", "plan:source_schema_drift"]) });
    expect(evaluatePlanGate(planSummary(), "world", "f".repeat(40))).toMatchObject({ ok: false, reasons: ["plan_commit_sha_mismatch"] });
    expect(evaluatePlanGate(planSummary((p) => { p.planChecksum = "x"; }), "world", SHA)).toMatchObject({ ok: false });
    expect(evaluatePlanGate(planSummary(), "managers", SHA)).toMatchObject({ ok: false, reasons: expect.arrayContaining(["plan_unexpected_target_tables"]) });
  });
});

describe("Backup gate", () => {
  const counts = { world_player_cards: 13297, managers: 67, import_batches: 10 };
  it("有効なpre-apply Backup v2 で、件数がplanと一致すれば通る", () => {
    expect(evaluateBackupGate(backupSummary(), "36248197028", counts)).toMatchObject({ ok: true, value: { restoreVerified: true, storageVerified: true } });
  });
  it("restore未検証・storage未検証・件数不一致・別runの要約は停止", () => {
    expect(evaluateBackupGate(backupSummary((s) => { s.restoreVerified = false; }), "36248197028", counts).ok).toBe(false);
    expect(evaluateBackupGate(backupSummary((s) => { s.storageVerified = false; }), "36248197028", counts).ok).toBe(false);
    expect(evaluateBackupGate(backupSummary(), "36248197028", { ...counts, managers: 68 })).toMatchObject({ ok: false, reasons: expect.arrayContaining(["backup_counts_differ_from_plan:managers"]) });
    expect(evaluateBackupGate(backupSummary(), "99999999999", counts)).toMatchObject({ ok: false, reasons: expect.arrayContaining(["backup_summary_not_from_this_run"]) });
  });
});

describe("Dry-run gate", () => {
  const plan = (evaluatePlanGate(planSummary(), "world", SHA) as { ok: true; value: PlanFacts }).value;
  it("Run #12 と同じ内容なら通る", () => {
    expect(evaluateDryRunGate(dryRunSummary(), plan, "36248197028").ok).toBe(true);
  });
  it.each([
    ["re-diff ≠ 0", (f: Record<string, unknown>) => { ((f.isolated as Record<string, unknown>).dryRun as Record<string, unknown>).rediffChanges = 1; }, "dry_run_rediff_not_zero"],
    ["after checksum mismatch", (f: Record<string, unknown>) => { ((f.isolated as Record<string, unknown>).dryRun as Record<string, unknown>).observedAfterChecksumMatches = false; }, "dry_run_after_checksum_mismatch"],
    ["undo failed", (f: Record<string, unknown>) => { ((f.isolated as Record<string, unknown>).undo as Record<string, unknown>).ok = false; }, "dry_run_undo_simulation_failed"],
    ["not verified", (f: Record<string, unknown>) => { (f.isolated as Record<string, unknown>).verified = false; }, "dry_run_isolated_not_verified"],
    ["plan checksum differs", (f: Record<string, unknown>) => { (f.plan as Record<string, unknown>).planChecksum = "0".repeat(64); }, "dry_run_plan_checksum_mismatch"],
    ["other backup", (f: Record<string, unknown>) => { f.backupRunId = "1"; }, "dry_run_backup_run_mismatch"],
  ])("%s → 停止", (_l, patch, reason) => {
    const g = evaluateDryRunGate(dryRunSummary(patch), plan, "36248197028");
    expect(!g.ok && g.reasons).toContain(reason);
  });
});

describe("承認画面（1回分）", () => {
  it("必要な項目・承認コメント・承認対象外を含み、Secretや行データを含まない", () => {
    const plan = (evaluatePlanGate(planSummary(), "world", SHA) as { ok: true; value: PlanFacts }).value;
    const a = buildApprovalRequest({ dataset: "world", plan, planRunId: "36140439271", backupRunId: "36248197028", backupCompletedAt: "2026-09-26T14:28:08Z", dryRunRunId: "36248634820", applyRunUrl: "https://github.com/o/r/actions/runs/1" });
    expect(a.comment).toContain("main 0c48f59");
    expect(a.comment).toContain("manual review: baseline_missing");
    expect(a.comment).toContain("Managers、player_card_analysis、削除、Rollback、Restoreは承認しません");
    for (const s of ["Run URL", "reference-data-production-apply", "13297 → 13297", "0 / 2", "maximum_level, ovr_max", "0 / 0 / 0 / 0", "BACKUP_V2_VALID", "re-diff 0", "承認対象外", "2026-09-27T14:28:08.000Z"]) expect(a.markdown).toContain(s);
    expect(JSON.stringify(a)).not.toMatch(/postgres:\/\/|\.age"|objectKey|password/i);
  });
});
