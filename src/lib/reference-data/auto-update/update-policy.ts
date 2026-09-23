import { evaluateBackupContentPolicy, PRODUCTION_BACKUP_CONTENT_POLICY } from "./backup-content-policy";
import { isSha256Hex, type PolicySeverity, type ReferenceTable } from "./update-contract";

/**
 * Production参照データ自動更新のsafety policyとapply前提条件(Phase A、純関数のみ)。
 *
 * 閾値はレビュー済みのコード定数であり、環境変数・設定ファイル・引数では変更できない
 * (このモジュールは環境変数を一切読まない)。変更はテスト付きのPRレビューだけで行う。
 * 数値は「推奨初期値」であり、最初の有効なdry run以降の実績でcalibrateする。
 * Run #7 Backupの件数(13009/66/19/8)は自動更新のbaselineとして直接使わない
 * (Backup件数と更新対象件数は別物で、import_batchesは累積する)。
 */

export const SEVERITY_ORDER: readonly PolicySeverity[] = Object.freeze(["pass", "warning", "manual_review", "hard_block"]);

export function maxSeverity(a: PolicySeverity, b: PolicySeverity): PolicySeverity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

export interface UpdatePolicyThresholds {
  readonly status: "recommended_initial_values";
  readonly worldPlayerCards: {
    /** 前回比の件数減少率がこれを超えたらhard block(推奨2%)。0より大きい減少はmanual review。 */
    readonly countDropHardBlockRatio: number;
    /** added+changedがこれを超えたらmanual review(推奨7500 = 既存incremental syncの既定上限500件×15page)。 */
    readonly addedPlusChangedManualReview: number;
    /** added+changedがmanual review閾値のこの割合以上ならwarning(閾値直前の変化)。 */
    readonly nearThresholdWarningRatio: number;
    /** 件数増加率がこれを超えたらwarning(追加自体は正常だが規模を可視化する)。 */
    readonly countIncreaseWarningRatio: number;
  };
  readonly managers: {
    /** 件数減少率がこれを超えたらhard block(推奨10%)。0より大きい減少はmanual review。 */
    readonly countDropHardBlockRatio: number;
  };
  readonly batch: {
    /** 直前のapplyからこの時間未満の再applyはmanual review(推奨24時間)。 */
    readonly minHoursBetweenApplies: number;
    /** payload sizeがbaseline比でこの割合以上変化したらmanual review(推奨50%)。 */
    readonly payloadSizeChangeManualReviewRatio: number;
  };
}

export const UPDATE_POLICY_THRESHOLDS: UpdatePolicyThresholds = Object.freeze({
  status: "recommended_initial_values",
  worldPlayerCards: Object.freeze({
    countDropHardBlockRatio: 0.02,
    addedPlusChangedManualReview: 7500,
    nearThresholdWarningRatio: 0.8,
    countIncreaseWarningRatio: 0.02,
  }),
  managers: Object.freeze({ countDropHardBlockRatio: 0.1 }),
  batch: Object.freeze({ minHoursBetweenApplies: 24, payloadSizeChangeManualReviewRatio: 0.5 }),
});

export interface TablePolicyCounts {
  beforeCount: number;
  afterCount: number;
  addedCount: number;
  changedCount: number;
  removedCount: number;
  resurrectedCount: number;
  duplicateCount: number;
  invalidCount: number;
  schemaDriftCount: number;
  sourceMissingCount: number;
  /** 人がreviewで承認済みのremoved件数(未承認のremovedはmanual review)。 */
  approvedRemovalCount: number;
}

export interface UpdatePolicyInput {
  sourceFetchFailed: boolean;
  sourceParseFailed: boolean;
  checksumGenerationFailed: boolean;
  /** 契約外table(auth.*・user data・未知table)が候補に含まれていた件数。 */
  unexpectedTableCount: number;
  userOrAuthDataDetected: boolean;
  identityReuseConflictCount: number;
  sourceTimestampRegression: boolean;
  sourceChecksumAlreadyApplied: boolean;
  physicalDeleteAttempted: boolean;
  /** player_card_analysis(frozen)への変更候補件数。 */
  frozenTableMutationCount: number;
  /** 既存import_batches行(当該batch以外)への変更候補件数。 */
  existingImportBatchMutationCount: number;
  tables: Readonly<Partial<Record<"world_player_cards" | "managers", TablePolicyCounts>>>;
  /** baseline(前回の有効なdry run/適用)。初回はnullで、その場合はmanual reviewに倒す。 */
  baseline: { payloadBytes: number } | null;
  payloadBytes: number;
  lastAppliedAt: string | null;
  now: string;
}

