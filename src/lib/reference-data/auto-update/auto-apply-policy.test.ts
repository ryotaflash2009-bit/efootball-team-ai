import { describe, it, expect } from "vitest";
import { evaluateAutoApplyPolicy, type AutoApplyPolicyInput } from "./auto-apply-policy";
import { evaluateAutoApplyFromArtifacts } from "./auto-apply-from-artifacts";
import { AUTO_APPLY_POLICY } from "./auto-apply-policy-config";
import { planSummary, backupSummary, dryRunSummary, SHA, SRC, PLAN } from "./__fixtures__/orchestrator-fixtures";

/**
 * 自動 Apply の判定。検証済みの実績（2026-10-03 の World・Managers の適用）を fixture にし、
 * どちらも ELIGIBLE になること、拒否の fixture がすべて期待どおりに止まることを確かめる。
 */
const NOW = "2026-10-03T12:00:00.000Z";
const BACKUP_AT = "2026-10-03T11:02:24.000Z";
const SRC12 = SRC.slice(0, 12);

/** 2026-10-03 の World（13,297 → 13,372・追加 75・更新 5,675・card_rating だけ 5,669・構造 6）。 */
function world(patch: (i: AutoApplyPolicyInput) => void = () => undefined): AutoApplyPolicyInput {
  const i: AutoApplyPolicyInput = {
    dataset: "world", bindingSha: SHA, currentMainSha: SHA, detectionChecksum12: SRC12, appliedChecksum12: "a1b2c3d4e5f6",
    plan: {
      commitSha: SHA, sourceChecksum: SRC, planChecksum: PLAN, targetTables: ["world_player_cards"], beforeCount: 13297, afterCount: 13372,
      added: 75, changed: 5675, removed: 0, duplicate: 0, invalid: 0, cardRatingOnlyChanged: 5669, structuralChanged: 6,
      changedFields: ["card_rating", "maximum_level", "ovr_max"], manualReviewCodes: ["baseline_missing"], futureTimestamps: 0, timestampRegression: false,
      findings: [{ severity: "manual_review", code: "baseline_missing" }, { severity: "warning", code: "preserved_column_drift" }],
      productionCounts: { world_player_cards: 13297, managers: 67, import_batches: 10 },
    },
    backup: { runId: "37118268591", valid: true, encrypted: true, restoreVerified: true, storageVerified: true, rowCounts: { world_player_cards: 13297, managers: 67, player_card_analysis: 19, import_batches: 10 }, completedAt: BACKUP_AT },
    dryRun: { runId: "37118367153", ok: true, rediff: 0, sourceChecksum: SRC, planChecksum: PLAN },
    readiness: { postVerifier: true, evidence: true, notification: true, cleanup: true },
    now: NOW,
  };
  patch(i);
  return i;
}

/** 2026-10-03 の Managers（67 → 69・追加 2・更新 0）。 */
function managers(patch: (i: AutoApplyPolicyInput) => void = () => undefined): AutoApplyPolicyInput {
  const i = world();
  i.dataset = "managers";
  i.plan = {
    ...i.plan, targetTables: ["managers"], beforeCount: 67, afterCount: 69, added: 2, changed: 0, cardRatingOnlyChanged: null, structuralChanged: null,
    changedFields: [], manualReviewCodes: ["baseline_missing", "manager_change"], futureTimestamps: null, timestampRegression: null,
    findings: [{ severity: "manual_review", code: "baseline_missing" }, { severity: "manual_review", code: "manager_change" }],
    productionCounts: { world_player_cards: 13372, managers: 67, import_batches: 11 },
  };
  i.backup = { ...i.backup, rowCounts: { world_player_cards: 13372, managers: 67, player_card_analysis: 19, import_batches: 11 } };
  patch(i);
  return i;
}

const decide = (i: AutoApplyPolicyInput) => evaluateAutoApplyPolicy(i);

