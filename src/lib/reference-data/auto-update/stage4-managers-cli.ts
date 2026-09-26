import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Client, type ClientConfig } from "pg";
import { REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { runUpdaterPreflight, safeErrorCode } from "./production-apply-preflight";
import {
  APPLY_WORKFLOW_PATH,
  STAGE4_CONFIRM,
  Stage4Stop,
  buildManagersCandidate,
  buildSourceBundle,
  checkRun,
  evaluateBackupBinding,
  evaluateManagersPlan,
  fetchManagersOnce,
  newerPlanRuns,
  parseRunFacts,
  parseSourceBundle,
  readManagersProductionState,
  runManagersApply,
  runManagersIsolatedValidation,
  stage4RunTitle,
  summarizeManagersPlan,
  verifyManagersPostApply,
  type DryRunRecord,
  type PostApplyExpectation,
  type Stage4Mode,
  type WorkflowRunFacts,
} from "./stage4-managers";
import { STAGE4_MANAGERS_APPROVAL_TOKEN, createUpstreamHttpTransport } from "./upstream-http-transport";
import { PLAN_READER_ROLES, parseStateSnapshot, runPlanReadPreflight, serializeStateSnapshot } from "./stage4-state-snapshot";
import type { ManagersProductionState } from "./stage4-managers";

/**
 * Stage 4(managersだけ)のmode別処理。`production-apply-cli.ts`から呼ばれる。
 *
 * 入力はworkflowが用意したファイルと環境変数だけ:
 *   STAGE4_WORK_DIR 配下
 *     plan/stage4-managers-bundle.json      (plan runのartifact)
 *     backup/reference-data-backup-summary.json (Backup runのartifact)
 *     dry-run/stage4-managers-dry-run.json  (dry-run runのartifact)
 *     apply/stage4-managers-apply-result.json (apply runのartifact、verify用)
 *     facts-plan.json / facts-backup.json / facts-dry-run.json / facts-apply.json / plan-runs.json (GitHub APIのrun情報)
 *   STAGE4_PLAN_RUN_ID・STAGE4_BACKUP_RUN_ID・STAGE4_DRY_RUN_RUN_ID・STAGE4_APPLY_RUN_ID・STAGE4_SOURCE_CHECKSUM・
 *   STAGE4_PLAN_CHECKSUM・STAGE4_ACK_MANUAL_REVIEW・REFERENCE_DATA_APPLY_CONFIRM・GITHUB_SHA・GITHUB_RUN_ID・GITHUB_ACTOR
 * 出力は STAGE4_WORK_DIR/out/ のartifactと、呼び出し側が書く非秘密要約だけ。
 */

export interface Stage4Outcome {
  readonly ok: boolean;
  readonly reasons: readonly string[];
  readonly facts: Readonly<Record<string, unknown>>;
}

export type Env = Readonly<Record<string, string | undefined>>;

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
/** Worldのsource bundle(全page本文、約30MB)用の上限。 */
export const MAX_WORLD_INPUT_BYTES = 80 * 1024 * 1024;
const RUN_ID_RE = /^[0-9]{1,20}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const SQL_DIR = path.join(process.cwd(), "docs", "production-readiness", "sql");

export function workDir(env: Env): string {
  const d = env.STAGE4_WORK_DIR;
  if (!d || /[\r\n\0]/.test(d) || !path.isAbsolute(d)) throw new Stage4Stop("work_dir_invalid");
  return d;
}

export function readInput(dir: string, rel: string, maxBytes: number = MAX_INPUT_BYTES): string {
  const p = path.join(dir, rel);
  if (!existsSync(p)) throw new Stage4Stop(`input_missing:${rel}`);
  if (statSync(p).size > maxBytes) throw new Stage4Stop(`input_too_large:${rel}`);
  return readFileSync(p, "utf8");
}

export function writeOut(dir: string, name: string, data: unknown): void {
  writeFileSync(path.join(dir, "out", name), `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

/** 文字列をそのまま書く(sha256を記録したスナップショット用。整形し直すとhashが変わるため)。 */
export function writeOutText(dir: string, name: string, text: string): void {
  writeFileSync(path.join(dir, "out", name), text, { encoding: "utf8", mode: 0o600 });
}

export function runId(env: Env, key: string): string {
  const v = env[key] ?? "";
  if (!RUN_ID_RE.test(v)) throw new Stage4Stop(`input_invalid:${key}`);
  return v;
}

export function checksum(env: Env, key: string): string {
  const v = env[key] ?? "";
  if (!SHA256_RE.test(v)) throw new Stage4Stop(`input_invalid:${key}`);
  return v;
}

export function commitSha(env: Env): string {
  const v = env.GITHUB_SHA ?? "";
  if (!/^[0-9a-f]{40}$/.test(v)) throw new Stage4Stop("input_invalid:GITHUB_SHA");
  return v;
}

export function facts(dir: string, name: string): WorkflowRunFacts {
  return parseRunFacts(readInput(dir, name));
}

export function planRunList(dir: string): { id: number; displayTitle: string; createdAt: string; conclusion: string | null }[] {
  let d: unknown;
  try {
    d = JSON.parse(readInput(dir, "plan-runs.json"));
  } catch (err) {
    if (err instanceof Stage4Stop) throw err;
    throw new Stage4Stop("plan_runs_not_json");
  }
  if (!Array.isArray(d)) throw new Stage4Stop("plan_runs_shape");
  return d as { id: number; displayTitle: string; createdAt: string; conclusion: string | null }[];
}

export function isolatedSql() {
  const r = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
  const s = (f: string) => readFileSync(path.join(SQL_DIR, f), "utf8");
  return {
    reference: {
      base: r(REPOSITORY_REFERENCE_SQL_FILES.base),
      detailExtension: r(REPOSITORY_REFERENCE_SQL_FILES.detailExtension),
      nameSortKeyExtension: r(REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension),
      analysisNameExtension: r(REPOSITORY_REFERENCE_SQL_FILES.analysisNameExtension),
    },
    createUpdaterRole: s("create-reference-data-updater-role.sql"),
    updaterPolicies: s("create-reference-data-updater-rls-policies.sql"),
    rollbackUpdaterRole: s("rollback-reference-data-updater-role.sql"),
  };
}

export async function withClient<T>(config: ClientConfig, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client(config);
  try {
    await client.connect();
  } catch (err) {
    await client.end().catch(() => undefined);
    throw new Stage4Stop(`connect_failed:${safeErrorCode(err)}`);
  }
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Planの読み取り: 読み取り専用role・読み取り専用transactionで、書き込み権限が無いことを確認してから読む(終わったらrollback)。 */
async function readStateReadOnly(client: Client) {
  await client.query("begin read only");
  try {
    const pre = await runPlanReadPreflight(client);
    if (!pre.ok) throw new Stage4Stop("plan_read_preflight_failed:" + pre.problems.join("|"));
    return await readManagersProductionState(client, undefined, PLAN_READER_ROLES);
  } finally {
    await client.query("rollback").catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------

async function plan(env: Env, db: ClientConfig): Promise<Stage4Outcome> {
  const dir = workDir(env);
  const sha = commitSha(env);
  const fetchedAt = new Date().toISOString();
  return withClient(db, async (client) => {
    // Productionの読み取りが通らなければupstreamへ1件も送らない。
    const state = await readStateReadOnly(client);
    const transport = createUpstreamHttpTransport({
      approval: STAGE4_MANAGERS_APPROVAL_TOKEN,
      maxRequests: { "efootball-world": 0, "managers-json": 1 },
      maxTotalBytes: 5_000_000,
    });
    const response = await fetchManagersOnce(transport, fetchedAt);
    const now = new Date().toISOString();
    const b = await buildManagersCandidate(response, fetchedAt, state.managers, now);
    const e = evaluateManagersPlan(b);
    // Dry run は Production へ接続せず、このスナップショットから同じ候補を作る。JSONを経由しても同じ候補になることを確認する。
    const snap = serializeStateSnapshot("managers", fetchedAt, state);
    const replayed = await buildManagersCandidate(response, fetchedAt, parseStateSnapshot<ManagersProductionState>(snap.text, "managers", snap.sha256).managers, now);
    if (replayed.plan.planChecksum !== b.plan.planChecksum || replayed.candidate.sourceChecksum !== b.candidate.sourceChecksum) throw new Stage4Stop("state_snapshot_not_deterministic");
    writeOutText(dir, "stage4-managers-state.json", snap.text);
    writeOut(dir, "stage4-managers-bundle.json", buildSourceBundle(response, fetchedAt, b, state.counts, snap.sha256));
    return {
      ok: e.ok,
      reasons: [...e.problems],
      facts: {
        fetchedAt,
        commitSha: sha,
        upstreamRequests: transport.log.map((l) => ({ source: l.sourceId, status: l.status, outcome: l.outcome, bytes: l.bytes, durationMs: l.durationMs })),
        productionCounts: state.counts,
        plan: summarizeManagersPlan(b, e),
      },
    };
  });
}

/** Dry run: Productionへ接続しない。PlanのartifactとスナップショットとBackup要約だけを使い、使い捨てPostgreSQLで検証する。 */
async function dryRun(env: Env): Promise<Stage4Outcome> {
  const dir = workDir(env);
  const sha = commitSha(env);
  const planRunId = runId(env, "STAGE4_PLAN_RUN_ID");
  const backupRunId = runId(env, "STAGE4_BACKUP_RUN_ID");
  const boundSource = checksum(env, "STAGE4_SOURCE_CHECKSUM");
  const boundPlan = checksum(env, "STAGE4_PLAN_CHECKSUM");
  const bundle = parseSourceBundle(readInput(dir, "plan/stage4-managers-bundle.json"));
  const planFacts = facts(dir, "facts-plan.json");
  const backupFacts = facts(dir, "facts-backup.json");
  const backupSummary = readInput(dir, "backup/reference-data-backup-summary.json");
  const reasons: string[] = [];
  if (bundle.sourceChecksum !== boundSource) reasons.push("source_checksum_not_bound");
  if (bundle.planChecksum !== boundPlan) reasons.push("plan_checksum_not_bound");
  reasons.push(...checkRun(planFacts, { id: planRunId, path: APPLY_WORKFLOW_PATH, title: stage4RunTitle("plan"), commitSha: sha }, "plan"));
  if (newerPlanRuns(planFacts, planRunList(dir)) !== 0) reasons.push("candidate_not_latest");
  if (Date.parse(backupFacts.createdAt) < Date.parse(planFacts.updatedAt)) reasons.push("backup_not_after_plan");
  if (reasons.length > 0) return { ok: false, reasons, facts: {} };

  const now = new Date().toISOString();
  const state = parseStateSnapshot<ManagersProductionState>(readInput(dir, "plan/stage4-managers-state.json"), "managers", bundle.stateSha256);
  const b = await buildManagersCandidate(bundle.response, bundle.fetchedAt, state.managers, now);
  const e = evaluateManagersPlan(b);
  reasons.push(...e.problems);
  if (b.plan.planChecksum !== boundPlan) reasons.push("stale_plan");
  if (b.candidate.sourceChecksum !== boundSource) reasons.push("candidate_differs_from_plan_run");
  const backup = evaluateBackupBinding({ runId: backupRunId, facts: backupFacts, summaryText: backupSummary, productionCounts: state.counts, now });
  reasons.push(...backup.problems);
  if (reasons.length > 0) return { ok: false, reasons, facts: { plan: summarizeManagersPlan(b, e), productionCounts: state.counts } };

  // 隔離PostgreSQL(このjobのservice container)だけで検証する。
  const startedAt = new Date().toISOString();
  const pgConfig = buildTestOnlyPgConfigFromEnv(env);
  const isolated = await withClient(pgConfig, async (c) => {
    const v = await c.query("select current_setting('server_version_num')::int as v");
    const result = await runManagersIsolatedValidation(c, b, state, isolatedSql(), new Date());
    return { ...result, serverVersionNum: Number(v.rows[0]?.v) };
  });
  const completedAt = new Date().toISOString();
  const record: DryRunRecord & Record<string, unknown> = {
    schema: "stage4-managers-dry-run/v1",
    verified: isolated.verified,
    dryRunRunId: env.GITHUB_RUN_ID ?? null,
    planRunId,
    backupRunId,
    sourceChecksum: b.candidate.sourceChecksum,
    planChecksum: b.plan.planChecksum,
    beforeChecksum: b.plan.report.beforeChecksum,
    startedAt,
    completedAt,
    isolated,
  };
  writeOut(dir, "stage4-managers-dry-run.json", record);
  return {
    ok: isolated.verified,
    reasons: [...isolated.problems],
    facts: { plan: summarizeManagersPlan(b, e), productionCounts: state.counts, backupRunId, isolated, startedAt, completedAt },
  };
}

async function apply(env: Env, db: ClientConfig): Promise<Stage4Outcome> {
  const dir = workDir(env);
  const sha = commitSha(env);
  const dryRunRunId = runId(env, "STAGE4_DRY_RUN_RUN_ID");
  const recordText = readInput(dir, "dry-run/stage4-managers-dry-run.json");
  let record: DryRunRecord & { dryRunRunId?: unknown; schema?: unknown };
  try {
    record = JSON.parse(recordText);
  } catch {
    throw new Stage4Stop("dry_run_record_not_json");
  }
  if (record.schema !== "stage4-managers-dry-run/v1" || record.dryRunRunId !== dryRunRunId) return { ok: false, reasons: ["dry_run_record_not_from_this_run"], facts: {} };
  const planRunId = runId(env, "STAGE4_PLAN_RUN_ID");
  const base = {
    schema: "reference_data",
    bundle: parseSourceBundle(readInput(dir, "plan/stage4-managers-bundle.json")),
    boundSourceChecksum: checksum(env, "STAGE4_SOURCE_CHECKSUM"),
    boundPlanChecksum: checksum(env, "STAGE4_PLAN_CHECKSUM"),
    acknowledgedManualReview: env.STAGE4_ACK_MANUAL_REVIEW ?? "",
    planRunId,
    planFacts: facts(dir, "facts-plan.json"),
    newerPlanRunCount: 0,
    backupRunId: runId(env, "STAGE4_BACKUP_RUN_ID"),
    backupFacts: facts(dir, "facts-backup.json"),
    backupSummaryText: readInput(dir, "backup/reference-data-backup-summary.json"),
    dryRunRunId,
    dryRunFacts: facts(dir, "facts-dry-run.json"),
    dryRun: record,
    applyCommitSha: sha,
    approvedBy: /^[0-9A-Za-z._@-]{1,64}$/.test(env.GITHUB_ACTOR ?? "") ? (env.GITHUB_ACTOR as string) : "environment-approval",
    now: new Date().toISOString(),
  };
  const withLatest = { ...base, newerPlanRunCount: newerPlanRuns(base.planFacts, planRunList(dir)) };
  const r = await withClient(db, (client) => runManagersApply(client, withLatest));
  if (r.status === "not_applied") return { ok: false, reasons: r.problems, facts: { status: r.status, stage: r.stage, plan: r.plan ?? null, productionWrites: 0 } };
  writeOut(dir, "stage4-managers-apply-result.json", { schema: "stage4-managers-apply-result/v1", status: r.status, applyRunId: env.GITHUB_RUN_ID ?? null, expectation: r.expectation, postVerify: r.postVerify });
  writeOut(dir, "stage4-managers-undo-plan.json", { schema: "stage4-managers-undo-plan/v1", note: "not executed automatically; requires a separate owner decision", undo: r.undo });
  return {
    ok: r.status === "applied_verified",
    reasons: r.status === "applied_verified" ? [] : ["rollback_required", ...r.postVerify.problems],
    facts: {
      status: r.status,
      batchId: r.batchId,
      inserted: r.inserted,
      updated: r.updated,
      insertedIdentities: r.expectation.insertedIdentities.slice(0, 10),
      postVerify: r.postVerify,
      plan: r.plan,
      automaticUndo: false,
    },
  };
}

async function verify(env: Env, db: ClientConfig): Promise<Stage4Outcome> {
  const dir = workDir(env);
  const applyRunId = runId(env, "STAGE4_APPLY_RUN_ID");
  const applyFacts = facts(dir, "facts-apply.json");
  // apply runの結論は問わない(rollback_requiredでfailureになったrunも検証対象)。同じworkflow・main・再実行なしだけを確認する。
  const runProblems = checkRun({ ...applyFacts, status: "completed", conclusion: "success" }, { id: applyRunId, path: APPLY_WORKFLOW_PATH, title: stage4RunTitle("apply") }, "apply");
  if (runProblems.length > 0) return { ok: false, reasons: runProblems, facts: {} };
  let result: { schema?: unknown; applyRunId?: unknown; expectation?: PostApplyExpectation };
  try {
    result = JSON.parse(readInput(dir, "apply/stage4-managers-apply-result.json"));
  } catch (err) {
    if (err instanceof Stage4Stop) throw err;
    throw new Stage4Stop("apply_result_not_json");
  }
  if (result.schema !== "stage4-managers-apply-result/v1" || result.applyRunId !== applyRunId || !result.expectation) return { ok: false, reasons: ["apply_result_not_from_this_run"], facts: {} };
  const expectation = { ...result.expectation, schema: "reference_data" };
  return withClient(db, async (client) => {
    await client.query("begin read only");
    try {
      const post = await verifyManagersPostApply(client, expectation);
      const pre = await runUpdaterPreflight(client);
      const reasons = [...post.problems, ...pre.problems.map((p) => `preflight:${p}`)];
      return { ok: reasons.length === 0, reasons, facts: { postVerify: post.facts, batchId: expectation.batchId } };
    } finally {
      await client.query("rollback").catch(() => undefined);
    }
  });
}

/** mode別の処理。確認入力が一致しなければ接続前に停止する。 */
/** dry-run は Production へ接続しないため db を受け取らない(null)。それ以外は db が必須。 */
export async function runStage4Mode(mode: Stage4Mode, env: Env, db: ClientConfig | null): Promise<Stage4Outcome> {
  if (env.REFERENCE_DATA_APPLY_CONFIRM !== STAGE4_CONFIRM[mode]) return { ok: false, reasons: ["confirmation_mismatch"], facts: {} };
  try {
    if (mode === "dry-run") return await dryRun(env);
    if (!db) return { ok: false, reasons: ["db_config_missing"], facts: {} };
    if (mode === "plan") return await plan(env, db);
    if (mode === "apply") return await apply(env, db);
    return await verify(env, db);
  } catch (err) {
    return { ok: false, reasons: [err instanceof Stage4Stop ? err.code : `unexpected:${safeErrorCode(err)}`], facts: {} };
  }
}