export interface PolicyFinding {
  severity: PolicySeverity;
  code: string;
  table?: ReferenceTable;
  message: string;
}

export interface PolicyResult {
  severity: PolicySeverity;
  findings: PolicyFinding[];
}

function finding(severity: PolicySeverity, code: string, message: string, table?: ReferenceTable): PolicyFinding {
  return table ? { severity, code, table, message } : { severity, code, message };
}

function dropRatio(before: number, after: number): number {
  return before > 0 && after < before ? (before - after) / before : 0;
}

/** 更新候補を評価する。重大度はhard_block > manual_review > warning > passの優先順で集約する。 */
export function evaluateUpdatePolicy(input: UpdatePolicyInput): PolicyResult {
  const thresholds = UPDATE_POLICY_THRESHOLDS;
  const findings: PolicyFinding[] = [];
  const hard = (code: string, message: string, table?: ReferenceTable) => findings.push(finding("hard_block", code, message, table));
  const review = (code: string, message: string, table?: ReferenceTable) => findings.push(finding("manual_review", code, message, table));
  const warn = (code: string, message: string, table?: ReferenceTable) => findings.push(finding("warning", code, message, table));

  if (input.sourceFetchFailed) hard("source_fetch_failure", "source取得に失敗した");
  if (input.sourceParseFailed) hard("source_parse_failure", "sourceの解析に失敗した");
  if (input.checksumGenerationFailed) hard("checksum_failure", "checksumを生成できない");
  if (input.unexpectedTableCount > 0) hard("unexpected_table", "契約外のtableが含まれている");
  if (input.userOrAuthDataDetected) hard("user_or_auth_data", "user/auth dataが含まれている");
  if (input.identityReuseConflictCount > 0) hard("identity_reuse_conflict", "identityの再利用衝突がある");
  if (input.sourceTimestampRegression) hard("source_timestamp_regression", "sourceの更新時刻が前回より古い");
  if (input.sourceChecksumAlreadyApplied) hard("source_checksum_already_applied", "同じsource checksumは適用済み");
  if (input.physicalDeleteAttempted) hard("physical_delete_attempt", "物理削除は禁止");
  if (input.frozenTableMutationCount > 0) hard("frozen_table_mutation", "player_card_analysisは自動更新の対象外", "player_card_analysis");
  if (input.existingImportBatchMutationCount > 0) hard("import_batches_mutation", "既存のimport_batches行は変更できない(append only)", "import_batches");

  const world = input.tables.world_player_cards;
  const managers = input.tables.managers;
  if (!world && !managers) hard("no_target_table", "対象tableの差分が無い");

  for (const [table, counts] of [["world_player_cards", world], ["managers", managers]] as const) {
    if (!counts) continue;
    if (counts.duplicateCount > 0) hard("duplicate_identity", "重複identityがある", table);
    if (counts.invalidCount > 0) hard("invalid_values", "不正な値(数値・jsonb・text[]・timestamp等)がある", table);
    if (counts.schemaDriftCount > 0) hard("schema_drift", "schema driftがある", table);
    if (counts.sourceMissingCount > 0) hard("source_missing", "sourceの一部が取得できていない", table);
    if (counts.afterCount === 0) hard("core_table_zero_rows", "更新後の件数が0", table);
    if (counts.resurrectedCount > 0) review("resurrected", "tombstone履歴のidentityが再出現した", table);
    const unapprovedRemovals = counts.removedCount - Math.min(counts.approvedRemovalCount, counts.removedCount);
    if (unapprovedRemovals > 0) review("unapproved_removal", "未承認のremoved(tombstone候補)がある", table);
  }

  if (world) {
    const drop = dropRatio(world.beforeCount, world.afterCount);
    if (drop > thresholds.worldPlayerCards.countDropHardBlockRatio) hard("world_count_drop", "World cardの件数減少が閾値を超えた", "world_player_cards");
    else if (drop > 0) review("world_count_drop", "World cardの件数が減少した", "world_player_cards");
    const volume = world.addedCount + world.changedCount;
    if (volume > thresholds.worldPlayerCards.addedPlusChangedManualReview) review("world_large_change", "World cardのadded+changedが閾値を超えた", "world_player_cards");
    else if (volume >= thresholds.worldPlayerCards.addedPlusChangedManualReview * thresholds.worldPlayerCards.nearThresholdWarningRatio) warn("world_change_near_threshold", "World cardのadded+changedが閾値に近い", "world_player_cards");
    if (world.beforeCount > 0 && (world.afterCount - world.beforeCount) / world.beforeCount > thresholds.worldPlayerCards.countIncreaseWarningRatio) warn("world_count_increase", "World cardの件数増加が大きい", "world_player_cards");
    else if (world.addedCount > 0) warn("world_additions", "World cardの追加がある", "world_player_cards");
  }

  if (managers) {
    const drop = dropRatio(managers.beforeCount, managers.afterCount);
    if (drop > thresholds.managers.countDropHardBlockRatio) hard("manager_count_drop", "managerの件数減少が閾値を超えた", "managers");
    else if (drop > 0) review("manager_count_drop", "managerの件数が減少した", "managers");
    if (managers.addedCount + managers.changedCount + managers.removedCount > 0) review("manager_change", "managerの変更はすべてreviewする", "managers");
  }

  if (input.baseline === null) {
    review("baseline_missing", "baselineが無い(初回はreviewする)");
  } else if (input.baseline.payloadBytes > 0) {
    const ratio = Math.abs(input.payloadBytes - input.baseline.payloadBytes) / input.baseline.payloadBytes;
    if (ratio >= thresholds.batch.payloadSizeChangeManualReviewRatio) review("payload_size_anomaly", "payload sizeがbaselineから大きく変化した");
  } else {
    review("baseline_invalid", "baselineのpayload sizeが不正");
  }

  if (input.lastAppliedAt !== null) {
    const hours = (Date.parse(input.now) - Date.parse(input.lastAppliedAt)) / 3_600_000;
    if (!Number.isFinite(hours) || hours < 0) hard("invalid_apply_time", "直前のapply時刻が不正");
    else if (hours < thresholds.batch.minHoursBetweenApplies) review("frequent_update", "直前のapplyから短時間で再applyしようとしている");
  }

  const severity = findings.reduce<PolicySeverity>((acc, f) => maxSeverity(acc, f.severity), "pass");
  return { severity, findings };
}

