import { createHash } from "node:crypto";
import { validateBackupV2Summary } from "./backup-v2-summary-validator";
import { assertIsolatedSchemaName, buildIsolatedReferenceSchemaDdl, type RepositoryReferenceSql } from "./isolated-reference-schema";
import { runUpdaterPreflight } from "./production-apply-preflight";
import { buildStagingDataset, type StagingDataset } from "./source-snapshot";
import { buildManagersRequest } from "./source-managers";
import { createRecordedFixtureTransport, type SourceResponse, type SourceTransport } from "./source-transport";
import { STAGE1_LIMITS } from "./stage1-verification";
import { applyUndoPlan, applyUpdatePlans, PRODUCTION_REFERENCE_SCHEMA, type ApplyPgClient, type UndoPlan } from "./update-apply";
import { buildUpdateCandidate, type UpdateCandidate } from "./update-candidate";
import { UPDATE_TABLE_CONTRACTS, computeUpdateTableChecksum, rowIdentity } from "./update-contract";
import { computeUpdateDiff, type UpdateDiffPlan } from "./update-diff";
import { collectManagersSnapshot, runIsolatedDryRunApply } from "./update-dry-run";
import { evaluateApplyPrerequisites, type ApplyPrerequisites } from "./update-policy";
import { UPDATER_ROLE_NAME } from "./updater-role";

/**
 * Stage 4: 初回Production更新リハーサル(managersだけ)。
 *
 * 流れ(各段階は別のworkflow run。前の段階のartifactとrun IDへbindingする):
 *   plan     : managers.jsonを1回だけ取得 → Productionのmanagers・import_batchesを読み取り専用で取得 → candidate・diff・policy
 *   (Backup) : 本人が新しいpre-apply Backup(形式"2")を実行
 *   dry-run  : Backup要約を検証 → Productionを再度読み取り(stale検出) → 隔離PostgreSQLでdry run・executor・undoの模擬
 *   apply    : 全bindingを再検証 → executorで1 transaction適用 → post-apply検証
 *   verify   : post-apply検証だけを読み取り専用で再実行
 *
 * - 対象tableはmanagers(+監査用のimport_batches)だけ。World・player_card_analysisへは書かない・読まない
 *   (Worldは件数と最終更新時刻の集計だけを、変更が無いことの確認に使う)。
 * - 要約には行データを含めない(件数・checksum・finding code・上限付きのidentityだけ)。
 * - 失敗は常に停止(自動retry・自動undo・自動Restoreはしない)。
 */

export const STAGE4_TABLE = "managers" as const;
export const STAGE4_MODES = ["plan", "dry-run", "apply", "verify"] as const;
export type Stage4Mode = (typeof STAGE4_MODES)[number];
/** workflowの確認入力(modeごとに固定値)。 */
export const STAGE4_CONFIRM: Readonly<Record<Stage4Mode, string>> = Object.freeze({
  plan: "plan-managers",
  "dry-run": "dry-run-managers",
  apply: "apply-managers-to-production",
  verify: "verify-managers",
});
/** 初回リハーサルで許す変更件数の上限(想定は追加1件・変更0件)。 */
export const STAGE4_MAX_CHANGES = 10;
export const STAGE4_MAX_IDENTITIES_IN_SUMMARY = 10;
export const STAGE4_APPROVAL_TTL_MINUTES = 60;
export const BACKUP_MAX_AGE_HOURS = 24;
export const APPLY_WORKFLOW_PATH = ".github/workflows/reference-data-production-apply.yml";
export const BACKUP_WORKFLOW_PATH = ".github/workflows/reference-data-production-backup.yml";
/** workflowの`run-name`(mode別)。latest判定・binding検証に使う。 */
export const stage4RunTitle = (mode: Stage4Mode | "preflight") => `reference-data ${mode}`;
/** 同じworkflowのWorld用run(`run-name`の末尾に " world" が付く)。 */
export const stage4WorldRunTitle = (mode: Stage4Mode) => `reference-data ${mode} world`;
export const STAGE4_DRY_RUN_SCHEMA = "reference_data_stage4_dry_run";
export const STAGE4_ROLLBACK_SCHEMA = "reference_data_stage4_rollback_test";

const SHA256_RE = /^[0-9a-f]{64}$/;
const SHA1_RE = /^[0-9a-f]{40}$/;
const RUN_ID_RE = /^[0-9]{1,20}$/;
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const EMPTY_HISTORY = { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null } as const;

