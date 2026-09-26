import { execFile } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  buildApprovalRequest,
  decideFromDetection,
  evaluateBackupGate,
  evaluateDryRunGate,
  evaluatePlanGate,
  type Dataset,
  type PlanFacts,
} from "./update-orchestrator";

/**
 * 更新パイプラインの自動進行(`reference-data-update-orchestrator.yml`から実行)。Secretを持たず、GITHUB_TOKEN(actions: write)で
 * Plan → Backup → Dry run → Apply run の作成までを、別々の workflow_dispatch run として順に起動・待機・検証する。
 * どの段階でも条件を満たさなければ、次の run を起動せずに停止する(Apply run は作らない)。Apply run は Environment 承認待ちで止まり、
 * 本人が Approve and deploy を押すまで何も書き込まない。自動再試行はしない。
 */

export interface RunInfo {
  id: string;
  status: string;
  conclusion: string | null;
  headSha: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  displayTitle: string;
  attempt: number;
}

/** GitHub への操作(テストでは偽物を渡す)。 */
export interface OrchestratorDeps {
  mainSha(): Promise<string>;
  dispatch(workflow: string, inputs: Record<string, string>): Promise<void>;
  listRuns(workflow: string): Promise<RunInfo[]>;
  getRun(id: string): Promise<RunInfo>;
  downloadArtifact(runId: string, name: string): Promise<string>;
  now(): number;
  sleep(ms: number): Promise<void>;
  log(line: string): void;
}

export const APPLY_WORKFLOW = "reference-data-production-apply.yml";
export const BACKUP_WORKFLOW = "reference-data-production-backup.yml";
const POLL_MS = 30_000;
const LIMIT_MS = { plan: 75 * 60_000, backup: 30 * 60_000, dryRun: 30 * 60_000, applyQueued: 10 * 60_000 } as const;

export type OrchestratorOutcome =
  | { kind: "no_action"; reasons: string[] }
  | { kind: "stopped"; stage: string; reasons: string[]; runs: Record<string, string> }
  | { kind: "awaiting_approval"; approval: ReturnType<typeof buildApprovalRequest>; runs: Record<string, string>; pending: Dataset[] };

async function dispatchAndFind(deps: OrchestratorDeps, workflow: string, inputs: Record<string, string>, title: string | null, sha: string): Promise<RunInfo> {
  const before = new Set((await deps.listRuns(workflow)).map((r) => r.id));
  const since = deps.now() - 5_000;
  await deps.dispatch(workflow, inputs);
  const deadline = deps.now() + 5 * 60_000;
  while (deps.now() < deadline) {
    await deps.sleep(10_000);
    const fresh = (await deps.listRuns(workflow)).filter((r) => !before.has(r.id) && Date.parse(r.createdAt) >= since && (title == null || r.displayTitle === title));
    if (fresh.length > 1) throw new StageError("dispatch_ambiguous_run", [`${fresh.length} new runs`]);
    if (fresh.length === 1) {
      if (fresh[0].headSha !== sha) throw new StageError("dispatch_commit_sha_mismatch", []);
      return fresh[0];
    }
  }
  throw new StageError("dispatch_run_not_found", []);
}

async function waitCompleted(deps: OrchestratorDeps, run: RunInfo, limitMs: number): Promise<RunInfo> {
  const deadline = deps.now() + limitMs;
  let r = run;
  while (r.status !== "completed") {
    if (deps.now() > deadline) throw new StageError("run_timed_out", [r.id]);
    await deps.sleep(POLL_MS);
    r = await deps.getRun(run.id);
  }
  if (r.conclusion !== "success") throw new StageError("run_not_successful", [`${r.id}:${r.conclusion}`]);
  if (r.attempt !== 1) throw new StageError("run_is_rerun", [r.id]);
  return r;
}

class StageError extends Error {
  constructor(readonly code: string, readonly details: string[]) {
    super(code);
  }
}