describe("自動 Apply の判定（検証済みの実績）", () => {
  it("World 13,297 → 13,372（追加 75・更新 5,675）は ELIGIBLE", () => {
    const r = decide(world());
    expect(r.reasonCodes).toEqual([]);
    expect(r.decision).toBe("AUTO_APPLY_ELIGIBLE");
    expect(r).toMatchObject({ contractVersion: AUTO_APPLY_POLICY.version, dataset: "world", expectedAfterCount: 13372, bindingSha: SHA, backupRunId: "37118268591", dryRunRunId: "37118367153", evaluatedAt: NOW });
    expect(r.thresholdResults.every((t) => t.ok)).toBe(true);
    expect(r.allowedOperations).toContain("UPDATE world_player_cards (card_rating, maximum_level, ovr_max)");
    expect(r.blockedOperations).toEqual(expect.arrayContaining(["DELETE", "TRUNCATE", "UPDATE managers (existing rows)"]));
  });

  it("Managers 67 → 69（追加 2・更新 0）は ELIGIBLE", () => {
    const r = decide(managers());
    expect(r.decision).toBe("AUTO_APPLY_ELIGIBLE");
    expect(r.allowedOperations).toEqual(["INSERT managers", "INSERT import_batches (1 audit row)"]);
  });

  it("同じ入力からは常に同じ結果（決定的）", () => {
    expect(JSON.stringify(decide(world()))).toBe(JSON.stringify(decide(world())));
  });
});

