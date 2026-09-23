import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  UPDATE_POLICY_THRESHOLDS,
  evaluateUpdatePolicy,
  maxSeverity,
  evaluateApplyPrerequisites,
  MAX_BACKUP_AGE_BEFORE_APPLY_HOURS,
  type UpdatePolicyInput,
  type TablePolicyCounts,
  type ApplyPrerequisites,
} from "./update-policy";

function counts(overrides: Partial<TablePolicyCounts> = {}): TablePolicyCounts {
  return {
    beforeCount: 13009, afterCount: 13009, addedCount: 0, changedCount: 0, removedCount: 0, resurrectedCount: 0,
    duplicateCount: 0, invalidCount: 0, schemaDriftCount: 0, sourceMissingCount: 0, approvedRemovalCount: 0,
    ...overrides,
  };
}

function input(overrides: Partial<UpdatePolicyInput> = {}): UpdatePolicyInput {
  return {
    sourceFetchFailed: false, sourceParseFailed: false, checksumGenerationFailed: false, unexpectedTableCount: 0,
    userOrAuthDataDetected: false, identityReuseConflictCount: 0, sourceTimestampRegression: false,
    sourceChecksumAlreadyApplied: false, physicalDeleteAttempted: false, frozenTableMutationCount: 0,
    existingImportBatchMutationCount: 0,
    tables: { world_player_cards: counts({ changedCount: 5 }) },
    baseline: { payloadBytes: 10_000_000 }, payloadBytes: 10_100_000,
    lastAppliedAt: "2026-09-01T00:00:00.000Z", now: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

const codes = (r: ReturnType<typeof evaluateUpdatePolicy>, severity?: string) => r.findings.filter((f) => !severity || f.severity === severity).map((f) => f.code);

describe("update safety policy", () => {
  it("閾値は契約どおりの推奨初期値で、凍結されている", () => {
    expect(UPDATE_POLICY_THRESHOLDS).toEqual({
      status: "recommended_initial_values",
      worldPlayerCards: { countDropHardBlockRatio: 0.02, addedPlusChangedManualReview: 7500, nearThresholdWarningRatio: 0.8, countIncreaseWarningRatio: 0.02 },
      managers: { countDropHardBlockRatio: 0.1 },
      batch: { minHoursBetweenApplies: 24, payloadSizeChangeManualReviewRatio: 0.5 },
    });
    expect(Object.isFrozen(UPDATE_POLICY_THRESHOLDS)).toBe(true);
    expect(Object.isFrozen(UPDATE_POLICY_THRESHOLDS.worldPlayerCards)).toBe(true);
    expect(Object.isFrozen(UPDATE_POLICY_THRESHOLDS.batch)).toBe(true);
  });

  describe("環境変数で閾値を変えられない", () => {
    const saved = { ...process.env };
    afterEach(() => {
      process.env = { ...saved };
    });
    it("process.envに閾値らしき値があっても結果は変わらず、moduleはprocess.envを読まない", () => {
      const before = evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ afterCount: 12000 }) } }));
      process.env.UPDATE_POLICY_WORLD_COUNT_DROP_RATIO = "0.99";
      process.env.REFERENCE_DATA_UPDATE_THRESHOLDS = '{"worldPlayerCards":{"countDropHardBlockRatio":1}}';
      const after = evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ afterCount: 12000 }) } }));
      expect(after).toEqual(before);
      const src = readFileSync(resolve(__dirname, "update-policy.ts"), "utf8");
      expect(src).not.toMatch(/process\.env/);
      expect(evaluateUpdatePolicy.length).toBe(1); // 閾値を引数で上書きできない
    });
  });

  it("問題の無い小さな変更はpass(warningも無し)", () => {
    const r = evaluateUpdatePolicy(input());
    expect(r.severity).toBe("pass");
    expect(r.findings).toEqual([]);
  });

  it("hard blockの各理由を検出する", () => {
    const r = evaluateUpdatePolicy(input({
      sourceFetchFailed: true, sourceParseFailed: true, checksumGenerationFailed: true, unexpectedTableCount: 1,
      userOrAuthDataDetected: true, identityReuseConflictCount: 1, sourceTimestampRegression: true,
      sourceChecksumAlreadyApplied: true,
    }));
    expect(r.severity).toBe("hard_block");
    expect(codes(r, "hard_block")).toEqual(expect.arrayContaining([
      "source_fetch_failure", "source_parse_failure", "checksum_failure", "unexpected_table", "user_or_auth_data",
      "identity_reuse_conflict", "source_timestamp_regression", "source_checksum_already_applied",
    ]));
  });

  it("重複identity・schema drift・source missing・不正な値・更新後0件はhard block", () => {
    for (const [key, code] of [["duplicateCount", "duplicate_identity"], ["schemaDriftCount", "schema_drift"], ["sourceMissingCount", "source_missing"], ["invalidCount", "invalid_values"]] as const) {
      const r = evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ [key]: 1 }) } }));
      expect(r.severity, key).toBe("hard_block");
      expect(codes(r)).toContain(code);
    }
    expect(codes(evaluateUpdatePolicy(input({ tables: { managers: counts({ beforeCount: 66, afterCount: 0 }) } })))).toContain("core_table_zero_rows");
  });

  it("物理削除・player_card_analysisの変更・既存import_batches行の変更はhard block", () => {
    expect(codes(evaluateUpdatePolicy(input({ physicalDeleteAttempted: true })))).toContain("physical_delete_attempt");
    const frozen = evaluateUpdatePolicy(input({ frozenTableMutationCount: 1 }));
    expect(frozen.severity).toBe("hard_block");
    expect(frozen.findings.find((f) => f.code === "frozen_table_mutation")?.table).toBe("player_card_analysis");
    const batches = evaluateUpdatePolicy(input({ existingImportBatchMutationCount: 1 }));
    expect(batches.findings.find((f) => f.code === "import_batches_mutation")?.table).toBe("import_batches");
  });

  it("World cardの未承認removedはmanual review、承認済みならreviewにならない", () => {
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ removedCount: 3, afterCount: 13009 }) } })), "manual_review")).toContain("unapproved_removal");
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ removedCount: 3, approvedRemovalCount: 3 }) } })))).not.toContain("unapproved_removal");
  });

  it("World cardの件数減少: 0より大きければmanual review、2%超ならhard block", () => {
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ afterCount: 13008 }) } })), "manual_review")).toContain("world_count_drop");
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ afterCount: 12749 }) } })), "manual_review")).toContain("world_count_drop"); // 1.998%
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ afterCount: 12748 }) } })), "hard_block")).toContain("world_count_drop"); // 2.006%
  });

  it("World cardのadded+changed: 7500超でmanual review、閾値の80%以上でwarning", () => {
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ changedCount: 7501 }) } })), "manual_review")).toContain("world_large_change");
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ changedCount: 7500 }) } })), "manual_review")).not.toContain("world_large_change");
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ changedCount: 6000 }) } })), "warning")).toContain("world_change_near_threshold");
    expect(codes(evaluateUpdatePolicy(input({ tables: { world_player_cards: counts({ addedCount: 3, afterCount: 13012 }) } })), "warning")).toContain("world_additions");
  });

  it("managerの変更・追加・removedはすべてmanual review、件数減少は10%超でhard block", () => {
    const base = { beforeCount: 66, afterCount: 66 };
    expect(codes(evaluateUpdatePolicy(input({ tables: { managers: counts({ ...base, changedCount: 1 }) } })), "manual_review")).toContain("manager_change");
    expect(codes(evaluateUpdatePolicy(input({ tables: { managers: counts({ ...base, addedCount: 1, afterCount: 67 }) } })), "manual_review")).toContain("manager_change");
    expect(codes(evaluateUpdatePolicy(input({ tables: { managers: counts({ ...base, afterCount: 65, removedCount: 1 }) } })), "manual_review")).toEqual(expect.arrayContaining(["manager_change", "manager_count_drop", "unapproved_removal"]));
    expect(codes(evaluateUpdatePolicy(input({ tables: { managers: counts({ ...base, afterCount: 59, removedCount: 7 }) } })), "hard_block")).toContain("manager_count_drop");
    expect(evaluateUpdatePolicy(input({ tables: { managers: counts(base) } })).severity).toBe("pass");
  });

  it("payload sizeがbaseline比50%以上変化したらmanual review", () => {
    expect(codes(evaluateUpdatePolicy(input({ payloadBytes: 15_000_000 })), "manual_review")).toContain("payload_size_anomaly");
    expect(codes(evaluateUpdatePolicy(input({ payloadBytes: 4_900_000 })), "manual_review")).toContain("payload_size_anomaly");
    expect(codes(evaluateUpdatePolicy(input({ payloadBytes: 14_000_000 })))).not.toContain("payload_size_anomaly");
  });

  it("直前のapplyから24時間未満の再applyはmanual review", () => {
    expect(codes(evaluateUpdatePolicy(input({ lastAppliedAt: "2026-09-09T12:00:00.000Z" })), "manual_review")).toContain("frequent_update");
    expect(codes(evaluateUpdatePolicy(input({ lastAppliedAt: "2026-09-08T23:59:00.000Z" })))).not.toContain("frequent_update");
    expect(codes(evaluateUpdatePolicy(input({ lastAppliedAt: "2026-09-11T00:00:00.000Z" })), "hard_block")).toContain("invalid_apply_time");
  });

  it("baselineが無い初回は安全側(manual review)に倒し、passにしない", () => {
    const r = evaluateUpdatePolicy(input({ baseline: null }));
    expect(r.severity).toBe("manual_review");
    expect(codes(r)).toContain("baseline_missing");
  });

  it("重大度はhard_block > manual_review > warning > passの優先順で集約される", () => {
    expect(maxSeverity("warning", "manual_review")).toBe("manual_review");
    expect(maxSeverity("hard_block", "warning")).toBe("hard_block");
    expect(maxSeverity("pass", "pass")).toBe("pass");
    const mixed = evaluateUpdatePolicy(input({ baseline: null, sourceParseFailed: true, tables: { world_player_cards: counts({ addedCount: 3, afterCount: 13012 }) } }));
    expect(mixed.severity).toBe("hard_block");
    expect(new Set(mixed.findings.map((f) => f.severity))).toEqual(new Set(["hard_block", "manual_review", "warning"]));
  });

  it("対象tableの差分が1つも無ければhard block", () => {
    expect(codes(evaluateUpdatePolicy(input({ tables: {} })), "hard_block")).toContain("no_target_table");
  });
});