export interface Stage4Client {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

/** Stage 4の停止理由(安全なcodeだけ。値・URL・行データを含めない)。 */
export class Stage4Stop extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function targetSchema(schema: string): string {
  return schema === PRODUCTION_REFERENCE_SCHEMA ? schema : assertIsolatedSchemaName(schema);
}

// ---------------------------------------------------------------------------
// upstream: 1回だけ取得し、応答を記録する(以降の段階はこの記録を再生して同じ候補を作る)
// ---------------------------------------------------------------------------

export interface RecordedManagersResponse {
  readonly status: number;
  readonly contentType: string;
  readonly bodyText: string;
}

/** managers.jsonを1回だけ取得する(transport側の上限でmanagers-json 1件・World 0件に固定する)。 */
export async function fetchManagersOnce(transport: SourceTransport, fetchedAt: string): Promise<RecordedManagersResponse> {
  let recorded: SourceResponse | null = null;
  const recording: SourceTransport = {
    kind: transport.kind,
    async request(req) {
      if (recorded) throw new Stage4Stop("second_upstream_request_refused");
      const res = await transport.request(req);
      recorded = res;
      return res;
    },
  };
  const c = await collectManagersSnapshot(recording, { fetchedAt, sleep: async () => undefined });
  if (!c.ok) throw new Stage4Stop(`source_${c.failure.code}`);
  const res = recorded as SourceResponse | null;
  if (!res) throw new Stage4Stop("source_not_fetched");
  return { status: res.status, contentType: res.headers["content-type"] ?? "", bodyText: res.bodyText };
}

function replayTransport(r: RecordedManagersResponse): SourceTransport {
  return createRecordedFixtureTransport([{ request: buildManagersRequest(), responses: [{ status: r.status, headers: { "content-type": r.contentType }, bodyText: r.bodyText }] }]);
}

// ---------------------------------------------------------------------------
// Production現在状態(updater・読み取り専用transactionの中で呼ぶ)
// ---------------------------------------------------------------------------

export interface ManagersProductionState {
  readonly managers: readonly Record<string, unknown>[];
  readonly importBatches: readonly Record<string, unknown>[];
  readonly counts: { readonly world_player_cards: number; readonly managers: number; readonly import_batches: number };
  /** Worldが変わっていないことの確認用(集計値だけ)。 */
  readonly worldMaxUpdatedAt: string | null;
}

export const cols = (t: keyof typeof UPDATE_TABLE_CONTRACTS) => UPDATE_TABLE_CONTRACTS[t].productionColumns.join(", ");
export const toIso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

/**
 * managers・import_batchesの行と、3 tableの件数を読む。player_card_analysisは読まない(updaterに権限が無い)。
 * 呼び出し側が`begin read only`の中で、reference_data_updaterとして実行すること。
 */
export async function readManagersProductionState(
  client: Stage4Client,
  schema: string = PRODUCTION_REFERENCE_SCHEMA,
  /** 読み取りを許可するrole(既定はupdater。Planは読み取り専用roleを渡す)。 */
  allowedRoles: readonly string[] = [UPDATER_ROLE_NAME],
): Promise<ManagersProductionState> {
  const s = targetSchema(schema);
  const who = await client.query("select current_user::text as u, current_setting('transaction_read_only') as ro");
  if (!allowedRoles.includes(String(who.rows[0]?.u))) throw new Stage4Stop("wrong_role");
  if (who.rows[0]?.ro !== "on") throw new Stage4Stop("not_read_only");
  const managers = (await client.query(`select ${cols("managers")} from ${s}.managers`)).rows;
  const importBatches = (await client.query(`select ${cols("import_batches")} from ${s}.import_batches`)).rows;
  const agg = (
    await client.query(
      `select (select count(*) from ${s}.world_player_cards)::int as w, (select max(updated_at) from ${s}.world_player_cards) as wmax,
              (select count(*) from ${s}.managers)::int as m, (select count(*) from ${s}.import_batches)::int as b`,
    )
  ).rows[0];
  const counts = { world_player_cards: Number(agg?.w), managers: Number(agg?.m), import_batches: Number(agg?.b) };
  if (counts.managers !== managers.length || counts.import_batches !== importBatches.length) throw new Stage4Stop("inconsistent_read");
  return { managers, importBatches, counts, worldMaxUpdatedAt: toIso(agg?.wmax) };
}

// ---------------------------------------------------------------------------
// candidate・diff・policy
// ---------------------------------------------------------------------------

export interface ManagersCandidateBuild {
  readonly staging: StagingDataset;
  readonly plan: UpdateDiffPlan;
  readonly candidate: UpdateCandidate;
  readonly receivedRecordCount: number;
}

/** 記録した応答を再生して、Productionの現在行に対するcandidate・diff・policyを作る(決定的)。 */
export async function buildManagersCandidate(
  response: RecordedManagersResponse,
  fetchedAt: string,
  currentManagers: readonly Readonly<Record<string, unknown>>[],
  now: string,
): Promise<ManagersCandidateBuild> {
  const c = await collectManagersSnapshot(replayTransport(response), { fetchedAt, sleep: async () => undefined });
  if (!c.ok) throw new Stage4Stop(`source_${c.failure.code}`);
  const received = c.snapshot.completeness.receivedRecordCount;
  if (received > STAGE1_LIMITS.managersMaxRecords) throw new Stage4Stop("source_record_cap_exceeded");
  if (c.snapshot.completeness.conflictingDuplicateIdentities.length > 0) throw new Stage4Stop("duplicate_identity");
  let staging: StagingDataset;
  try {
    staging = buildStagingDataset(c.snapshot);
  } catch {
    throw new Stage4Stop("source_incomplete");
  }
  const plan = computeUpdateDiff({ table: STAGE4_TABLE, currentRows: currentManagers, staging });
  const candidate = buildUpdateCandidate({ plans: [plan], stagings: [staging], currentRows: { managers: currentManagers }, history: EMPTY_HISTORY, now });
  return { staging, plan, candidate, receivedRecordCount: received };
}

export interface ManagersPlanEvaluation {
  readonly ok: boolean;
  readonly problems: readonly string[];
  /** 本人がapply時に確認入力で明示する必要があるmanual review finding code(整列済み)。 */
  readonly manualReviewCodes: readonly string[];
}

export function evaluateManagersPlan(b: ManagersCandidateBuild): ManagersPlanEvaluation {
  const problems: string[] = [];
  const { plan, candidate } = b;
  if (plan.table !== STAGE4_TABLE || JSON.stringify(candidate.targetTables) !== JSON.stringify([STAGE4_TABLE])) problems.push("unexpected_target_tables");
  if (plan.blockingReasons.length > 0) problems.push("plan_blocked");
  if (plan.report.duplicateCount > 0) problems.push("duplicate_identity");
  if (plan.report.invalidCount > 0) problems.push("invalid_source_records");
  if (plan.removedCandidates.length > 0) problems.push("removal_requires_manual_decision");
  if (plan.resurrected.length > 0) problems.push("resurrection_not_supported");
  for (const f of candidate.policy.findings) if (f.severity === "hard_block") problems.push(`policy_hard_block:${f.code}`);
  const changes = plan.inserts.length + plan.updates.length;
  if (changes === 0) problems.push("no_changes");
  if (changes > STAGE4_MAX_CHANGES) problems.push("rehearsal_scope_exceeded");
  const manualReviewCodes = [...new Set(candidate.policy.findings.filter((f) => f.severity === "manual_review").map((f) => f.code))].sort();
  return { ok: problems.length === 0, problems, manualReviewCodes };
}

/** 要約(行データなし。identityは上限付き)。 */
export function summarizeManagersPlan(b: ManagersCandidateBuild, e: ManagersPlanEvaluation): Record<string, unknown> {
  const r = b.plan.report;
  const hist: Record<string, number> = {};
  for (const u of b.plan.updates) for (const f of u.changedFields) hist[f] = (hist[f] ?? 0) + 1;
  return {
    targetTables: [...b.candidate.targetTables],
    receivedRecordCount: b.receivedRecordCount,
    beforeCount: r.beforeCount,
    afterCount: r.afterCount,
    addedCount: r.addedCount,
    changedCount: r.changedCount,
    removedCount: r.removedCount,
    unchangedCount: r.unchangedCount,
    duplicateCount: r.duplicateCount,
    changedFieldFrequency: hist,
    addedIdentities: b.plan.inserts.slice(0, STAGE4_MAX_IDENTITIES_IN_SUMMARY).map((x) => x.identity),
    addedIdentitiesTruncated: b.plan.inserts.length > STAGE4_MAX_IDENTITIES_IN_SUMMARY,
    sourceChecksum: b.candidate.sourceChecksum,
    idempotencyKey: b.candidate.idempotencyKey,
    planChecksum: b.plan.planChecksum,
    beforeChecksum: r.beforeChecksum,
    afterChecksum: r.afterChecksum,
    policySeverity: b.candidate.policy.severity,
    findings: b.candidate.policy.findings.map((f) => ({ severity: f.severity, code: f.code })),
    manualReviewCodes: [...e.manualReviewCodes],
    preservedColumnDrift: b.candidate.preservedColumnDrift,
    planProblems: [...e.problems],
  };
}

// ---------------------------------------------------------------------------
// source bundle(plan runのartifact)
// ---------------------------------------------------------------------------

export const STAGE4_BUNDLE_SCHEMA = "stage4-managers-source-bundle/v1";

export interface ManagersSourceBundle {
  readonly schema: typeof STAGE4_BUNDLE_SCHEMA;
  readonly fetchedAt: string;
  readonly response: RecordedManagersResponse;
  readonly bodySha256: string;
  readonly sourceChecksum: string;
  readonly planChecksum: string;
  readonly beforeChecksum: string;
  readonly productionCountsAtPlan: ManagersProductionState["counts"];
  /** Planが読んだProduction状態スナップショット(別artifact)のsha256。Dry runはこれと照合してから使う。 */
  readonly stateSha256?: string;
}

export function buildSourceBundle(response: RecordedManagersResponse, fetchedAt: string, b: ManagersCandidateBuild, counts: ManagersProductionState["counts"], stateSha256?: string): ManagersSourceBundle {
  return {
    schema: STAGE4_BUNDLE_SCHEMA,
    fetchedAt,
    response,
    bodySha256: sha256(response.bodyText),
    sourceChecksum: b.candidate.sourceChecksum,
    planChecksum: b.plan.planChecksum,
    beforeChecksum: b.plan.report.beforeChecksum,
    productionCountsAtPlan: counts,
    ...(stateSha256 ? { stateSha256 } : {}),
  };
}

/** bundleの形と本文のhashを検証する(改ざん・取り違えの検出)。 */
export function parseSourceBundle(text: string): ManagersSourceBundle {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Stage4Stop("bundle_not_json");
  }
  const r = d.response as Record<string, unknown> | undefined;
  if (d.schema !== STAGE4_BUNDLE_SCHEMA || typeof d.fetchedAt !== "string" || Number.isNaN(Date.parse(d.fetchedAt)) || !r) throw new Stage4Stop("bundle_shape");
  if (typeof r.status !== "number" || typeof r.contentType !== "string" || typeof r.bodyText !== "string") throw new Stage4Stop("bundle_shape");
  for (const k of ["bodySha256", "sourceChecksum", "planChecksum", "beforeChecksum"]) if (typeof d[k] !== "string" || !SHA256_RE.test(d[k] as string)) throw new Stage4Stop("bundle_shape");
  if (d.stateSha256 !== undefined && (typeof d.stateSha256 !== "string" || !SHA256_RE.test(d.stateSha256))) throw new Stage4Stop("bundle_shape");
  if (sha256(r.bodyText) !== d.bodySha256) throw new Stage4Stop("bundle_body_hash_mismatch");
  return d as unknown as ManagersSourceBundle;
}