describe("自動 Apply の判定（拒否の fixture）", () => {
  const cases: [string, AutoApplyPolicyInput, string, string][] = [
    ["removed 1", world((i) => { i.plan.removed = 1; }), "AUTO_APPLY_BLOCKED", "removed_not_zero"],
    ["duplicate 1", world((i) => { i.plan.duplicate = 1; }), "AUTO_APPLY_BLOCKED", "duplicate_not_zero"],
    ["invalid 1", world((i) => { i.plan.invalid = 1; }), "AUTO_APPLY_BLOCKED", "invalid_not_zero"],
    ["schema drift", world((i) => { i.plan.findings.push({ severity: "hard_block", code: "schema_drift" }); }), "AUTO_APPLY_BLOCKED", "schema_drift"],
    ["hard block", world((i) => { i.plan.findings.push({ severity: "hard_block", code: "x" }); }), "AUTO_APPLY_BLOCKED", "hard_block"],
    ["backup expired", world((i) => { i.now = "2026-10-04T11:02:24.000Z"; }), "AUTO_APPLY_BLOCKED", "backup_expired"],
    ["restore false", world((i) => { i.backup.restoreVerified = false; }), "AUTO_APPLY_BLOCKED", "backup_restore_unverified"],
    ["storage false", world((i) => { i.backup.storageVerified = false; }), "AUTO_APPLY_BLOCKED", "backup_storage_unverified"],
    ["backup not encrypted", world((i) => { i.backup.encrypted = false; }), "AUTO_APPLY_BLOCKED", "backup_not_encrypted"],
    ["backup count mismatch", world((i) => { i.backup.rowCounts.world_player_cards = 13296; }), "AUTO_APPLY_BLOCKED", "backup_count_mismatch"],
    ["dry run failed", world((i) => { i.dryRun.ok = false; }), "AUTO_APPLY_BLOCKED", "dry_run_failed"],
    ["re-diff 1", world((i) => { i.dryRun.rediff = 1; }), "AUTO_APPLY_BLOCKED", "rediff_not_zero"],
    ["checksum mismatch", world((i) => { i.dryRun.planChecksum = "f".repeat(64); }), "AUTO_APPLY_BLOCKED", "checksum_mismatch"],
    ["main SHA mismatch", world((i) => { i.currentMainSha = "1".repeat(40); }), "AUTO_APPLY_BLOCKED", "main_sha_changed"],
    ["candidate stale", world((i) => { i.detectionChecksum12 = "0123456789ab"; }), "AUTO_APPLY_BLOCKED", "candidate_stale"],
    ["already applied", world((i) => { i.appliedChecksum12 = SRC12; }), "AUTO_APPLY_BLOCKED", "candidate_already_applied"],
    ["count drop", world((i) => { i.plan.afterCount = 13296; i.plan.added = 0; }), "AUTO_APPLY_BLOCKED", "count_drop"],
    ["target外 table", world((i) => { i.plan.targetTables = ["world_player_cards", "player_card_analysis"]; }), "AUTO_APPLY_BLOCKED", "unexpected_target_table"],
    ["future timestamp", world((i) => { i.plan.futureTimestamps = 1; }), "AUTO_APPLY_BLOCKED", "future_timestamp"],
    ["timestamp regression", world((i) => { i.plan.timestampRegression = true; }), "AUTO_APPLY_BLOCKED", "timestamp_regression"],
    ["post-verifier not ready", world((i) => { i.readiness.postVerifier = false; }), "AUTO_APPLY_BLOCKED", "postVerifier_not_ready"],
    ["unknown changed field", world((i) => { i.plan.changedFields.push("appearance_updated_at"); }), "MANUAL_APPLY_REQUIRED", "unknown_changed_field"],
    ["add ratio over 2%", world((i) => { i.plan.added = 300; i.plan.afterCount = 13597; }), "MANUAL_APPLY_REQUIRED", "threshold_add_ratio"],
    ["update ratio over 50%", world((i) => { i.plan.changed = 7000; i.plan.cardRatingOnlyChanged = 6994; }), "MANUAL_APPLY_REQUIRED", "threshold_update_ratio"],
    ["structural over 100", world((i) => { i.plan.structuralChanged = 101; i.plan.cardRatingOnlyChanged = 5574; }), "MANUAL_APPLY_REQUIRED", "threshold_structural"],
    ["unknown manual review code", world((i) => { i.plan.manualReviewCodes.push("world_large_change"); }), "MANUAL_APPLY_REQUIRED", "manual_review:world_large_change"],
    ["Managers UPDATE 1", managers((i) => { i.plan.changed = 1; }), "MANUAL_APPLY_REQUIRED", "managers_update"],
    ["Managers added over 10", managers((i) => { i.plan.added = 11; i.plan.afterCount = 78; }), "MANUAL_APPLY_REQUIRED", "threshold_managers_added"],
    ["Managers removed 1", managers((i) => { i.plan.removed = 1; }), "AUTO_APPLY_BLOCKED", "removed_not_zero"],
  ];
  for (const [name, input, decision, code] of cases) {
    it(`${name} → ${decision}（${code}）`, () => {
      const r = decide(input);
      expect(r.decision).toBe(decision);
      expect(r.reasonCodes).toContain(code);
      if (decision !== "AUTO_APPLY_ELIGIBLE") expect(r.allowedOperations).toEqual([]);
    });
  }

  it("DELETE・TRUNCATE は許す操作に一度も現れず、常に禁止の操作にある", () => {
    for (const [, input] of cases) {
      const r = decide(input);
      expect(r.allowedOperations.join(" ")).not.toMatch(/DELETE|TRUNCATE/);
      expect(r.blockedOperations).toEqual(expect.arrayContaining(["DELETE", "TRUNCATE"]));
    }
  });

  it("入力の形が不正なら INVALID_INPUT（推測で埋めない）", () => {
    expect(decide({ ...world(), bindingSha: "x" }).decision).toBe("INVALID_INPUT");
    expect(decide({} as AutoApplyPolicyInput).decision).toBe("INVALID_INPUT");
    expect(decide(world((i) => { (i.plan as { added: unknown }).added = -1; })).decision).toBe("INVALID_INPUT");
  });
});