describe("apply prerequisites", () => {
  const SHA = "d".repeat(64);
  const COMMIT = "e".repeat(40);

  function prereq(overrides: Partial<ApplyPrerequisites> = {}): ApplyPrerequisites {
    return {
      sourceFetched: true, sourceChecksum: SHA, sourceChecksumAlreadyApplied: false, schemaValidated: true, diffGenerated: true,
      hardBlockCount: 0, manualReviewResolved: true,
      backup: {
        runId: "35589905624", category: "pre-apply", conclusion: "success", restoreVerified: true, storageVerified: true,
        rowCounts: { world_player_cards: 13009, managers: 66, player_card_analysis: 19, import_batches: 8 }, completedAt: "2026-09-10T01:00:00.000Z",
      },
      dryRun: { verified: true, startedAt: "2026-09-10T01:10:00.000Z", completedAt: "2026-09-10T01:20:00.000Z", shadowComparisonPassed: true },
      approval: { present: true, approvedAt: "2026-09-10T02:00:00.000Z", expiresAt: "2026-09-10T06:00:00.000Z", boundSourceChecksum: SHA, boundCommitSha: COMMIT },
      applyCommitSha: COMMIT, candidateIsLatest: true, superseded: false, concurrencyLockAcquired: true, duplicateBatchExists: false,
      rollbackPlanPrepared: true, updaterRoleVerified: true, productionPreflightPassed: true, now: "2026-09-10T03:00:00.000Z",
      ...overrides,
    };
  }

  it("全条件を満たせば合格", () => {
    expect(evaluateApplyPrerequisites(prereq())).toEqual({ ok: true, failures: [] });
  });

  it("Backup未確認(run無し・pre-apply以外・失敗・restore/storage未検証)を拒否する", () => {
    const b = prereq().backup;
    expect(evaluateApplyPrerequisites(prereq({ backup: { ...b, runId: null } })).failures).toContain("backup_run_missing");
    expect(evaluateApplyPrerequisites(prereq({ backup: { ...b, category: "daily" } })).failures).toContain("backup_not_pre_apply");
    expect(evaluateApplyPrerequisites(prereq({ backup: { ...b, conclusion: "failure" } })).failures).toContain("backup_not_successful");
    expect(evaluateApplyPrerequisites(prereq({ backup: { ...b, restoreVerified: false } })).failures).toContain("backup_restore_not_verified");
    expect(evaluateApplyPrerequisites(prereq({ backup: { ...b, storageVerified: false } })).failures).toContain("backup_storage_not_verified");
  });

  it("Run #6相当の無効な空Backup(workflowはsuccess・検証フラグはtrue・全table 0行)を拒否する", () => {
    const run6Like = { ...prereq().backup, rowCounts: { world_player_cards: 0, managers: 0, player_card_analysis: 0, import_batches: 0 } };
    const r = evaluateApplyPrerequisites(prereq({ backup: run6Like }));
    expect(r.ok).toBe(false);
    expect(r.failures).toContain("backup_content_policy_failed");
    expect(evaluateApplyPrerequisites(prereq({ backup: { ...prereq().backup, rowCounts: null } })).failures).toContain("backup_content_policy_failed");
  });

  it("Backupはdry runより前に完了し、apply時点で24時間以内である必要がある", () => {
    const b = prereq().backup;
    expect(evaluateApplyPrerequisites(prereq({ backup: { ...b, completedAt: "2026-09-10T01:15:00.000Z" } })).failures).toContain("backup_time_order_invalid");
    expect(evaluateApplyPrerequisites(prereq({ now: "2026-09-11T01:30:00.000Z", approval: { ...prereq().approval, expiresAt: "2026-09-12T00:00:00.000Z" } })).failures).toContain("backup_too_old");
    expect(MAX_BACKUP_AGE_BEFORE_APPLY_HOURS).toBe(24);
  });

  it("dry run未確認・shadow comparison失敗を拒否する", () => {
    expect(evaluateApplyPrerequisites(prereq({ dryRun: { ...prereq().dryRun, verified: false } })).failures).toContain("dry_run_not_verified");
    expect(evaluateApplyPrerequisites(prereq({ dryRun: { ...prereq().dryRun, shadowComparisonPassed: false } })).failures).toContain("shadow_comparison_failed");
  });

  it("承認なし・期限切れ・dry run前の承認・別candidateへの承認・commit不一致を拒否する", () => {
    const a = prereq().approval;
    expect(evaluateApplyPrerequisites(prereq({ approval: { ...a, present: false } })).failures).toContain("approval_missing");
    expect(evaluateApplyPrerequisites(prereq({ approval: { ...a, expiresAt: "2026-09-10T02:30:00.000Z" } })).failures).toContain("approval_expired");
    expect(evaluateApplyPrerequisites(prereq({ approval: { ...a, approvedAt: "2026-09-10T01:15:00.000Z" } })).failures).toContain("approval_expired");
    expect(evaluateApplyPrerequisites(prereq({ approval: { ...a, boundSourceChecksum: "f".repeat(64) } })).failures).toContain("approval_not_bound_to_candidate");
    expect(evaluateApplyPrerequisites(prereq({ applyCommitSha: "0".repeat(40) })).failures).toContain("commit_sha_mismatch");
  });

  it("古いcandidate・superseded・重複batch・lock無し・rollback plan無し・updater role不一致・preflight失敗を拒否する", () => {
    const cases: Array<[Partial<ApplyPrerequisites>, string]> = [
      [{ candidateIsLatest: false }, "candidate_not_latest"],
      [{ superseded: true }, "candidate_superseded"],
      [{ duplicateBatchExists: true }, "duplicate_batch"],
      [{ concurrencyLockAcquired: false }, "concurrency_lock_missing"],
      [{ rollbackPlanPrepared: false }, "rollback_plan_missing"],
      [{ updaterRoleVerified: false }, "updater_role_not_verified"],
      [{ productionPreflightPassed: false }, "production_preflight_failed"],
      [{ sourceChecksumAlreadyApplied: true }, "source_checksum_already_applied"],
      [{ hardBlockCount: 1 }, "hard_block_present"],
      [{ manualReviewResolved: false }, "manual_review_unresolved"],
    ];
    for (const [o, failure] of cases) expect(evaluateApplyPrerequisites(prereq(o)).failures, failure).toContain(failure);
  });

  it("複数の不足を1回の評価ですべて列挙する(fail closed)", () => {
    const r = evaluateApplyPrerequisites(prereq({ sourceFetched: false, schemaValidated: false, concurrencyLockAcquired: false, superseded: true }));
    expect(r.ok).toBe(false);
    expect(r.failures).toEqual(expect.arrayContaining(["source_not_fetched", "schema_not_validated", "concurrency_lock_missing", "candidate_superseded"]));
  });

  it("failureは列挙codeだけで、入力に含まれるURL・Secret・checksum等を一切含めない", () => {
    const r = evaluateApplyPrerequisites(prereq({
      sourceChecksum: "postgresql://user:secret@db.example/postgres",
      applyCommitSha: "AGE-SECRET-KEY-1ZZZ",
      backup: { ...prereq().backup, runId: "https://example.test/run" },
    }));
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/postgresql|secret@|AGE-SECRET|https?:/i);
    for (const f of r.failures) expect(f).toMatch(/^[a-z_]+$/);
  });
});
