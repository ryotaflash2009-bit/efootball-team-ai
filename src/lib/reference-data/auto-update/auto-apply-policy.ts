import { AUTO_APPLY_POLICY } from "./auto-apply-policy-config";

/**
 * 自動 Apply の判定（純関数・決定的: 同じ入力からは常に同じ結果。時刻も入力の now だけを使う）。
 *
 * - AUTO_APPLY_ELIGIBLE: 既知の安全契約にすべて一致 → 承認なしで適用してよい（kill switch が "true" のときだけ）。
 * - MANUAL_APPLY_REQUIRED: 安全の関門は通ったが、自動の契約の外（閾値の超過・許可外の列・Managers の更新など）→ 手動の承認の経路。
 * - AUTO_APPLY_BLOCKED: 安全の関門のどれかが不合格 → Apply しない（手動でも同じ材料では進めない）。
 * - INVALID_INPUT: 入力の形が不正。
 * 1 つでも BLOCKED の理由があれば BLOCKED、次に MANUAL、最後に ELIGIBLE。
 */

export type AutoApplyDecision = "AUTO_APPLY_ELIGIBLE" | "AUTO_APPLY_BLOCKED" | "MANUAL_APPLY_REQUIRED" | "INVALID_INPUT";
type Dataset = "world" | "managers";

export interface AutoApplyPolicyInput {
  dataset: Dataset;
  /** 起動時に binding した main の SHA と、判定の直前に読んだ main の SHA。 */
  bindingSha: string;
  currentMainSha: string;
  /** 検出の要約の sourceChecksum12（Plan の source と一致しなければ候補が古い）。 */
  detectionChecksum12: string | null;
  /** 直近に適用済みの sourceChecksum12（applied-state か、直近の自動 Apply の候補）。同じなら適用済み。 */
  appliedChecksum12: string | null;
  plan: {
    commitSha: string;
    sourceChecksum: string;
    planChecksum: string;
    targetTables: string[];
    beforeCount: number;
    afterCount: number;
    added: number;
    changed: number;
    removed: number;
    duplicate: number;
    invalid: number | null;
    cardRatingOnlyChanged: number | null;
    structuralChanged: number | null;
    changedFields: string[];
    manualReviewCodes: string[];
    futureTimestamps: number | null;
    timestampRegression: boolean | null;
    findings: { severity: string; code: string }[];
    productionCounts: Record<string, number>;
  };
  backup: {
    runId: string;
    valid: boolean;
    encrypted: boolean;
    restoreVerified: boolean;
    storageVerified: boolean;
    rowCounts: Record<string, number>;
    completedAt: string;
  };
  dryRun: { runId: string; ok: boolean; rediff: number | null; sourceChecksum: string; planChecksum: string };
  readiness: { postVerifier: boolean; evidence: boolean; notification: boolean; cleanup: boolean };
  now: string;
}

export interface ThresholdResult {
  name: string;
  value: number | string;
  limit: number | string;
  ok: boolean;
}

export interface AutoApplyPolicyResult {
  contractVersion: string;
  dataset: Dataset | null;
  decision: AutoApplyDecision;
  reasonCodes: string[];
  thresholdResults: ThresholdResult[];
  allowedOperations: string[];
  blockedOperations: string[];
  expectedWrites: string;
  expectedAfterCount: number | null;
  bindingSha: string | null;
  sourceChecksum: string | null;
  planChecksum: string | null;
  backupRunId: string | null;
  dryRunRunId: string | null;
  evaluatedAt: string | null;
}

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const CS12 = /^[0-9a-f]{12}$/;
const RUN = /^[0-9]{1,20}$/;
const int0 = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const BLOCKED_OPERATIONS = ["DELETE", "TRUNCATE", "ALTER", "DROP", "UPDATE managers (existing rows)", "write player_card_analysis", "write auth/user tables", "rollback", "restore"];

function invalid(input: unknown, reasons: string[]): AutoApplyPolicyResult {
  const ds = isObj(input) && (input.dataset === "world" || input.dataset === "managers") ? (input.dataset as Dataset) : null;
  return {
    contractVersion: AUTO_APPLY_POLICY.version, dataset: ds, decision: "INVALID_INPUT", reasonCodes: reasons, thresholdResults: [],
    allowedOperations: [], blockedOperations: BLOCKED_OPERATIONS, expectedWrites: "none", expectedAfterCount: null,
    bindingSha: null, sourceChecksum: null, planChecksum: null, backupRunId: null, dryRunRunId: null,
    evaluatedAt: isObj(input) && typeof input.now === "string" ? input.now : null,
  };
}