// ---------------------------------------------------------------------------
// workflow runのbinding(GitHub APIのrun情報。workflowのstepが取得してファイルで渡す)
// ---------------------------------------------------------------------------

export interface WorkflowRunFacts {
  readonly id: number;
  readonly path: string;
  readonly event: string;
  readonly headBranch: string;
  readonly headSha: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly runAttempt: number;
  readonly displayTitle: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function parseRunFacts(text: string): WorkflowRunFacts {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Stage4Stop("run_facts_not_json");
  }
  const ok =
    typeof d.id === "number" && typeof d.path === "string" && typeof d.event === "string" && typeof d.headBranch === "string" &&
    typeof d.headSha === "string" && typeof d.status === "string" && (d.conclusion === null || typeof d.conclusion === "string") &&
    typeof d.runAttempt === "number" && typeof d.displayTitle === "string" && typeof d.createdAt === "string" && typeof d.updatedAt === "string";
  if (!ok) throw new Stage4Stop("run_facts_shape");
  return d as unknown as WorkflowRunFacts;
}

/** 同じrepository・main・手動実行・成功・再実行なしのrunであることを確認する。 */
export function checkRun(facts: WorkflowRunFacts, expected: { id: string; path: string; title?: string; commitSha?: string }, label: string): string[] {
  const p: string[] = [];
  if (!RUN_ID_RE.test(expected.id) || String(facts.id) !== expected.id) p.push(`${label}_run_id_mismatch`);
  if (facts.path !== expected.path) p.push(`${label}_wrong_workflow`);
  if (expected.title !== undefined && facts.displayTitle !== expected.title) p.push(`${label}_wrong_mode`);
  if (facts.event !== "workflow_dispatch") p.push(`${label}_not_workflow_dispatch`);
  if (facts.headBranch !== "main") p.push(`${label}_not_main`);
  if (facts.status !== "completed" || facts.conclusion !== "success") p.push(`${label}_not_successful`);
  if (facts.runAttempt !== 1) p.push(`${label}_is_rerun`);
  if (expected.commitSha !== undefined && (!SHA1_RE.test(expected.commitSha) || facts.headSha !== expected.commitSha)) p.push(`${label}_commit_sha_mismatch`);
  return p;
}