// ---------------------------------------------------------------------------
// Apply prerequisites (data contract only; Phase A reads no GitHub run and no Production)
// ---------------------------------------------------------------------------

/** pre-apply Backupは適用直前のものに限る(推奨: apply時点で24時間以内)。 */
export const MAX_BACKUP_AGE_BEFORE_APPLY_HOURS = 24;

export interface ApplyPrerequisites {
  sourceFetched: boolean;
  sourceChecksum: string | null;
  sourceChecksumAlreadyApplied: boolean;
  schemaValidated: boolean;
  diffGenerated: boolean;
  hardBlockCount: number;
  manualReviewResolved: boolean;
  backup: {
    runId: string | null;
    category: string | null;
    conclusion: string | null;
    restoreVerified: boolean;
    storageVerified: boolean;
    rowCounts: Readonly<Record<string, unknown>> | null;
    completedAt: string | null;
  };
  dryRun: { verified: boolean; startedAt: string | null; completedAt: string | null; shadowComparisonPassed: boolean };
  approval: { present: boolean; approvedAt: string | null; expiresAt: string | null; boundSourceChecksum: string | null; boundCommitSha: string | null };
  applyCommitSha: string | null;
  candidateIsLatest: boolean;
  superseded: boolean;
  concurrencyLockAcquired: boolean;
  duplicateBatchExists: boolean;
  rollbackPlanPrepared: boolean;
  updaterRoleVerified: boolean;
  productionPreflightPassed: boolean;
  now: string;
}

export type ApplyGateFailure =
  | "source_not_fetched"
  | "source_checksum_missing"
  | "source_checksum_already_applied"
  | "schema_not_validated"
  | "diff_not_generated"
  | "hard_block_present"
  | "manual_review_unresolved"
  | "backup_run_missing"
  | "backup_not_pre_apply"
  | "backup_not_successful"
  | "backup_restore_not_verified"
  | "backup_storage_not_verified"
  | "backup_content_policy_failed"
  | "backup_time_order_invalid"
  | "backup_too_old"
  | "dry_run_not_verified"
  | "shadow_comparison_failed"
  | "approval_missing"
  | "approval_expired"
  | "approval_not_bound_to_candidate"
  | "commit_sha_mismatch"
  | "candidate_not_latest"
  | "candidate_superseded"
  | "concurrency_lock_missing"
  | "duplicate_batch"
  | "rollback_plan_missing"
  | "updater_role_not_verified"
  | "production_preflight_failed";