export async function runOrchestrator(deps: OrchestratorDeps, input: { detectionSummaryText: string }): Promise<OrchestratorOutcome> {
  const d = decideFromDetection(input.detectionSummaryText);
  if (!d.ok) return { kind: "no_action", reasons: d.reasons };
  const dataset = d.value.dataset;
  const runs: Record<string, string> = {};
  let stage = "start";
  try {
    const sha = await deps.mainSha();
    const title = (mode: string) => `reference-data ${mode}${dataset === "world" ? " world" : ""}`;

    stage = "plan";
    const planRun = await waitCompleted(deps, await dispatchAndFind(deps, APPLY_WORKFLOW, { mode: "plan", dataset, confirm: `plan-${dataset}` }, title("plan"), sha), LIMIT_MS.plan);
    runs.plan = planRun.id;
    const planSummaryName = `reference-data-apply-plan${dataset === "world" ? "-world" : ""}-summary`;
    const pg = evaluatePlanGate(await deps.downloadArtifact(planRun.id, planSummaryName), dataset, sha);
    if (!pg.ok) return { kind: "stopped", stage, reasons: pg.reasons, runs };
    const plan: PlanFacts = pg.value;
    deps.log(`plan ok: run ${planRun.id}, added ${plan.added}, changed ${plan.changed}`);

    stage = "backup";
    if ((await deps.mainSha()) !== sha) return { kind: "stopped", stage, reasons: ["main_sha_changed"], runs };
    const backupRun = await waitCompleted(deps, await dispatchAndFind(deps, BACKUP_WORKFLOW, { confirm: "backup", backup_category: "pre-apply", execution: "automation" }, null, sha), LIMIT_MS.backup);
    runs.backup = backupRun.id;
    const bg = evaluateBackupGate(await deps.downloadArtifact(backupRun.id, "reference-data-backup-summary"), backupRun.id, plan.productionCounts);
    if (!bg.ok) return { kind: "stopped", stage, reasons: bg.reasons, runs };
    if (Date.parse(backupRun.createdAt) < Date.parse(planRun.updatedAt)) return { kind: "stopped", stage, reasons: ["backup_not_after_plan"], runs };

    stage = "dry-run";
    if ((await deps.mainSha()) !== sha) return { kind: "stopped", stage, reasons: ["main_sha_changed"], runs };
    const bindings = { plan_run_id: planRun.id, backup_run_id: backupRun.id, source_checksum: plan.sourceChecksum, plan_checksum: plan.planChecksum };
    const dryRun = await waitCompleted(deps, await dispatchAndFind(deps, APPLY_WORKFLOW, { mode: "dry-run", dataset, confirm: `dry-run-${dataset}`, ...bindings }, title("dry-run"), sha), LIMIT_MS.dryRun);
    runs.dryRun = dryRun.id;
    const dryName = `reference-data-apply-dry-run${dataset === "world" ? "-world" : ""}-summary`;
    const dg = evaluateDryRunGate(await deps.downloadArtifact(dryRun.id, dryName), plan, backupRun.id);
    if (!dg.ok) return { kind: "stopped", stage, reasons: dg.reasons, runs };

    stage = "apply-run";
    if ((await deps.mainSha()) !== sha) return { kind: "stopped", stage, reasons: ["main_sha_changed"], runs };
    const applyConfirm = dataset === "world" ? "apply-world-to-production" : "apply-managers-to-production";
    const applyRun = await dispatchAndFind(deps, APPLY_WORKFLOW, { mode: "apply", dataset, confirm: applyConfirm, ...bindings, dry_run_run_id: dryRun.id, acknowledge_manual_review: plan.acknowledge }, title("apply"), sha);
    runs.apply = applyRun.id;
    // Environment承認待ち(waiting)になったことを確認する(承認はしない)。
    const deadline = deps.now() + LIMIT_MS.applyQueued;
    let a = applyRun;
    while (a.status !== "waiting" && deps.now() < deadline) {
      if (a.status === "completed") return { kind: "stopped", stage, reasons: [`apply_run_completed_without_approval:${a.conclusion}`], runs };
      await deps.sleep(10_000);
      a = await deps.getRun(applyRun.id);
    }
    if (a.status !== "waiting") return { kind: "stopped", stage, reasons: ["apply_run_not_waiting_for_approval"], runs };
    const approval = buildApprovalRequest({ dataset, plan, planRunId: planRun.id, backupRunId: backupRun.id, backupCompletedAt: backupRun.updatedAt, dryRunRunId: dryRun.id, applyRunUrl: a.url });
    return { kind: "awaiting_approval", approval, runs, pending: d.value.pending };
  } catch (err) {
    if (err instanceof StageError) return { kind: "stopped", stage, reasons: [err.code, ...err.details], runs };
    return { kind: "stopped", stage, reasons: ["unexpected_error"], runs };
  }
}