describe("artifact からの判定（orchestrator・Apply job の再確認で使う）", () => {
  it("要約 artifact が関門を通り、契約内なら ELIGIBLE", () => {
    const r = evaluateAutoApplyFromArtifacts({
      dataset: "world", bindingSha: SHA, currentMainSha: SHA, detectionChecksum12: SRC12, appliedChecksum12: null,
      planSummaryText: planSummary(), backupSummaryText: backupSummary(), backupRunId: "36248197028", backupCompletedAt: "2026-09-26T14:28:00.000Z",
      dryRunSummaryText: dryRunSummary(), dryRunRunId: "36248400000", now: "2026-09-26T15:00:00.000Z",
    });
    expect(r.decision).toBe("AUTO_APPLY_ELIGIBLE");
  });

  it("Dry run の re-diff が 0 でなければ、関門の理由で BLOCKED", () => {
    const r = evaluateAutoApplyFromArtifacts({
      dataset: "world", bindingSha: SHA, currentMainSha: SHA, detectionChecksum12: SRC12, appliedChecksum12: null,
      planSummaryText: planSummary(), backupSummaryText: backupSummary(), backupRunId: "36248197028", backupCompletedAt: "2026-09-26T14:28:00.000Z",
      dryRunSummaryText: dryRunSummary((f) => { ((f.isolated as Record<string, unknown>).dryRun as Record<string, unknown>).rediffChanges = 1; }), dryRunRunId: "36248400000", now: "2026-09-26T15:00:00.000Z",
    });
    expect(r.decision).toBe("AUTO_APPLY_BLOCKED");
    expect(r.reasonCodes).toContain("gate:dry_run_rediff_not_zero");
  });
});

describe("Managers の実際の要約の形（2026-10-03 の shadow で判明）", () => {
  // Plan run 37128272503 と同じ形（値も同じ・行データなし）。2026-10-03 時点の要約は invalidCount を出していなかった。
  const managersPlan = (withInvalid: boolean) => JSON.stringify({
    ok: true, phase: "plan", reasons: [],
    facts: {
      commitSha: SHA, productionCounts: { world_player_cards: 13372, managers: 67, import_batches: 11 },
      plan: {
        targetTables: ["managers"], receivedRecordCount: 69, beforeCount: 67, afterCount: 69, addedCount: 2, changedCount: 0, removedCount: 0,
        unchangedCount: 67, duplicateCount: 0, ...(withInvalid ? { invalidCount: 0 } : {}), changedFieldFrequency: {},
        sourceChecksum: SRC, planChecksum: PLAN, policySeverity: "manual_review",
        findings: [{ severity: "manual_review", code: "manager_change" }, { severity: "manual_review", code: "baseline_missing" }],
        manualReviewCodes: ["manager_change", "baseline_missing"], planProblems: [],
      },
    },
  });
  const backup = backupSummary((s) => {
    s.rowCounts = { world_player_cards: 13372, managers: 67, player_card_analysis: 19, import_batches: 11 };
    const cols = (s.columnCoverage as { addedColumns: Record<string, { rows: number; nonNullRows: number }> }).addedColumns;
    for (const k of ["world_player_cards.appearance_updated_at", "world_player_cards.import_batch_id"]) cols[k] = { ...cols[k], rows: 13372, nonNullRows: 13372 };
  });
  const dry = dryRunSummary((f) => { delete f.dataset; });
  const run = (withInvalid: boolean) => evaluateAutoApplyFromArtifacts({
    dataset: "managers", bindingSha: SHA, currentMainSha: SHA, detectionChecksum12: SRC12, appliedChecksum12: null,
    planSummaryText: managersPlan(withInvalid), backupSummaryText: backup, backupRunId: "36248197028", backupCompletedAt: "2026-09-26T14:28:00.000Z",
    dryRunSummaryText: dry, dryRunRunId: "36248400000", now: "2026-09-26T15:00:00.000Z",
  });

  it("invalidCount が無い要約は推測で 0 にせず BLOCKED", () => {
    expect(run(false)).toMatchObject({ decision: "AUTO_APPLY_BLOCKED", reasonCodes: ["invalid_count_missing"] });
  });

  it("invalidCount: 0 を出す要約（修正後）は ELIGIBLE", () => {
    expect(run(true).decision).toBe("AUTO_APPLY_ELIGIBLE");
  });
});
