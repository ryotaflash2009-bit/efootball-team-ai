import { validateBackupV2Summary } from "./backup-v2-summary-validator";

/**
 * 更新パイプラインの自動進行の判定（`reference-data-update-orchestrator.yml` から使う純関数）。
 *
 * - 入力は各runの非秘密の要約artifactだけ。Production・Secret・R2には触れない。
 * - どの段階でも、条件を1つでも満たさなければ「進まない（Apply runを作らない）」と判定する。欠けた情報は失敗扱い。
 * - 本人の承認は Apply run の Environment 承認1回だけ。ここで作る承認コメントと要約は、その判断材料。
 */

export type Dataset = "world" | "managers";
export type Gate<T = Record<string, unknown>> = { ok: true; value: T } | { ok: false; reasons: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const SHA256 = /^[0-9a-f]{64}$/;
const int0 = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;

function parse(text: string, label: string): Obj | string {
  try {
    const v = JSON.parse(text) as unknown;
    return isObj(v) ? v : `${label}_not_object`;
  } catch {
    return `${label}_not_json`;
  }
}

// ---------------------------------------------------------------------------
// 1. Detection
// ---------------------------------------------------------------------------

/** 検出要約から、自動で進める dataset を決める（World 優先・1回に1つ）。 */
export function decideFromDetection(text: string): Gate<{ dataset: Dataset; pending: Dataset[] }> {
  const s = parse(text, "detection");
  if (typeof s === "string") return { ok: false, reasons: [s] };
  if (s.ok !== true) return { ok: false, reasons: ["detection_not_ok"] };
  const decision = (d: unknown) => (isObj(d) ? d.decision : undefined);
  const world = decision(s.world);
  const managers = decision(s.managers);
  if (world === "attention_required" || managers === "attention_required") return { ok: false, reasons: ["detection_attention_required"] };
  const want: Dataset[] = [];
  if (world === "update_available") want.push("world");
  if (managers === "update_available") want.push("managers");
  if (want.length === 0) return { ok: false, reasons: ["no_update_available"] };
  return { ok: true, value: { dataset: want[0], pending: want.slice(1) } };
}

// ---------------------------------------------------------------------------
// 2. Plan
// ---------------------------------------------------------------------------

export interface PlanFacts {
  dataset: Dataset;
  commitSha: string;
  sourceChecksum: string;
  planChecksum: string;
  manualReviewCodes: string[];
  acknowledge: string;
  targetTables: string[];
  beforeCount: number;
  afterCount: number;
  added: number;
  changed: number;
  cardRatingOnlyChanged: number | null;
  structuralChanged: number | null;
  changedFields: string[];
  removed: number;
  duplicate: number;
  invalid: number | null;
  productionCounts: Record<string, number>;
  futureTimestamps: number | null;
  timestampRegression: boolean | null;
  findings: { severity: string; code: string }[];
}

const TARGET: Record<Dataset, string> = { world: "world_player_cards", managers: "managers" };

export function evaluatePlanGate(text: string, dataset: Dataset, expectedSha: string): Gate<PlanFacts> {
  const s = parse(text, "plan");
  if (typeof s === "string") return { ok: false, reasons: [s] };
  const reasons: string[] = [];
  if (s.ok !== true) reasons.push("plan_not_ok");
  if (s.phase !== "plan") reasons.push("plan_wrong_phase");
  for (const r of Array.isArray(s.reasons) ? s.reasons : []) reasons.push(`plan:${String(r)}`);
  const f = isObj(s.facts) ? s.facts : {};
  const p = isObj(f.plan) ? f.plan : null;
  if (!p) return { ok: false, reasons: [...reasons, "plan_facts_missing"] };
  if (f.commitSha !== expectedSha) reasons.push("plan_commit_sha_mismatch");
  if (dataset === "world" && f.dataset !== "world") reasons.push("plan_dataset_mismatch");
  const targets = Array.isArray(p.targetTables) ? p.targetTables.map(String) : [];
  if (targets.length !== 1 || targets[0] !== TARGET[dataset]) reasons.push("plan_unexpected_target_tables");
  for (const k of ["sourceChecksum", "planChecksum"]) if (typeof p[k] !== "string" || !SHA256.test(p[k] as string)) reasons.push(`plan_${k}_invalid`);
  for (const k of ["beforeCount", "afterCount", "addedCount", "changedCount", "removedCount", "duplicateCount"]) if (!int0(p[k])) reasons.push(`plan_${k}_invalid`);
  if (p.removedCount !== 0) reasons.push("plan_removed_not_zero");
  if (p.duplicateCount !== 0) reasons.push("plan_duplicate_not_zero");
  if (p.invalidCount !== undefined && p.invalidCount !== 0) reasons.push("plan_invalid_not_zero");
  if (Array.isArray(p.planProblems) && p.planProblems.length > 0) for (const x of p.planProblems) reasons.push(`plan_problem:${String(x)}`);
  const findings = Array.isArray(p.findings) ? (p.findings as Obj[]).map((x) => ({ severity: String(x.severity), code: String(x.code) })) : [];
  if (findings.some((x) => x.severity === "hard_block")) reasons.push("plan_hard_block");
  const ts = isObj(p.sourceTimestamps) ? p.sourceTimestamps : null;
  if (dataset === "world") {
    if (!ts) reasons.push("plan_timestamps_missing");
    else {
      if (ts.futureCount !== 0) reasons.push("plan_future_timestamps");
      if (ts.regression !== false) reasons.push("plan_timestamp_regression");
    }
  }
  if (int0(p.addedCount) && int0(p.changedCount) && (p.addedCount as number) + (p.changedCount as number) === 0) reasons.push("plan_no_changes");
  const codes = Array.isArray(p.manualReviewCodes) ? p.manualReviewCodes.map(String) : [];
  if (codes.some((c) => !/^[a-z_]+$/.test(c))) reasons.push("plan_manual_review_codes_invalid");
  if (reasons.length > 0) return { ok: false, reasons };
  const counts = isObj(f.productionCounts) ? Object.fromEntries(Object.entries(f.productionCounts).filter(([, v]) => int0(v))) as Record<string, number> : {};
  return {
    ok: true,
    value: {
      dataset,
      commitSha: expectedSha,
      sourceChecksum: p.sourceChecksum as string,
      planChecksum: p.planChecksum as string,
      manualReviewCodes: codes,
      acknowledge: codes.length === 0 ? "none" : codes.join(","),
      targetTables: targets,
      beforeCount: p.beforeCount as number,
      afterCount: p.afterCount as number,
      added: p.addedCount as number,
      changed: p.changedCount as number,
      cardRatingOnlyChanged: int0(p.cardRatingOnlyChangedCount) ? (p.cardRatingOnlyChangedCount as number) : null,
      structuralChanged: int0(p.structuralChangedCount) ? (p.structuralChangedCount as number) : null,
      changedFields: isObj(p.changedFieldFrequency) ? Object.keys(p.changedFieldFrequency).sort() : [],
      removed: 0,
      duplicate: 0,
      invalid: p.invalidCount === undefined ? null : 0,
      productionCounts: counts,
      futureTimestamps: ts ? (ts.futureCount as number) : null,
      timestampRegression: ts ? (ts.regression as boolean) : null,
      findings,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Backup
// ---------------------------------------------------------------------------

export interface BackupFacts {
  runId: string;
  objectKeyRecorded: boolean;
  rowCounts: Record<string, number>;
  restoreVerified: true;
  storageVerified: true;
}

export function evaluateBackupGate(text: string, runId: string, planCounts: Record<string, number>): Gate<BackupFacts> {
  const v = validateBackupV2Summary(text, { expectedCategory: "pre-apply", baselineRowCounts: null });
  const reasons = v.problems.map((p) => `backup:${p}`);
  if (!v.ok) reasons.unshift("backup_not_valid");
  const rowCounts = isObj(v.facts.rowCounts) ? (v.facts.rowCounts as Record<string, number>) : {};
  for (const t of ["world_player_cards", "managers", "import_batches"]) {
    if (planCounts[t] !== undefined && rowCounts[t] !== planCounts[t]) reasons.push(`backup_counts_differ_from_plan:${t}`);
  }
  const s = parse(text, "backup");
  const jobId = typeof s === "string" ? null : isObj(s.summary) ? s.summary.jobId : null;
  if (jobId !== `gha-${runId}-1`) reasons.push("backup_summary_not_from_this_run");
  if (reasons.length > 0) return { ok: false, reasons };
  return { ok: true, value: { runId, objectKeyRecorded: typeof v.facts.objectKey === "string", rowCounts, restoreVerified: true, storageVerified: true } };
}

// ---------------------------------------------------------------------------
// 4. Dry run
// ---------------------------------------------------------------------------

export interface DryRunFacts {
  rediffChanges: 0;
  afterChecksumMatches: true;
  undoOk: true;
  postVerifyOk: true;
}

export function evaluateDryRunGate(text: string, plan: PlanFacts, backupRunId: string): Gate<DryRunFacts> {
  const s = parse(text, "dry_run");
  if (typeof s === "string") return { ok: false, reasons: [s] };
  const reasons: string[] = [];
  if (s.ok !== true) reasons.push("dry_run_not_ok");
  if (s.phase !== "dry-run") reasons.push("dry_run_wrong_phase");
  for (const r of Array.isArray(s.reasons) ? s.reasons : []) reasons.push(`dry_run:${String(r)}`);
  const f = isObj(s.facts) ? s.facts : {};
  const p = isObj(f.plan) ? f.plan : {};
  if (p.sourceChecksum !== plan.sourceChecksum) reasons.push("dry_run_source_checksum_mismatch");
  if (p.planChecksum !== plan.planChecksum) reasons.push("dry_run_plan_checksum_mismatch");
  if (String(f.backupRunId ?? "") !== backupRunId) reasons.push("dry_run_backup_run_mismatch");
  const iso = isObj(f.isolated) ? f.isolated : {};
  const dry = isObj(iso.dryRun) ? iso.dryRun : {};
  const exec = isObj(iso.executor) ? iso.executor : {};
  const undo = isObj(iso.undo) ? iso.undo : {};
  if (iso.verified !== true) reasons.push("dry_run_isolated_not_verified");
  if (dry.rediffChanges !== 0) reasons.push("dry_run_rediff_not_zero");
  if (dry.observedAfterChecksumMatches !== true) reasons.push("dry_run_after_checksum_mismatch");
  if (exec.applyOk !== true || exec.postVerifyOk !== true || exec.auditBatchVerified !== true) reasons.push("dry_run_executor_not_verified");
  if (undo.ok !== true) reasons.push("dry_run_undo_simulation_failed");
  if (reasons.length > 0) return { ok: false, reasons };
  return { ok: true, value: { rediffChanges: 0, afterChecksumMatches: true, undoOk: true, postVerifyOk: true } };
}

// ---------------------------------------------------------------------------
// 5. 承認画面（本人の1回分）
// ---------------------------------------------------------------------------

export function buildApprovalRequest(input: {
  dataset: Dataset;
  plan: PlanFacts;
  planRunId: string;
  backupRunId: string;
  backupCompletedAt: string;
  dryRunRunId: string;
  applyRunUrl: string | null;
}): { comment: string; markdown: string; json: Record<string, unknown> } {
  const p = input.plan;
  const sha7 = p.commitSha.slice(0, 7);
  const expiry = new Date(Date.parse(input.backupCompletedAt) + 24 * 3_600_000).toISOString();
  const tables = `${p.targetTables.join(", ")}, import_batches`;
  const notApproved =
    input.dataset === "world"
      ? "Managers、player_card_analysis、削除、Rollback、Restore"
      : "World、player_card_analysis、削除、Rollback、Restore";
  const comment =
    `${input.dataset === "world" ? "World" : "Managers"} Production Apply（main ${sha7}、Plan run ${input.planRunId}・Backup run ${input.backupRunId}・Dry run ${input.dryRunRunId}にbinding、` +
    `source ${p.sourceChecksum.slice(0, 12)}、plan ${p.planChecksum.slice(0, 12)}、manual review: ${p.acknowledge}）を承認します。` +
    `対象は${p.targetTables[0]}への追加${p.added}件・更新${p.changed}件と、import_batchesの監査記録1行のみです。${notApproved}は承認しません。`;
  const json = {
    dataset: input.dataset,
    targetTables: tables,
    mainSha: p.commitSha,
    productionBefore: p.beforeCount,
    candidateAfter: p.afterCount,
    added: p.added,
    updated: p.changed,
    structuralChanged: p.structuralChanged,
    cardRatingOnlyChanged: p.cardRatingOnlyChanged,
    changedFields: p.changedFields,
    removed: 0,
    duplicate: 0,
    schemaDrift: 0,
    hardBlock: 0,
    manualReviewReasons: p.manualReviewCodes,
    planRunId: input.planRunId,
    backupRunId: input.backupRunId,
    backupValid: true,
    backupExpiresAt: expiry,
    dryRunRunId: input.dryRunRunId,
    rediff: 0,
    checksums: { source: p.sourceChecksum, plan: p.planChecksum },
    writes: `${p.targetTables[0]}: insert ${p.added}, update ${p.changed} (1 transaction); import_batches: 1 audit row. No DELETE, no TRUNCATE.`,
    notApproved,
    applyRunUrl: input.applyRunUrl,
    approvalComment: comment,
  };
  const cell = (v: unknown) => String(v).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
  const row = (k: string, v: unknown) => `| ${k} | ${cell(v)} |`;
  const markdown = [
    "## 本人の承認が1回必要です（Production Apply）",
    "",
    "| 項目 | 値 |",
    "|---|---|",
    row("Run URL", input.applyRunUrl ?? "（作成に失敗）"),
    row("Environment", "reference-data-production-apply"),
    row("dataset / target tables", `${input.dataset} / ${tables}`),
    row("main SHA", p.commitSha),
    row("Production before → after", `${p.beforeCount} → ${p.afterCount}`),
    row("added / updated", `${p.added} / ${p.changed}`),
    row("structural / card_rating-only", `${p.structuralChanged ?? "—"} / ${p.cardRatingOnlyChanged ?? "—"}`),
    row("changed fields", p.changedFields.join(", ") || "—"),
    row("removed / duplicate / schema drift / hard block", "0 / 0 / 0 / 0"),
    row("manual review", p.acknowledge),
    row("Backup", `run ${input.backupRunId}: BACKUP_V2_VALID (restore/storage verified), expires ${expiry}`),
    row("Dry run", `run ${input.dryRunRunId}: verified, re-diff 0, after checksum match, undo simulation ok`),
    row("checksums", `source ${p.sourceChecksum.slice(0, 12)} / plan ${p.planChecksum.slice(0, 12)}`),
    row("Apply が行う書き込み", json.writes),
    row("承認対象外", notApproved),
    "",
    "承認コメント（そのまま貼り付け）:",
    "",
    "```",
    comment,
    "```",
  ].join("\n");
  return { comment, markdown, json };
}
