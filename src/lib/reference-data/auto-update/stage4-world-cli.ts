import type { ClientConfig } from "pg";
import type { Client } from "pg";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { runUpdaterPreflight, safeErrorCode } from "./production-apply-preflight";
import {
  APPLY_WORKFLOW_PATH,
  Stage4Stop,
  checkRun,
  evaluateBackupBinding,
  newerPlanRuns,
  stage4WorldRunTitle,
  type DryRunRecord,
  type Stage4Mode,
} from "./stage4-managers";
import {
  MAX_WORLD_INPUT_BYTES,
  checksum,
  commitSha,
  facts,
  isolatedSql,
  planRunList,
  readInput,
  runId,
  withClient,
  workDir,
  writeOut,
  writeOutText,
  type Env,
  type Stage4Outcome,
} from "./stage4-managers-cli";
import {
  WORLD_CONFIRM,
  WORLD_LIMITS,
  buildWorldBundle,
  buildWorldCandidate,
  evaluateWorldPlan,
  fetchWorldFullOnce,
  parseWorldBundle,
  readWorldProductionState,
  runWorldApply,
  runWorldIsolatedValidation,
  summarizeWorldPlan,
  verifyWorldPostApply,
  type WorldPostApplyExpectation,
} from "./stage4-world";
import { STAGE4_WORLD_APPROVAL_TOKEN, createUpstreamHttpTransport } from "./upstream-http-transport";
import { PLAN_READER_ROLES, parseStateSnapshot, runPlanReadPreflight, serializeStateSnapshot } from "./stage4-state-snapshot";
import type { WorldProductionState } from "./stage4-world";

/**
 * World専用のProduction更新リハーサルのmode別処理(`production-apply-cli.ts`から、dataset=worldのときに呼ばれる)。
 * 入力ファイル名はmanagersと同じ構成で、artifactの名前だけが world になる:
 *   plan/stage4-world-bundle.json・backup/reference-data-backup-summary.json・dry-run/stage4-world-dry-run.json・
 *   apply/stage4-world-apply-result.json・facts-*.json・plan-runs.json
 */

const BUNDLE = "plan/stage4-world-bundle.json";
const STATE = "plan/stage4-world-state.json";
const DRY_RUN_RECORD = "dry-run/stage4-world-dry-run.json";
const APPLY_RESULT = "apply/stage4-world-apply-result.json";
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Planの読み取り: 読み取り専用role・読み取り専用transactionで、書き込み権限が無いことを確認してから読む。 */
async function readStateReadOnly(client: Client) {
  await client.query("begin read only");
  try {
    const pre = await runPlanReadPreflight(client);
    if (!pre.ok) throw new Stage4Stop("plan_read_preflight_failed:" + pre.problems.join("|"));
    return await readWorldProductionState(client, undefined, PLAN_READER_ROLES);
  } finally {
    await client.query("rollback").catch(() => undefined);
  }
}