/** planより後に成功したplan runがあれば、古いplanは使わない(新しいcandidateが存在する)。 */
export function newerPlanRuns(plan: WorkflowRunFacts, listed: readonly { id: number; displayTitle: string; createdAt: string; conclusion: string | null }[], title: string = stage4RunTitle("plan")): number {
  return listed.filter((r) => r.id !== plan.id && r.displayTitle === title && r.conclusion === "success" && Date.parse(r.createdAt) > Date.parse(plan.createdAt)).length;
}

export interface BackupBindingResult {
  readonly problems: readonly string[];
  readonly backup: ApplyPrerequisites["backup"];
}

/**
 * apply用のBackupとして使えるかを判定する: 形式"2"・pre-apply・成功・restore/storage検証済み・内容policy・4列coverage
 * (以上はvalidateBackupV2Summary)、手動実行のmain・再実行なし、24時間以内、Productionの現在件数と一致。
 */
export function evaluateBackupBinding(input: {
  readonly runId: string;
  readonly facts: WorkflowRunFacts;
  readonly summaryText: string;
  readonly productionCounts: ManagersProductionState["counts"];
  readonly now: string;
}): BackupBindingResult {
  const problems = checkRun(input.facts, { id: input.runId, path: BACKUP_WORKFLOW_PATH }, "backup");
  const v = validateBackupV2Summary(input.summaryText, { expectedCategory: "pre-apply", baselineRowCounts: null });
  for (const p of v.problems) problems.push(`backup_summary:${p}`);
  let rowCounts: Record<string, unknown> | null = null;
  let jobId: unknown = null;
  try {
    const s = (JSON.parse(input.summaryText) as { summary?: Record<string, unknown> }).summary ?? {};
    rowCounts = (s.rowCounts as Record<string, unknown>) ?? null;
    jobId = s.jobId;
  } catch {
    /* validateBackupV2Summaryが既にnot_jsonを報告している */
  }
  if (jobId !== `gha-${input.runId}-1`) problems.push("backup_summary_not_from_this_run");
  const completedAt = Date.parse(input.facts.updatedAt);
  const now = Date.parse(input.now);
  if (Number.isNaN(completedAt) || Number.isNaN(now) || completedAt > now) problems.push("backup_time_invalid");
  else if (now - completedAt > BACKUP_MAX_AGE_HOURS * 3_600_000) problems.push("backup_expired");
  for (const t of ["world_player_cards", "managers", "import_batches"] as const) {
    if (!rowCounts || rowCounts[t] !== input.productionCounts[t]) problems.push(`backup_counts_differ_from_production:${t}`);
  }
  return {
    problems,
    backup: {
      runId: input.runId,
      category: typeof v.facts.category === "string" ? v.facts.category : null,
      conclusion: input.facts.conclusion,
      restoreVerified: v.facts.restoreVerified === true,
      storageVerified: v.facts.storageVerified === true,
      rowCounts,
      completedAt: input.facts.updatedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// 隔離PostgreSQLでのdry run・executor・undo・post-apply検証の模擬(使い捨てDBだけ)
// ---------------------------------------------------------------------------

export interface Stage4IsolatedSql {
  readonly reference: RepositoryReferenceSql;
  readonly createUpdaterRole: string;
  readonly updaterPolicies: string;
  readonly rollbackUpdaterRole: string;
}

export const toSchema = (sql: string, schema: string) => sql.replace(/\breference_data\b(?!_)/g, schema);

export async function seedRows(client: Stage4Client, schema: string, table: "managers" | "import_batches" | "world_player_cards", rows: readonly Readonly<Record<string, unknown>>[], skip: readonly string[]): Promise<void> {
  const contract = UPDATE_TABLE_CONTRACTS[table];
  const c = contract.productionColumns.filter((x) => !skip.includes(x));
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    const values: unknown[] = [];
    const tuples = part.map((row, j) => `(${c.map((col, k) => {
      const v = row[col] ?? null;
      values.push(v != null && contract.jsonbColumns.includes(col) ? JSON.stringify(v) : v instanceof Date ? v.toISOString() : v);
      return `$${j * c.length + k + 1}`;
    }).join(",")})`);
    await client.query(`insert into ${schema}.${table} (${c.join(",")}) values ${tuples.join(",")}`, values);
  }
}

export async function createSchema(client: Stage4Client, schema: string, sql: Stage4IsolatedSql, forceRls: boolean): Promise<void> {
  await client.query(`drop schema if exists ${schema} cascade`);
  await client.query(buildIsolatedReferenceSchemaDdl(schema, sql.reference));
  if (forceRls) {
    for (const t of ["world_player_cards", "managers", "import_batches"]) {
      await client.query(`alter table ${schema}.${t} enable row level security`);
      await client.query(`alter table ${schema}.${t} force row level security`);
    }
  }
}

/** 使い捨てDB専用の模擬前提条件(Productionの承認・Backupを意味しない)。 */
export function simulationPrerequisites(sourceChecksum: string, now: Date): ApplyPrerequisites {
  const at = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  return {
    sourceFetched: true, sourceChecksum, sourceChecksumAlreadyApplied: false, schemaValidated: true, diffGenerated: true, hardBlockCount: 0, manualReviewResolved: true,
    backup: { runId: "0", category: "pre-apply", conclusion: "success", restoreVerified: true, storageVerified: true, rowCounts: { world_player_cards: 1, managers: 1, player_card_analysis: 1, import_batches: 1 }, completedAt: at(40) },
    dryRun: { verified: true, startedAt: at(30), completedAt: at(20), shadowComparisonPassed: true },
    approval: { present: true, approvedAt: at(10), expiresAt: at(-60), boundSourceChecksum: sourceChecksum, boundCommitSha: "0".repeat(40) },
    applyCommitSha: "0".repeat(40), candidateIsLatest: true, superseded: false, concurrencyLockAcquired: true, duplicateBatchExists: false,
    rollbackPlanPrepared: true, updaterRoleVerified: true, productionPreflightPassed: true, now: now.toISOString(),
  };
}

export interface Stage4IsolatedResult {
  readonly verified: boolean;
  readonly problems: readonly string[];
  readonly dryRun: { readonly verified: boolean; readonly managersBefore: number; readonly managersAfter: number; readonly observedAfterChecksumMatches: boolean; readonly rediffChanges: number };
  readonly executor: { readonly applyOk: boolean; readonly applyCode: string | null; readonly auditBatchVerified: boolean; readonly postVerifyOk: boolean; readonly postVerifyProblems: readonly string[] };
  readonly undo: { readonly ok: boolean; readonly restored: number; readonly insertedRemaining: number; readonly existingRowsMatchBefore: boolean };
}

/**
 * 隔離PostgreSQL(呼び出し側が使い捨てDBへ接続したadmin client)で、
 * (1) Productionと同じ現在行(managers + import_batches)を入れたschemaへ計画を適用して再diff 0を確認、
 * (2) RLS FORCE + updater role(リポジトリのSQL)で実executorを動かし、監査batch・post-apply検証・undoを確認する。
 * 終了時にschemaとroleを削除する。
 */
export async function runManagersIsolatedValidation(
  client: Stage4Client,
  b: ManagersCandidateBuild,
  state: ManagersProductionState,
  sql: Stage4IsolatedSql,
  now: Date,
): Promise<Stage4IsolatedResult> {
  const problems: string[] = [];
  const beforeCount = state.managers.length;
  const expectedAfter = beforeCount + b.plan.inserts.length;

  // (1) dry run(admin、RLSなし)
  await createSchema(client, STAGE4_DRY_RUN_SCHEMA, sql, false);
  let dryRun: Stage4IsolatedResult["dryRun"];
  try {
    await seedRows(client, STAGE4_DRY_RUN_SCHEMA, "import_batches", state.importBatches, []);
    const dry = await runIsolatedDryRunApply(client, STAGE4_DRY_RUN_SCHEMA, [b.plan], [b.staging], { managers: state.managers });
    const n = Number((await client.query(`select count(*)::int as n from ${STAGE4_DRY_RUN_SCHEMA}.managers`)).rows[0]?.n);
    const t = dry.tables[0];
    dryRun = { verified: dry.verified && n === expectedAfter, managersBefore: beforeCount, managersAfter: n, observedAfterChecksumMatches: !!t && t.observedAfterChecksum === t.expectedAfterChecksum, rediffChanges: t?.rediffChanges ?? -1 };
    if (!dryRun.verified) problems.push("dry_run_not_verified");
  } finally {
    await client.query(`drop schema if exists ${STAGE4_DRY_RUN_SCHEMA} cascade`);
  }

  // (2) 実executor + updater role(RLS FORCE)
  const exists = await client.query("select to_regrole($1) is not null as e", [UPDATER_ROLE_NAME]);
  if (exists.rows[0]?.e === true) throw new Stage4Stop("isolated_db_updater_role_exists");
  await createSchema(client, STAGE4_ROLLBACK_SCHEMA, sql, true);
  let roleCreated = false;
  let executor: Stage4IsolatedResult["executor"] = { applyOk: false, applyCode: null, auditBatchVerified: false, postVerifyOk: false, postVerifyProblems: [] };
  let undo: Stage4IsolatedResult["undo"] = { ok: false, restored: 0, insertedRemaining: 0, existingRowsMatchBefore: false };
  try {
    await seedRows(client, STAGE4_ROLLBACK_SCHEMA, "import_batches", state.importBatches, []);
    await seedRows(client, STAGE4_ROLLBACK_SCHEMA, "managers", state.managers, ["created_at", "updated_at"]);
    await client.query(toSchema(sql.createUpdaterRole, STAGE4_ROLLBACK_SCHEMA));
    roleCreated = true;
    await client.query(toSchema(sql.updaterPolicies, STAGE4_ROLLBACK_SCHEMA));
    // post-apply検証の基準は、この隔離schemaの適用前の状態(Worldは空)。
    const simAgg = (
      await client.query(
        `select (select count(*) from ${STAGE4_ROLLBACK_SCHEMA}.world_player_cards)::int as w, (select max(updated_at) from ${STAGE4_ROLLBACK_SCHEMA}.world_player_cards) as wmax,
                (select count(*) from ${STAGE4_ROLLBACK_SCHEMA}.managers)::int as m, (select count(*) from ${STAGE4_ROLLBACK_SCHEMA}.import_batches)::int as b`,
      )
    ).rows[0];
    const simBefore = { counts: { world_player_cards: Number(simAgg?.w), managers: Number(simAgg?.m), import_batches: Number(simAgg?.b) }, worldMaxUpdatedAt: toIso(simAgg?.wmax) };
    await client.query(`set role ${UPDATER_ROLE_NAME}`);
    try {
      const applied = await applyUpdatePlans(client as ApplyPgClient, {
        schema: STAGE4_ROLLBACK_SCHEMA,
        plans: [b.plan],
        candidate: b.candidate,
        prerequisites: simulationPrerequisites(b.candidate.sourceChecksum, now),
        datasetVersion: "stage4-simulation",
        approvedBy: "simulation",
        sourceRowCounts: { managers: b.staging.rowCount },
      });
      if (applied.ok) {
        const batch = applied.tables[0];
        await client.query("begin read only");
        let post;
        try {
          post = await verifyManagersPostApply(client, {
            schema: STAGE4_ROLLBACK_SCHEMA,
            batchId: batch.batchId,
            planChecksum: b.plan.planChecksum,
            afterChecksum: b.plan.report.afterChecksum,
            insertedIdentities: b.plan.inserts.map((r) => r.identity),
            before: simBefore,
          });
        } finally {
          await client.query("rollback");
        }
        executor = { applyOk: true, applyCode: null, auditBatchVerified: !post.problems.includes("audit_batch_not_verified"), postVerifyOk: post.ok, postVerifyProblems: post.problems };
        const u = applied.undo[0];
        const r = await applyUndoPlan(client as ApplyPgClient, STAGE4_ROLLBACK_SCHEMA, u);
        const rows = (await client.query(`select ${cols("managers")} from ${STAGE4_ROLLBACK_SCHEMA}.managers`)).rows;
        const inserted = new Set(u.insertedIdentities);
        const kept = rows.filter((row) => !inserted.has(rowIdentity("managers", row)));
        undo = { ok: r.ok, restored: r.ok ? r.restored : 0, insertedRemaining: rows.length - kept.length, existingRowsMatchBefore: computeUpdateTableChecksum("managers", kept) === u.beforeChecksum };
      } else {
        executor = { ...executor, applyCode: applied.code };
      }
    } finally {
      await client.query("reset role");
    }
  } finally {
    if (roleCreated) await client.query(toSchema(sql.rollbackUpdaterRole, STAGE4_ROLLBACK_SCHEMA)).catch(() => undefined);
    await client.query(`drop schema if exists ${STAGE4_ROLLBACK_SCHEMA} cascade`);
  }
  if (!executor.applyOk) problems.push(`executor_simulation_failed:${executor.applyCode ?? "unknown"}`);
  if (executor.applyOk && !executor.postVerifyOk) problems.push("post_verify_simulation_failed");
  if (executor.applyOk && (!undo.ok || !undo.existingRowsMatchBefore || undo.insertedRemaining !== b.plan.inserts.length)) problems.push("undo_simulation_failed");
  return { verified: problems.length === 0, problems, dryRun, executor, undo };
}

// ---------------------------------------------------------------------------
// post-apply検証(読み取り専用transactionの中で呼ぶ)
// ---------------------------------------------------------------------------

export interface PostApplyExpectation {
  readonly schema: string;
  readonly batchId: string;
  readonly planChecksum: string;
  readonly afterChecksum: string;
  readonly insertedIdentities: readonly string[];
  readonly before: Pick<ManagersProductionState, "counts" | "worldMaxUpdatedAt">;
}

export async function verifyManagersPostApply(client: Stage4Client, e: PostApplyExpectation): Promise<{ ok: boolean; problems: string[]; facts: Record<string, unknown> }> {
  const s = targetSchema(e.schema);
  const problems: string[] = [];
  const managers = (await client.query(`select ${cols("managers")} from ${s}.managers`)).rows;
  if (computeUpdateTableChecksum("managers", managers) !== e.afterChecksum) problems.push("managers_checksum_mismatch");
  if (managers.length !== e.before.counts.managers + e.insertedIdentities.length) problems.push("managers_count_unexpected");
  const ids = new Set(managers.map((r) => rowIdentity("managers", r)));
  if (e.insertedIdentities.some((i) => !ids.has(i))) problems.push("inserted_identity_missing");
  const batch = (await client.query(`select status, payload_hash, target_table from ${s}.import_batches where batch_id = $1`, [e.batchId])).rows;
  if (batch.length !== 1 || batch[0].status !== "verified" || batch[0].payload_hash !== e.planChecksum || batch[0].target_table !== STAGE4_TABLE) problems.push("audit_batch_not_verified");
  const agg = (
    await client.query(
      `select (select count(*) from ${s}.import_batches)::int as b, (select count(*) from ${s}.world_player_cards)::int as w, (select max(updated_at) from ${s}.world_player_cards) as wmax`,
    )
  ).rows[0];
  if (Number(agg?.b) !== e.before.counts.import_batches + 1) problems.push("import_batches_count_unexpected");
  if (Number(agg?.w) !== e.before.counts.world_player_cards || toIso(agg?.wmax) !== e.before.worldMaxUpdatedAt) problems.push("world_changed");
  return {
    ok: problems.length === 0,
    problems,
    facts: { managersCount: managers.length, importBatchesCount: Number(agg?.b), worldCount: Number(agg?.w), auditBatchStatus: batch[0]?.status ?? null },
  };
}

// ---------------------------------------------------------------------------
// apply(Production 1回。全bindingを再検証してからexecutorを呼ぶ)
// ---------------------------------------------------------------------------

export interface DryRunRecord {
  readonly verified: boolean;
  readonly planRunId: string;
  readonly backupRunId: string;
  readonly sourceChecksum: string;
  readonly planChecksum: string;
  readonly beforeChecksum: string;
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface ApplyBindingInput {
  readonly schema: string;
  readonly bundle: ManagersSourceBundle;
  readonly boundSourceChecksum: string;
  readonly boundPlanChecksum: string;
  readonly acknowledgedManualReview: string;
  readonly planRunId: string;
  readonly planFacts: WorkflowRunFacts;
  readonly newerPlanRunCount: number;
  readonly backupRunId: string;
  readonly backupFacts: WorkflowRunFacts;
  readonly backupSummaryText: string;
  readonly dryRunRunId: string;
  readonly dryRunFacts: WorkflowRunFacts;
  readonly dryRun: DryRunRecord;
  readonly applyCommitSha: string;
  readonly approvedBy: string;
  readonly now: string;
}

export type ApplyFlowResult =
  | { readonly status: "not_applied"; readonly stage: string; readonly problems: readonly string[]; readonly plan?: Record<string, unknown> }
  | { readonly status: "applied_verified" | "rollback_required"; readonly batchId: string; readonly inserted: number; readonly updated: number; readonly postVerify: { ok: boolean; problems: string[]; facts: Record<string, unknown> }; readonly expectation: PostApplyExpectation; readonly undo: UndoPlan; readonly plan: Record<string, unknown> };

/** managersの監査batchに、このcandidate・計画の記録が既にあるか(二重適用の防止)。 */
export function priorApplications(importBatches: readonly Readonly<Record<string, unknown>>[], planChecksum: string, idempotencyKey: string): { duplicateBatch: boolean; sourceAlreadyApplied: boolean } {
  const note = `auto-update ${idempotencyKey.slice(0, 12)}`;
  return {
    duplicateBatch: importBatches.some((r) => r.payload_hash === planChecksum),
    sourceAlreadyApplied: importBatches.some((r) => r.notes === note && r.status === "verified"),
  };
}

/**
 * 1. 読み取り専用: updater preflight + 現在状態の取得
 * 2. candidateを再生成し、bound checksum(source・plan)・dry run記録・Backup・plan/dry-run/backup run・commitを照合
 * 3. ApplyPrerequisitesを組み立てて評価(1つでも満たさなければ書き込み0)
 * 4. executor(1 transaction、stale・lock・after checksumで失敗すればrollback)
 * 5. 読み取り専用: post-apply検証(失敗はrollback_required。自動undoはしない)
 */
export async function runManagersApply(client: Stage4Client, input: ApplyBindingInput): Promise<ApplyFlowResult> {
  const schema = targetSchema(input.schema);
  const stop = (stage: string, problems: readonly string[], plan?: Record<string, unknown>): ApplyFlowResult => ({ status: "not_applied", stage, problems, plan });

  // 1
  await client.query("begin read only");
  let preflightOk = false;
  let state: ManagersProductionState;
  try {
    const pre = await runUpdaterPreflight(client, schema);
    if (!pre.ok) return stop("preflight", pre.problems);
    preflightOk = true;
    state = await readManagersProductionState(client, schema);
  } catch (err) {
    return stop("read", [err instanceof Stage4Stop ? err.code : "read_failed"]);
  } finally {
    await client.query("rollback").catch(() => undefined);
  }

  // 2
  const problems: string[] = [];
  let b: ManagersCandidateBuild;
  try {
    b = await buildManagersCandidate(input.bundle.response, input.bundle.fetchedAt, state.managers, input.now);
  } catch (err) {
    return stop("candidate", [err instanceof Stage4Stop ? err.code : "candidate_failed"]);
  }
  const e = evaluateManagersPlan(b);
  const planSummary = summarizeManagersPlan(b, e);
  problems.push(...e.problems);
  if (b.candidate.sourceChecksum !== input.bundle.sourceChecksum) problems.push("candidate_differs_from_plan_run");
  if (!SHA256_RE.test(input.boundSourceChecksum) || b.candidate.sourceChecksum !== input.boundSourceChecksum) problems.push("source_checksum_not_bound");
  if (!SHA256_RE.test(input.boundPlanChecksum) || b.plan.planChecksum !== input.boundPlanChecksum) problems.push("stale_plan");
  if (input.bundle.planChecksum !== input.boundPlanChecksum) problems.push("plan_run_checksum_mismatch");
  const ack = e.manualReviewCodes.length === 0 ? "none" : e.manualReviewCodes.join(",");
  if (input.acknowledgedManualReview !== ack) problems.push("manual_review_not_acknowledged");

  problems.push(...checkRun(input.planFacts, { id: input.planRunId, path: APPLY_WORKFLOW_PATH, title: stage4RunTitle("plan"), commitSha: input.applyCommitSha }, "plan"));
  if (input.newerPlanRunCount !== 0) problems.push("candidate_not_latest");
  problems.push(...checkRun(input.dryRunFacts, { id: input.dryRunRunId, path: APPLY_WORKFLOW_PATH, title: stage4RunTitle("dry-run"), commitSha: input.applyCommitSha }, "dry_run"));
  const d = input.dryRun;
  if (!d.verified) problems.push("dry_run_not_verified");
  if (d.planRunId !== input.planRunId || d.backupRunId !== input.backupRunId) problems.push("dry_run_not_bound_to_runs");
  if (d.sourceChecksum !== input.boundSourceChecksum || d.planChecksum !== input.boundPlanChecksum || d.beforeChecksum !== b.plan.report.beforeChecksum) problems.push("dry_run_not_bound_to_plan");

  const backup = evaluateBackupBinding({ runId: input.backupRunId, facts: input.backupFacts, summaryText: input.backupSummaryText, productionCounts: state.counts, now: input.now });
  problems.push(...backup.problems);
  if (Date.parse(input.backupFacts.createdAt) < Date.parse(input.planFacts.updatedAt)) problems.push("backup_not_after_plan");

  const prior = priorApplications(state.importBatches, b.plan.planChecksum, b.candidate.idempotencyKey);
  const approvedAt = input.now;
  const prerequisites: ApplyPrerequisites = {
    sourceFetched: true,
    sourceChecksum: b.candidate.sourceChecksum,
    sourceChecksumAlreadyApplied: prior.sourceAlreadyApplied,
    schemaValidated: true,
    diffGenerated: true,
    hardBlockCount: b.candidate.policy.findings.filter((f) => f.severity === "hard_block").length,
    manualReviewResolved: !problems.includes("manual_review_not_acknowledged"),
    backup: backup.backup,
    dryRun: { verified: d.verified, startedAt: d.startedAt, completedAt: d.completedAt, shadowComparisonPassed: d.verified },
    approval: {
      present: true,
      approvedAt,
      expiresAt: new Date(Date.parse(approvedAt) + STAGE4_APPROVAL_TTL_MINUTES * 60_000).toISOString(),
      boundSourceChecksum: input.boundSourceChecksum,
      boundCommitSha: input.planFacts.headSha,
    },
    applyCommitSha: input.applyCommitSha,
    candidateIsLatest: input.newerPlanRunCount === 0,
    superseded: input.newerPlanRunCount !== 0,
    concurrencyLockAcquired: true,
    duplicateBatchExists: prior.duplicateBatch,
    rollbackPlanPrepared: d.verified,
    updaterRoleVerified: preflightOk,
    productionPreflightPassed: preflightOk,
    now: input.now,
  };
  const gate = evaluateApplyPrerequisites(prerequisites);
  problems.push(...gate.failures);
  if (problems.length > 0) return stop("binding", [...new Set(problems)], planSummary);

  // 4
  const applied = await applyUpdatePlans(client as ApplyPgClient, {
    schema,
    plans: [b.plan],
    candidate: b.candidate,
    prerequisites,
    datasetVersion: `stage4-managers-${input.now.slice(0, 10)}`,
    approvedBy: input.approvedBy,
    sourceRowCounts: { managers: b.staging.rowCount },
  });
  if (!applied.ok) return stop("apply", [applied.code, ...applied.failures.map(String).filter((f) => /^[a-z_:]+$/.test(f))], planSummary);

  // 5
  const t = applied.tables[0];
  const expectation: PostApplyExpectation = {
    schema,
    batchId: t.batchId,
    planChecksum: b.plan.planChecksum,
    afterChecksum: b.plan.report.afterChecksum,
    insertedIdentities: b.plan.inserts.map((r) => r.identity),
    before: { counts: state.counts, worldMaxUpdatedAt: state.worldMaxUpdatedAt },
  };
  await client.query("begin read only");
  let post: { ok: boolean; problems: string[]; facts: Record<string, unknown> };
  try {
    post = await verifyManagersPostApply(client, expectation);
    const pre = await runUpdaterPreflight(client, schema);
    if (!pre.ok) post = { ...post, ok: false, problems: [...post.problems, ...pre.problems.map((p) => `preflight_after_apply:${p}`)] };
  } catch {
    post = { ok: false, problems: ["post_verify_query_failed"], facts: {} };
  } finally {
    await client.query("rollback").catch(() => undefined);
  }
  return { status: post.ok ? "applied_verified" : "rollback_required", batchId: t.batchId, inserted: t.inserted, updated: t.updated, postVerify: post, expectation, undo: applied.undo[0], plan: planSummary };
}