// ---------------------------------------------------------------------------
// 実行(gh CLI + GITHUB_TOKEN)
// ---------------------------------------------------------------------------

const exec = promisify(execFile);

function ghDeps(repo: string, workDir: string): OrchestratorDeps {
  const gh = async (args: string[]) => (await exec("gh", args, { maxBuffer: 32 * 1024 * 1024 })).stdout;
  const toRun = (r: Record<string, unknown>): RunInfo => ({
    id: String(r.databaseId ?? r.id),
    status: String(r.status),
    conclusion: (r.conclusion as string | null) ?? null,
    headSha: String(r.headSha ?? r.head_sha),
    createdAt: String(r.createdAt ?? r.created_at),
    updatedAt: String(r.updatedAt ?? r.updated_at),
    url: String(r.url ?? r.html_url),
    displayTitle: String(r.displayTitle ?? r.display_title),
    attempt: Number(r.attempt ?? r.run_attempt ?? 1),
  });
  return {
    mainSha: async () => (await gh(["api", `repos/${repo}/commits/main`, "--jq", ".sha"])).trim(),
    dispatch: async (workflow, inputs) => {
      await gh(["workflow", "run", workflow, "--repo", repo, "--ref", "main", ...Object.entries(inputs).flatMap(([k, v]) => ["-f", `${k}=${v}`])]);
    },
    listRuns: async (workflow) =>
      (JSON.parse(await gh(["run", "list", "--repo", repo, "--workflow", workflow, "--branch", "main", "--event", "workflow_dispatch", "--limit", "20", "--json", "databaseId,status,conclusion,headSha,createdAt,updatedAt,url,displayTitle,attempt"])) as Record<string, unknown>[]).map(toRun),
    getRun: async (id) => toRun(JSON.parse(await gh(["run", "view", id, "--repo", repo, "--json", "databaseId,status,conclusion,headSha,createdAt,updatedAt,url,displayTitle,attempt"]))),
    downloadArtifact: async (runId, name) => {
      if (!/^[0-9]{1,20}$/.test(runId) || !/^[a-z0-9-]{1,80}$/.test(name)) throw new StageError("artifact_input_invalid", []);
      const dir = path.join(workDir, `${runId}-${name}`);
      mkdirSync(dir, { recursive: true });
      await gh(["run", "download", runId, "--repo", repo, "-n", name, "-D", dir]);
      const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
      if (files.length !== 1) throw new StageError("artifact_unexpected_files", [name]);
      return readFileSync(path.join(dir, files[0]), "utf8");
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (line) => process.stdout.write(`${line}\n`),
  };
}

function markdownFor(outcome: OrchestratorOutcome): string {
  if (outcome.kind === "awaiting_approval") return `${outcome.approval.markdown}\n\n${outcome.pending.length ? `次の検出で続けて処理: ${outcome.pending.join(", ")}\n` : ""}`;
  if (outcome.kind === "no_action") return `## 自動更新: 実行なし\n\n理由: ${outcome.reasons.join(", ")}\n`;
  return `## 自動更新: 停止（Apply run は作成していません）\n\n段階: ${outcome.stage}\n\n理由: ${outcome.reasons.join(", ")}\n\n起動したrun: ${JSON.stringify(outcome.runs)}\n`;
}

export async function main(env: Readonly<Record<string, string | undefined>> = process.env): Promise<number> {
  const repo = env.GITHUB_REPOSITORY ?? "";
  const detectionRunId = env.ORCHESTRATOR_DETECTION_RUN_ID ?? "";
  const workDir = env.ORCHESTRATOR_WORK_DIR ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[0-9]{1,20}$/.test(detectionRunId) || !path.isAbsolute(workDir)) {
    process.stdout.write(`${JSON.stringify({ ok: false, reasons: ["orchestrator_input_invalid"] })}\n`);
    return 1;
  }
  const deps = ghDeps(repo, workDir);
  const detectionText = await deps.downloadArtifact(detectionRunId, "reference-data-detection-summary");
  const outcome = await runOrchestrator(deps, { detectionSummaryText: detectionText });
  const summary = markdownFor(outcome);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  writeFileSync(path.join(workDir, "reference-data-update-approval.json"), `${JSON.stringify(outcome.kind === "awaiting_approval" ? { kind: outcome.kind, runs: outcome.runs, ...outcome.approval.json } : outcome, null, 2)}\n`);
  process.stdout.write(summary);
  return outcome.kind === "stopped" ? 1 : 0;
}