async function plan(env: Env, db: ClientConfig): Promise<Stage4Outcome> {
  const dir = workDir(env);
  const sha = commitSha(env);
  const fetchedAt = new Date().toISOString();
  return withClient(db, async (client) => {
    // Productionの読み取りが通らなければupstreamへ1件も送らない。
    const state = await readStateReadOnly(client);
    const transport = createUpstreamHttpTransport({
      approval: STAGE4_WORLD_APPROVAL_TOKEN,
      maxRequests: { "efootball-world": WORLD_LIMITS.maxRequests, "managers-json": 0 },
      maxTotalBytes: WORLD_LIMITS.maxTotalBytes,
    });
    const startedMs = Date.now();
    const pages = await fetchWorldFullOnce(transport, fetchedAt, realSleep);
    const fetchSeconds = Math.round((Date.now() - startedMs) / 1000);
    const now = new Date().toISOString();
    const b = await buildWorldCandidate(pages, fetchedAt, state, now);
    const e = evaluateWorldPlan(b);
    // Dry run は Production へ接続せず、このスナップショットから同じ候補を作る。JSONを経由しても同じ候補になることを確認する。
    const snap = serializeStateSnapshot("world", fetchedAt, state);
    const replayed = await buildWorldCandidate(pages, fetchedAt, parseStateSnapshot<WorldProductionState>(snap.text, "world", snap.sha256), now);
    if (replayed.plan.planChecksum !== b.plan.planChecksum || replayed.candidate.sourceChecksum !== b.candidate.sourceChecksum) throw new Stage4Stop("state_snapshot_not_deterministic");
    writeOutText(dir, "stage4-world-state.json", snap.text);
    writeOut(dir, "stage4-world-bundle.json", buildWorldBundle(pages, fetchedAt, b, state.counts, snap.sha256));
    const log = transport.log;
    return {
      ok: e.ok,
      reasons: [...e.problems],
      facts: {
        dataset: "world",
        fetchedAt,
        fetchSeconds,
        commitSha: sha,
        upstream: {
          requests: log.length,
          worldRequests: log.filter((l) => l.sourceId === "efootball-world").length,
          managersRequests: log.filter((l) => l.sourceId === "managers-json").length,
          outcomes: Object.fromEntries([...new Set(log.map((l) => `${l.status ?? l.outcome}`))].map((k) => [k, log.filter((l) => `${l.status ?? l.outcome}` === k).length])),
          totalBytes: log.reduce((a, l) => a + l.bytes, 0),
          maxDurationMs: Math.max(0, ...log.map((l) => l.durationMs)),
        },
        productionCounts: state.counts,
        plan: summarizeWorldPlan(b, e),
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
  const bundle = parseWorldBundle(readInput(dir, BUNDLE, MAX_WORLD_INPUT_BYTES));
  const planFacts = facts(dir, "facts-plan.json");
  const backupFacts = facts(dir, "facts-backup.json");
  const backupSummary = readInput(dir, "backup/reference-data-backup-summary.json");
  const reasons: string[] = [];
  if (bundle.sourceChecksum !== boundSource) reasons.push("source_checksum_not_bound");
  if (bundle.planChecksum !== boundPlan) reasons.push("plan_checksum_not_bound");
  reasons.push(...checkRun(planFacts, { id: planRunId, path: APPLY_WORKFLOW_PATH, title: stage4WorldRunTitle("plan"), commitSha: sha }, "plan"));
  if (newerPlanRuns(planFacts, planRunList(dir), stage4WorldRunTitle("plan")) !== 0) reasons.push("candidate_not_latest");
  if (Date.parse(backupFacts.createdAt) < Date.parse(planFacts.updatedAt)) reasons.push("backup_not_after_plan");
  if (reasons.length > 0) return { ok: false, reasons, facts: {} };

  const now = new Date().toISOString();
  const state = parseStateSnapshot<WorldProductionState>(readInput(dir, STATE, MAX_WORLD_INPUT_BYTES), "world", bundle.stateSha256);
  const b = await buildWorldCandidate(bundle.pages, bundle.fetchedAt, state, now);
  const e = evaluateWorldPlan(b);
  reasons.push(...e.problems);
  if (b.plan.planChecksum !== boundPlan) reasons.push("stale_plan");
  if (b.candidate.sourceChecksum !== boundSource) reasons.push("candidate_differs_from_plan_run");
  const backup = evaluateBackupBinding({ runId: backupRunId, facts: backupFacts, summaryText: backupSummary, productionCounts: state.counts, now });
  reasons.push(...backup.problems);
  if (reasons.length > 0) return { ok: false, reasons, facts: { plan: summarizeWorldPlan(b, e), productionCounts: state.counts } };

  const startedAt = new Date().toISOString();
  const isolated = await withClient(buildTestOnlyPgConfigFromEnv(env), async (c) => {
    const v = await c.query("select current_setting('server_version_num')::int as v");
    const result = await runWorldIsolatedValidation(c, b, state, isolatedSql(), new Date());
    return { ...result, serverVersionNum: Number(v.rows[0]?.v) };
  });
  const completedAt = new Date().toISOString();
  const record: DryRunRecord & Record<string, unknown> = {
    schema: "stage4-world-dry-run/v1",
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
  writeOut(dir, "stage4-world-dry-run.json", record);
  return { ok: isolated.verified, reasons: [...isolated.problems], facts: { dataset: "world", plan: summarizeWorldPlan(b, e), productionCounts: state.counts, backupRunId, isolated, startedAt, completedAt } };
}

async function apply(env: Env, db: ClientConfig): Promise<Stage4Outcome> {
  const dir = workDir(env);
  const sha = commitSha(env);
  const dryRunRunId = runId(env, "STAGE4_DRY_RUN_RUN_ID");
  let record: DryRunRecord & { dryRunRunId?: unknown; schema?: unknown };
  try {
    record = JSON.parse(readInput(dir, DRY_RUN_RECORD));
  } catch (err) {
    if (err instanceof Stage4Stop) throw err;
    throw new Stage4Stop("dry_run_record_not_json");
  }
  if (record.schema !== "stage4-world-dry-run/v1" || record.dryRunRunId !== dryRunRunId) return { ok: false, reasons: ["dry_run_record_not_from_this_run"], facts: {} };
  const planFacts = facts(dir, "facts-plan.json");
  const input = {
    schema: "reference_data",
    bundle: parseWorldBundle(readInput(dir, BUNDLE, MAX_WORLD_INPUT_BYTES)),
    boundSourceChecksum: checksum(env, "STAGE4_SOURCE_CHECKSUM"),
    boundPlanChecksum: checksum(env, "STAGE4_PLAN_CHECKSUM"),
    acknowledgedManualReview: env.STAGE4_ACK_MANUAL_REVIEW ?? "",
    planRunId: runId(env, "STAGE4_PLAN_RUN_ID"),
    planFacts,
    newerPlanRunCount: newerPlanRuns(planFacts, planRunList(dir), stage4WorldRunTitle("plan")),
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
  const r = await withClient(db, (client) => runWorldApply(client, input));
  if (r.status === "not_applied") return { ok: false, reasons: r.problems, facts: { dataset: "world", status: r.status, stage: r.stage, plan: r.plan ?? null, productionWrites: 0 } };
  writeOut(dir, "stage4-world-apply-result.json", { schema: "stage4-world-apply-result/v1", status: r.status, applyRunId: env.GITHUB_RUN_ID ?? null, expectation: r.expectation, postVerify: r.postVerify });
  writeOut(dir, "stage4-world-undo-plan.json", { schema: "stage4-world-undo-plan/v1", note: "not executed automatically; requires a separate owner decision", undo: r.undo });
  return {
    ok: r.status === "applied_verified",
    reasons: r.status === "applied_verified" ? [] : ["rollback_required", ...r.postVerify.problems],
    facts: { dataset: "world", status: r.status, batchId: r.batchId, inserted: r.inserted, updated: r.updated, insertedIdentities: r.expectation.insertedIdentities.slice(0, 10), postVerify: r.postVerify, plan: r.plan, automaticUndo: false },
  };
}

async function verify(env: Env, db: ClientConfig): Promise<Stage4Outcome> {
  const dir = workDir(env);
  const applyRunId = runId(env, "STAGE4_APPLY_RUN_ID");
  const applyFacts = facts(dir, "facts-apply.json");
  const runProblems = checkRun({ ...applyFacts, status: "completed", conclusion: "success" }, { id: applyRunId, path: APPLY_WORKFLOW_PATH, title: stage4WorldRunTitle("apply") }, "apply");
  if (runProblems.length > 0) return { ok: false, reasons: runProblems, facts: {} };
  let result: { schema?: unknown; applyRunId?: unknown; expectation?: WorldPostApplyExpectation };
  try {
    result = JSON.parse(readInput(dir, APPLY_RESULT));
  } catch (err) {
    if (err instanceof Stage4Stop) throw err;
    throw new Stage4Stop("apply_result_not_json");
  }
  if (result.schema !== "stage4-world-apply-result/v1" || result.applyRunId !== applyRunId || !result.expectation) return { ok: false, reasons: ["apply_result_not_from_this_run"], facts: {} };
  const expectation = { ...result.expectation, schema: "reference_data" };
  return withClient(db, async (client) => {
    await client.query("begin read only");
    try {
      const post = await verifyWorldPostApply(client, expectation);
      const pre = await runUpdaterPreflight(client);
      const reasons = [...post.problems, ...pre.problems.map((p) => `preflight:${p}`)];
      return { ok: reasons.length === 0, reasons, facts: { dataset: "world", postVerify: post.facts, batchId: expectation.batchId } };
    } finally {
      await client.query("rollback").catch(() => undefined);
    }
  });
}

/** mode別の処理(dataset=world)。確認入力が一致しなければ接続前に停止する。 */
/** dry-run は Production へ接続しないため db を受け取らない(null)。それ以外は db が必須。 */
export async function runWorldMode(mode: Stage4Mode, env: Env, db: ClientConfig | null): Promise<Stage4Outcome> {
  if (env.REFERENCE_DATA_APPLY_CONFIRM !== WORLD_CONFIRM[mode]) return { ok: false, reasons: ["confirmation_mismatch"], facts: {} };
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