/** 入力の形だけを確かめる（値の良し悪しは判定で見る）。 */
function shapeProblems(i: unknown): string[] {
  const p: string[] = [];
  if (!isObj(i)) return ["input_not_object"];
  if (i.dataset !== "world" && i.dataset !== "managers") p.push("dataset_invalid");
  for (const k of ["bindingSha", "currentMainSha"]) if (typeof i[k] !== "string" || !SHA40.test(i[k] as string)) p.push(`${k}_invalid`);
  for (const k of ["detectionChecksum12", "appliedChecksum12"]) if (i[k] !== null && (typeof i[k] !== "string" || !CS12.test(i[k] as string))) p.push(`${k}_invalid`);
  if (typeof i.now !== "string" || !Number.isFinite(Date.parse(i.now))) p.push("now_invalid");
  const plan = i.plan;
  if (!isObj(plan)) p.push("plan_missing");
  else {
    if (typeof plan.commitSha !== "string" || !SHA40.test(plan.commitSha)) p.push("plan_commitSha_invalid");
    for (const k of ["sourceChecksum", "planChecksum"]) if (typeof plan[k] !== "string" || !SHA64.test(plan[k] as string)) p.push(`plan_${k}_invalid`);
    for (const k of ["beforeCount", "afterCount", "added", "changed", "removed", "duplicate"]) if (!int0(plan[k])) p.push(`plan_${k}_invalid`);
    for (const k of ["targetTables", "changedFields", "manualReviewCodes", "findings"]) if (!Array.isArray(plan[k])) p.push(`plan_${k}_invalid`);
    if (!isObj(plan.productionCounts)) p.push("plan_productionCounts_invalid");
  }
  const b = i.backup;
  if (!isObj(b)) p.push("backup_missing");
  else {
    if (typeof b.runId !== "string" || !RUN.test(b.runId)) p.push("backup_runId_invalid");
    if (!isObj(b.rowCounts)) p.push("backup_rowCounts_invalid");
    if (typeof b.completedAt !== "string" || !Number.isFinite(Date.parse(b.completedAt))) p.push("backup_completedAt_invalid");
  }
  const d = i.dryRun;
  if (!isObj(d)) p.push("dry_run_missing");
  else if (typeof d.runId !== "string" || !RUN.test(d.runId)) p.push("dry_run_runId_invalid");
  if (!isObj(i.readiness)) p.push("readiness_missing");
  return p;
}