const SHA_RE = /^[0-9a-f]{40}$/;

function time(value: string | null): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Production applyの必須gateを検証し、満たしていない項目をすべて列挙する(1件でもあればapply不可)。
 * failureは列挙型のcodeだけで、入力値(URL・Secret・checksum等)を含めない。
 */
export function evaluateApplyPrerequisites(p: ApplyPrerequisites): { ok: boolean; failures: ApplyGateFailure[] } {
  const f: ApplyGateFailure[] = [];
  if (p.sourceFetched !== true) f.push("source_not_fetched");
  if (!isSha256Hex(p.sourceChecksum)) f.push("source_checksum_missing");
  if (p.sourceChecksumAlreadyApplied !== false) f.push("source_checksum_already_applied");
  if (p.schemaValidated !== true) f.push("schema_not_validated");
  if (p.diffGenerated !== true) f.push("diff_not_generated");
  if (!Number.isInteger(p.hardBlockCount) || p.hardBlockCount !== 0) f.push("hard_block_present");
  if (p.manualReviewResolved !== true) f.push("manual_review_unresolved");

  const b = p.backup;
  if (typeof b.runId !== "string" || !/^[0-9]{1,20}$/.test(b.runId)) f.push("backup_run_missing");
  if (b.category !== "pre-apply") f.push("backup_not_pre_apply");
  if (b.conclusion !== "success") f.push("backup_not_successful");
  if (b.restoreVerified !== true) f.push("backup_restore_not_verified");
  if (b.storageVerified !== true) f.push("backup_storage_not_verified");
  // Run #6のような空Backupは、workflowがsuccessでも既存の内容妥当性policyで必ず拒否する。
  if (!b.rowCounts || evaluateBackupContentPolicy(b.rowCounts, PRODUCTION_BACKUP_CONTENT_POLICY).some((c) => !c.ok)) f.push("backup_content_policy_failed");

  const backupAt = time(b.completedAt);
  const dryStart = time(p.dryRun.startedAt);
  const dryEnd = time(p.dryRun.completedAt);
  const approvedAt = time(p.approval.approvedAt);
  const expiresAt = time(p.approval.expiresAt);
  const now = time(p.now);
  // 状態機械の順序: backup_verified → dry_run_started → dry_run_verified → 承認 → apply
  if (backupAt === null || dryStart === null || dryEnd === null || now === null || backupAt > dryStart || dryStart > dryEnd || dryEnd > now) {
    f.push("backup_time_order_invalid");
  } else if (now - backupAt > MAX_BACKUP_AGE_BEFORE_APPLY_HOURS * 3_600_000) {
    f.push("backup_too_old");
  }

  if (p.dryRun.verified !== true) f.push("dry_run_not_verified");
  if (p.dryRun.shadowComparisonPassed !== true) f.push("shadow_comparison_failed");

  if (p.approval.present !== true || approvedAt === null) {
    f.push("approval_missing");
  } else {
    if (expiresAt === null || now === null || now >= expiresAt || (dryEnd !== null && approvedAt < dryEnd)) f.push("approval_expired");
    if (!isSha256Hex(p.approval.boundSourceChecksum) || p.approval.boundSourceChecksum !== p.sourceChecksum) f.push("approval_not_bound_to_candidate");
  }
  if (typeof p.applyCommitSha !== "string" || !SHA_RE.test(p.applyCommitSha) || p.approval.boundCommitSha !== p.applyCommitSha) f.push("commit_sha_mismatch");

  if (p.candidateIsLatest !== true) f.push("candidate_not_latest");
  if (p.superseded !== false) f.push("candidate_superseded");
  if (p.concurrencyLockAcquired !== true) f.push("concurrency_lock_missing");
  if (p.duplicateBatchExists !== false) f.push("duplicate_batch");
  if (p.rollbackPlanPrepared !== true) f.push("rollback_plan_missing");
  if (p.updaterRoleVerified !== true) f.push("updater_role_not_verified");
  if (p.productionPreflightPassed !== true) f.push("production_preflight_failed");

  return { ok: f.length === 0, failures: f };
}