export function evaluateAutoApplyPolicy(input: AutoApplyPolicyInput): AutoApplyPolicyResult {
  const shape = shapeProblems(input);
  if (shape.length) return invalid(input, shape);
  const { dataset, plan, backup, dryRun } = input;
  const cfgTarget = dataset === "world" ? AUTO_APPLY_POLICY.world.targetTable : AUTO_APPLY_POLICY.managers.targetTable;
  const blocked: string[] = [];
  const manual: string[] = [];
  const thresholds: ThresholdResult[] = [];
  const check = (name: string, value: number | string, limit: number | string, ok: boolean, onFail: "blocked" | "manual", code: string) => {
    thresholds.push({ name, value, limit, ok });
    if (!ok) (onFail === "blocked" ? blocked : manual).push(code);
  };

  // --- binding・候補の新しさ
  if (input.bindingSha !== input.currentMainSha) blocked.push("main_sha_changed");
  if (plan.commitSha !== input.bindingSha) blocked.push("plan_commit_sha_mismatch");
  const source12 = plan.sourceChecksum.slice(0, 12);
  if (input.detectionChecksum12 === null || input.detectionChecksum12 !== source12) blocked.push("candidate_stale");
  if (input.appliedChecksum12 !== null && input.appliedChecksum12 === source12) blocked.push("candidate_already_applied");

  // --- 差分の安全条件（自動でも手動でも同じ）
  if (plan.removed !== 0) blocked.push("removed_not_zero");
  if (plan.duplicate !== 0) blocked.push("duplicate_not_zero");
  if (plan.invalid !== 0) blocked.push(plan.invalid === null ? "invalid_count_missing" : "invalid_not_zero");
  if (plan.findings.some((f) => f.severity === "hard_block")) blocked.push("hard_block");
  if (plan.findings.some((f) => /schema_drift/.test(f.code) && f.severity !== "warning")) blocked.push("schema_drift");
  if (plan.targetTables.length !== 1 || plan.targetTables[0] !== cfgTarget) blocked.push("unexpected_target_table");
  if (plan.afterCount < plan.beforeCount) blocked.push("count_drop");
  if (plan.afterCount !== plan.beforeCount + plan.added) blocked.push("after_count_mismatch");
  if (plan.futureTimestamps !== null && plan.futureTimestamps !== 0) blocked.push("future_timestamp");
  if (plan.timestampRegression === true) blocked.push("timestamp_regression");
  if (dataset === "world" && (plan.futureTimestamps === null || plan.timestampRegression === null)) blocked.push("timestamp_summary_missing");

  // --- Backup
  const expiresAt = Date.parse(backup.completedAt) + AUTO_APPLY_POLICY.backupValidHours * 3_600_000;
  if (!backup.valid) blocked.push("backup_invalid");
  if (!backup.encrypted) blocked.push("backup_not_encrypted");
  if (!backup.restoreVerified) blocked.push("backup_restore_unverified");
  if (!backup.storageVerified) blocked.push("backup_storage_unverified");
  if (Date.parse(input.now) >= expiresAt) blocked.push("backup_expired");
  if (Date.parse(backup.completedAt) > Date.parse(input.now)) blocked.push("backup_completed_in_future");
  if (backup.rowCounts[cfgTarget] !== plan.beforeCount) blocked.push("backup_count_mismatch");
  for (const [t, n] of Object.entries(plan.productionCounts)) if (backup.rowCounts[t] !== n) blocked.push(`backup_count_mismatch:${t}`);

  // --- Dry run
  if (!dryRun.ok) blocked.push("dry_run_failed");
  if (dryRun.rediff !== 0) blocked.push("rediff_not_zero");
  if (dryRun.sourceChecksum !== plan.sourceChecksum || dryRun.planChecksum !== plan.planChecksum) blocked.push("checksum_mismatch");

  // --- 準備
  for (const k of ["postVerifier", "evidence", "notification", "cleanup"] as const) if (input.readiness[k] !== true) blocked.push(`${k}_not_ready`);

  // --- dataset ごとの自動の契約（外れたら手動の経路）
  if (dataset === "world") {
    const w = AUTO_APPLY_POLICY.world;
    const denom = Math.max(plan.beforeCount, 1);
    check("world.addRatio", Number((plan.added / denom).toFixed(6)), w.maxAddRatio, plan.added / denom <= w.maxAddRatio, "manual", "threshold_add_ratio");
    check("world.updateRatio", Number((plan.changed / denom).toFixed(6)), w.maxUpdateRatio, plan.changed / denom <= w.maxUpdateRatio, "manual", "threshold_update_ratio");
    if (plan.structuralChanged === null || plan.cardRatingOnlyChanged === null) manual.push("change_breakdown_missing");
    else {
      check("world.structuralChanged", plan.structuralChanged, w.maxStructuralChanged, plan.structuralChanged <= w.maxStructuralChanged, "manual", "threshold_structural");
      if (plan.structuralChanged + plan.cardRatingOnlyChanged !== plan.changed) manual.push("change_breakdown_inconsistent");
    }
    const unknown = plan.changedFields.filter((f) => !(w.changedFieldAllowlist as readonly string[]).includes(f));
    check("world.unknownChangedFields", unknown.length, 0, unknown.length === 0, "manual", "unknown_changed_field");
    for (const c of plan.manualReviewCodes) if (!(w.allowedManualReviewCodes as readonly string[]).includes(c)) manual.push(`manual_review:${c}`);
  } else {
    const m = AUTO_APPLY_POLICY.managers;
    check("managers.added", plan.added, m.maxAdded, plan.added <= m.maxAdded, "manual", "threshold_managers_added");
    check("managers.updated", plan.changed, m.maxUpdated, plan.changed <= m.maxUpdated, "manual", "managers_update");
    if (plan.changedFields.length > 0) manual.push("managers_changed_fields");
    for (const c of plan.manualReviewCodes) if (!(m.allowedManualReviewCodes as readonly string[]).includes(c)) manual.push(`manual_review:${c}`);
  }
  if (plan.added + plan.changed === 0) blocked.push("no_changes");

  const decision: AutoApplyDecision = blocked.length ? "AUTO_APPLY_BLOCKED" : manual.length ? "MANUAL_APPLY_REQUIRED" : "AUTO_APPLY_ELIGIBLE";
  const allowed = dataset === "world" ? [`INSERT ${cfgTarget}`, `UPDATE ${cfgTarget} (${AUTO_APPLY_POLICY.world.changedFieldAllowlist.join(", ")})`, "INSERT import_batches (1 audit row)"] : [`INSERT ${cfgTarget}`, "INSERT import_batches (1 audit row)"];
  return {
    contractVersion: AUTO_APPLY_POLICY.version,
    dataset,
    decision,
    reasonCodes: [...blocked, ...manual],
    thresholdResults: thresholds,
    allowedOperations: decision === "AUTO_APPLY_ELIGIBLE" ? allowed : [],
    blockedOperations: BLOCKED_OPERATIONS,
    expectedWrites: `${cfgTarget}: insert ${plan.added}, update ${plan.changed} (1 transaction); import_batches: 1 audit row; no DELETE/TRUNCATE`,
    expectedAfterCount: plan.afterCount,
    bindingSha: input.bindingSha,
    sourceChecksum: plan.sourceChecksum,
    planChecksum: plan.planChecksum,
    backupRunId: backup.runId,
    dryRunRunId: dryRun.runId,
    evaluatedAt: input.now,
  };
}
