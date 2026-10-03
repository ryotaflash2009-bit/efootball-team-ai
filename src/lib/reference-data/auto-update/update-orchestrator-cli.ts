import { execFile } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  buildApprovalRequest,
  checkDetectionRun,
  decideFromDetection,
  evaluateBackupGate,
  evaluateDryRunGate,
  evaluatePlanGate,
  type Dataset,
  type PlanFacts,
} from "./update-orchestrator";
import { evaluateAutoApplyFromArtifacts } from "./auto-apply-from-artifacts";
import { AUTO_APPLY_POLICY } from "./auto-apply-policy-config";
import type { AutoApplyPolicyResult } from "./auto-apply-policy";

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
  /** artifact のファイル名 → 内容（JSON だけ）。 */
  downloadArtifactFiles(runId: string, name: string): Promise<Record<string, string>>;
  /** 直近に自動 Apply で適用済みになった sourceChecksum12（無ければ null）。 */
  latestAutoApplied(dataset: Dataset): Promise<string | null>;
  /** 自動 Apply を止める Issue（label: reference-data-auto-apply-halt）が open か。 */
  haltOpen(): Promise<boolean>;
  /** 公開サイトの件数（読み取りだけ）。読めなければ null。 */
  publicCount(dataset: Dataset): Promise<number | null>;
  now(): number;
  sleep(ms: number): Promise<void>;
  log(line: string): void;
}

export const APPLY_WORKFLOW = "reference-data-production-apply.yml";
export const BACKUP_WORKFLOW = "reference-data-production-backup.yml";
const POLL_MS = 30_000;
export const LIMIT_MS = { plan: 75 * 60_000, backup: 30 * 60_000, dryRun: 30 * 60_000, applyQueued: 10 * 60_000, applyRun: 45 * 60_000, publicCheck: AUTO_APPLY_POLICY.publicSite.waitMs } as const;
/** dispatch した run を見つけるまでの上限（1 dispatch ごと）。 */
export const DISPATCH_FIND_MS = 5 * 60_000;
/** dispatch の回数（plan・backup・dry run・apply）。workflow の timeout-minutes はこの合計より長くする（テストで確認）。 */
export const DISPATCH_COUNT = 4;

export type AutoApplyVerdict = "AUTO_APPLY_APPLIED_VERIFIED" | "AUTO_APPLY_POST_VERIFY_FAILED" | "AUTO_APPLY_ROLLBACK_REVIEW_REQUIRED";

/** 自動 Apply の設定（Repository variable の kill switch）。値が "true" のときだけ true。 */
export interface AutoApplySwitches {
  enabled: boolean;
  world: boolean;
  managers: boolean;
}

export type OrchestratorOutcome =
  | { kind: "no_action"; reasons: string[] }
  | { kind: "stopped"; stage: string; reasons: string[]; runs: Record<string, string>; policy?: AutoApplyPolicyResult }
  | { kind: "awaiting_approval"; approval: ReturnType<typeof buildApprovalRequest>; runs: Record<string, string>; pending: Dataset[]; policy: AutoApplyPolicyResult; route: { automatic: false; why: string[] } }
  | {
      kind: "auto_applied";
      verdict: AutoApplyVerdict;
      dataset: Dataset;
      runs: Record<string, string>;
      pending: Dataset[];
      policy: AutoApplyPolicyResult;
      applyOutcome: string;
      publicCheck: { expected: number | null; observed: number | null; ok: boolean };
      appliedStateCandidate: Record<string, unknown> | null;
    };

async function dispatchAndFind(deps: OrchestratorDeps, workflow: string, inputs: Record<string, string>, title: string | null, sha: string): Promise<RunInfo> {
  const before = new Set((await deps.listRuns(workflow)).map((r) => r.id));
  const since = deps.now() - 5_000;
  await deps.dispatch(workflow, inputs);
  const deadline = deps.now() + DISPATCH_FIND_MS;
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

/** 完了まで待つ（結果は問わない。自動 Apply の結果は Evidence で判定する）。 */
async function waitFinished(deps: OrchestratorDeps, run: RunInfo, limitMs: number): Promise<RunInfo> {
  const deadline = deps.now() + limitMs;
  let r = run;
  while (r.status !== "completed") {
    if (deps.now() > deadline) throw new StageError("run_timed_out", [r.id]);
    await deps.sleep(POLL_MS);
    r = await deps.getRun(run.id);
  }
  return r;
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

export async function runOrchestrator(
  deps: OrchestratorDeps,
  input: { detectionSummaryText: string; detectionRunId?: string; autoApply?: AutoApplySwitches },
): Promise<OrchestratorOutcome> {
  const d = decideFromDetection(input.detectionSummaryText);
  if (!d.ok) return { kind: "no_action", reasons: d.reasons };
  const switches: AutoApplySwitches = input.autoApply ?? { enabled: false, world: false, managers: false };
  const detection = (() => {
    try {
      return JSON.parse(input.detectionSummaryText) as Record<string, { sourceChecksum12?: unknown } | undefined>;
    } catch {
      return {};
    }
  })();
  const detectionChecksum = (ds: Dataset): string | null => {
    const v = detection[ds]?.sourceChecksum12;
    return typeof v === "string" && /^[0-9a-f]{12}$/.test(v) ? v : null;
  };
  // 自動 Apply で適用済みの候補は、リポジトリの applied-state がまだ古くても、もう一度は適用しない（二重適用の防止）。
  const queue: Dataset[] = [d.value.dataset, ...d.value.pending];
  const skipped: string[] = [];
  let picked: Dataset | null = null;
  for (const ds of queue) {
    const applied = await deps.latestAutoApplied(ds);
    if (applied !== null && applied === detectionChecksum(ds)) skipped.push(`already_applied_by_auto_apply:${ds}`);
    else if (!picked) picked = ds;
  }
  if (!picked) return { kind: "no_action", reasons: skipped };
  const dataset: Dataset = picked;
  const pending = queue.filter((ds) => ds !== dataset && !skipped.includes(`already_applied_by_auto_apply:${ds}`));
  // 起動した run は、完了を待つ前に記録する（失敗した run も停止の報告と通知に残すため）。
  const runs: Record<string, string> = input.detectionRunId ? { detection: input.detectionRunId } : {};
  let stage = "start";
  try {
    const sha = await deps.mainSha();
    const title = (mode: string) => `reference-data ${mode}${dataset === "world" ? " world" : ""}`;

    stage = "plan";
    const planDispatched = await dispatchAndFind(deps, APPLY_WORKFLOW, { mode: "plan", dataset, confirm: `plan-${dataset}` }, title("plan"), sha);
    runs.plan = planDispatched.id;
    const planRun = await waitCompleted(deps, planDispatched, LIMIT_MS.plan);
    const planSummaryName = `reference-data-apply-plan${dataset === "world" ? "-world" : ""}-summary`;
    const planText = await deps.downloadArtifact(planRun.id, planSummaryName);
    const pg = evaluatePlanGate(planText, dataset, sha);
    if (!pg.ok) return { kind: "stopped", stage, reasons: pg.reasons, runs };
    const plan: PlanFacts = pg.value;
    deps.log(`plan ok: run ${planRun.id}, added ${plan.added}, changed ${plan.changed}`);

    stage = "backup";
    if ((await deps.mainSha()) !== sha) return { kind: "stopped", stage, reasons: ["main_sha_changed"], runs };
    const backupDispatched = await dispatchAndFind(deps, BACKUP_WORKFLOW, { confirm: "backup", backup_category: "pre-apply", execution: "automation" }, null, sha);
    runs.backup = backupDispatched.id;
    const backupRun = await waitCompleted(deps, backupDispatched, LIMIT_MS.backup);
    const backupText = await deps.downloadArtifact(backupRun.id, "reference-data-backup-summary");
    const bg = evaluateBackupGate(backupText, backupRun.id, plan.productionCounts);
    if (!bg.ok) return { kind: "stopped", stage, reasons: bg.reasons, runs };
    if (Date.parse(backupRun.createdAt) < Date.parse(planRun.updatedAt)) return { kind: "stopped", stage, reasons: ["backup_not_after_plan"], runs };

    stage = "dry-run";
    if ((await deps.mainSha()) !== sha) return { kind: "stopped", stage, reasons: ["main_sha_changed"], runs };
    const bindings = { plan_run_id: planRun.id, backup_run_id: backupRun.id, source_checksum: plan.sourceChecksum, plan_checksum: plan.planChecksum };
    const dryDispatched = await dispatchAndFind(deps, APPLY_WORKFLOW, { mode: "dry-run", dataset, confirm: `dry-run-${dataset}`, ...bindings }, title("dry-run"), sha);
    runs.dryRun = dryDispatched.id;
    const dryRun = await waitCompleted(deps, dryDispatched, LIMIT_MS.dryRun);
    const dryName = `reference-data-apply-dry-run${dataset === "world" ? "-world" : ""}-summary`;
    const dryText = await deps.downloadArtifact(dryRun.id, dryName);
    const dg = evaluateDryRunGate(dryText, plan, backupRun.id);
    if (!dg.ok) return { kind: "stopped", stage, reasons: dg.reasons, runs };

    // 自動 Apply の判定。手動の経路でも必ず計算して記録する（shadow decision）。
    stage = "policy";
    const policy = evaluateAutoApplyFromArtifacts({
      dataset, bindingSha: sha, currentMainSha: await deps.mainSha(), detectionChecksum12: detectionChecksum(dataset),
      appliedChecksum12: await deps.latestAutoApplied(dataset), planSummaryText: planText, backupSummaryText: backupText,
      backupRunId: backupRun.id, backupCompletedAt: backupRun.updatedAt, dryRunSummaryText: dryText, dryRunRunId: dryRun.id,
      now: new Date(deps.now()).toISOString(),
    });
    deps.log(`auto-apply policy: ${policy.decision}${policy.reasonCodes.length ? ` (${policy.reasonCodes.join(", ")})` : ""}`);
    if (policy.decision === "AUTO_APPLY_BLOCKED" || policy.decision === "INVALID_INPUT") return { kind: "stopped", stage, reasons: policy.reasonCodes, runs, policy };
    const why: string[] = [];
    if (policy.decision !== "AUTO_APPLY_ELIGIBLE") why.push("policy_manual_apply_required");
    if (!switches.enabled) why.push(`kill_switch_off:${AUTO_APPLY_POLICY.killSwitches.all}`);
    if (!switches[dataset]) why.push(`kill_switch_off:${AUTO_APPLY_POLICY.killSwitches[dataset]}`);
    if (why.length === 0 && (await deps.haltOpen())) why.push("halt_issue_open");

    stage = "apply-run";
    if ((await deps.mainSha()) !== sha) return { kind: "stopped", stage, reasons: ["main_sha_changed"], runs, policy };
    const applyConfirm = dataset === "world" ? "apply-world-to-production" : "apply-managers-to-production";
    const applyInputs = { mode: "apply", dataset, confirm: applyConfirm, ...bindings, dry_run_run_id: dryRun.id, acknowledge_manual_review: plan.acknowledge };

    if (why.length > 0) {
      // 手動の経路（従来どおり）: Apply run を作り、本人の Environment 承認を待つ。
      const applyRun = await dispatchAndFind(deps, APPLY_WORKFLOW, applyInputs, title("apply"), sha);
      runs.apply = applyRun.id;
      const deadline = deps.now() + LIMIT_MS.applyQueued;
      let a = applyRun;
      while (a.status !== "waiting" && deps.now() < deadline) {
        if (a.status === "completed") return { kind: "stopped", stage, reasons: [`apply_run_completed_without_approval:${a.conclusion}`], runs, policy };
        await deps.sleep(10_000);
        a = await deps.getRun(applyRun.id);
      }
      if (a.status !== "waiting") return { kind: "stopped", stage, reasons: ["apply_run_not_waiting_for_approval"], runs, policy };
      const approval = buildApprovalRequest({ dataset, plan, planRunId: planRun.id, backupRunId: backupRun.id, backupCompletedAt: backupRun.updatedAt, dryRunRunId: dryRun.id, applyRunUrl: a.url });
      return { kind: "awaiting_approval", approval, runs, pending, policy, route: { automatic: false, why } };
    }

    // 自動の経路: 承認者なしの Environment で Apply し、事後検証・公開サイトの件数まで確かめる。Rollback・Restore はしない。
    stage = "auto-apply";
    // 自動の経路は確認入力で区別する（workflow_dispatch の入力数の上限のため、route の入力は増やさない）。
    const applyRun = await dispatchAndFind(deps, APPLY_WORKFLOW, { ...applyInputs, confirm: `auto-${applyConfirm}` }, title("apply"), sha);
    runs.apply = applyRun.id;
    const done = await waitFinished(deps, applyRun, LIMIT_MS.applyRun);
    if (done.attempt !== 1) return { kind: "stopped", stage, reasons: ["apply_run_is_rerun"], runs, policy };
    let files: Record<string, string> = {};
    try {
      files = await deps.downloadArtifactFiles(done.id, `reference-data-apply-apply${dataset === "world" ? "-world" : ""}-evidence`);
    } catch {
      files = {};
    }
    const parseObj = (t: string | undefined): Record<string, unknown> | null => {
      try {
        const v = JSON.parse(t ?? "") as unknown;
        return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    };
    const evidence = parseObj(files["evidence.json"]);
    const candidate = parseObj(files["applied-state.candidate.json"]);
    const outcome = typeof evidence?.outcome === "string" ? evidence.outcome : "no_evidence";
    const written = evidence?.productionWritten === true;
    const base = { kind: "auto_applied" as const, dataset, runs, pending, policy, applyOutcome: outcome, appliedStateCandidate: candidate };
    if (outcome === "applied_verified" && done.conclusion === "success") {
      const expected = policy.expectedAfterCount;
      const deadline = deps.now() + LIMIT_MS.publicCheck;
      let observed = await deps.publicCount(dataset);
      while (observed !== expected && deps.now() < deadline) {
        await deps.sleep(POLL_MS);
        observed = await deps.publicCount(dataset);
      }
      const ok = observed === expected;
      return { ...base, verdict: ok ? "AUTO_APPLY_APPLIED_VERIFIED" : "AUTO_APPLY_POST_VERIFY_FAILED", publicCheck: { expected, observed, ok } };
    }
    if (!evidence || outcome === "rollback_required" || written) {
      // 書き込んだか分からない・事後検証の失敗 → 新しい自動 Apply を止めて本人の判断を待つ。
      return { ...base, verdict: "AUTO_APPLY_ROLLBACK_REVIEW_REQUIRED", publicCheck: { expected: policy.expectedAfterCount, observed: null, ok: false } };
    }
    // 書き込みの前に止まった（kill switch・再確認・Secret 不足など）。
    return { kind: "stopped", stage, reasons: [`auto_apply_not_applied:${outcome}`], runs, policy };
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
    downloadArtifactFiles: async (runId, name) => {
      if (!/^[0-9]{1,20}$/.test(runId) || !/^[a-z0-9-]{1,80}$/.test(name)) throw new StageError("artifact_input_invalid", []);
      const dir = path.join(workDir, `${runId}-${name}`);
      mkdirSync(dir, { recursive: true });
      await gh(["run", "download", runId, "--repo", repo, "-n", name, "-D", dir]);
      const files = readdirSync(dir).filter((f) => f.endsWith(".json")).slice(0, 5);
      return Object.fromEntries(files.map((f) => [f, readFileSync(path.join(dir, f), "utf8")]));
    },
    latestAutoApplied: async (dataset) => {
      // 直近の成功した Apply run（手動・自動とも）の applied-state 候補。Production の最新の適用状態を表す。
      const title = `reference-data apply${dataset === "world" ? " world" : ""}`;
      const list = JSON.parse(await gh(["run", "list", "--repo", repo, "--workflow", APPLY_WORKFLOW, "--branch", "main", "--event", "workflow_dispatch", "--status", "success", "--limit", "30", "--json", "databaseId,displayTitle"])) as Record<string, unknown>[];
      const newest = list.find((r) => r.displayTitle === title);
      if (!newest) return null;
      try {
        const dir = path.join(workDir, `latest-applied-${dataset}`);
        mkdirSync(dir, { recursive: true });
        await gh(["run", "download", String(newest.databaseId), "--repo", repo, "-n", `reference-data-apply-apply${dataset === "world" ? "-world" : ""}-evidence`, "-D", dir]);
        const c = JSON.parse(readFileSync(path.join(dir, "applied-state.candidate.json"), "utf8")) as { entry?: { sourceChecksum12?: unknown } };
        const v = c.entry?.sourceChecksum12;
        return typeof v === "string" && /^[0-9a-f]{12}$/.test(v) ? v : null;
      } catch {
        return null;
      }
    },
    haltOpen: async () => {
      try {
        const n = (await gh(["api", `repos/${repo}/issues?state=open&labels=${AUTO_APPLY_POLICY.haltIssueLabel}`, "--jq", "length"])).trim();
        return n !== "0";
      } catch {
        // 読めなければ止める側に倒す（halt が open とみなす）。
        return true;
      }
    },
    publicCount: async (dataset) => {
      try {
        const res = await fetch(`${AUTO_APPLY_POLICY.publicSite.baseUrl}${AUTO_APPLY_POLICY.publicSite.paths[dataset]}`, { signal: AbortSignal.timeout(15_000), headers: { "cache-control": "no-cache" } });
        if (res.status !== 200) return null;
        const j = (await res.json()) as { totalCount?: unknown };
        return Number.isInteger(j.totalCount) ? (j.totalCount as number) : null;
      } catch {
        return null;
      }
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (line) => process.stdout.write(`${line}\n`),
  };
}

function markdownFor(outcome: OrchestratorOutcome): string {
  const policyLine = (p: AutoApplyPolicyResult | undefined) => (p ? `\n自動 Apply の判定（${p.contractVersion}）: ${p.decision}${p.reasonCodes.length ? `（${p.reasonCodes.join(", ")}）` : ""}\n` : "");
  if (outcome.kind === "awaiting_approval") {
    return `${outcome.approval.markdown}\n${policyLine(outcome.policy)}手動の経路の理由: ${outcome.route.why.join(", ")}\n\n${outcome.pending.length ? `次の検出で続けて処理: ${outcome.pending.join(", ")}\n` : ""}`;
  }
  if (outcome.kind === "no_action") return `## 自動更新: 実行なし\n\n理由: ${outcome.reasons.join(", ")}\n`;
  if (outcome.kind === "auto_applied") {
    return [
      `## 自動 Apply: ${outcome.verdict}`,
      "",
      `dataset: ${outcome.dataset} / Apply の結果: ${outcome.applyOutcome} / 公開サイトの件数: ${outcome.publicCheck.observed ?? "?"}（期待 ${outcome.publicCheck.expected ?? "?"}）`,
      `run: ${JSON.stringify(outcome.runs)}`,
      policyLine(outcome.policy),
      outcome.verdict === "AUTO_APPLY_APPLIED_VERIFIED" ? "" : "新しい自動 Apply は止まります（halt Issue）。Rollback・Restore は実行していません。本人の判断を待ちます。",
    ].join("\n");
  }
  return `## 自動更新: 停止（Production への書き込みなし）\n\n段階: ${outcome.stage}\n\n理由: ${outcome.reasons.join(", ")}\n\n起動したrun: ${JSON.stringify(outcome.runs)}\n${policyLine(outcome.policy)}`;
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
  // 手動起動でも、指定された検出 run が main 上の検出 workflow の成功した初回の実行であることを確かめる。
  let detectionFacts: Record<string, unknown> = {};
  try {
    detectionFacts = JSON.parse((await exec("gh", ["run", "view", detectionRunId, "--repo", repo, "--json", "workflowName,headBranch,conclusion,attempt,event"])).stdout) as Record<string, unknown>;
  } catch {
    detectionFacts = {};
  }
  const detCheck = checkDetectionRun(detectionFacts);
  if (!detCheck.ok) {
    const stopped: OrchestratorOutcome = { kind: "stopped", stage: "detection_run", reasons: detCheck.reasons, runs: { detection: detectionRunId } };
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, markdownFor(stopped));
    writeFileSync(path.join(workDir, "reference-data-update-approval.json"), `${JSON.stringify(stopped, null, 2)}\n`);
    process.stdout.write(markdownFor(stopped));
    return 1;
  }
  const detectionText = await deps.downloadArtifact(detectionRunId, "reference-data-detection-summary");
  const autoApply: AutoApplySwitches = { enabled: env.AUTO_APPLY_ENABLED === "true", world: env.AUTO_APPLY_WORLD_ENABLED === "true", managers: env.AUTO_APPLY_MANAGERS_ENABLED === "true" };
  const outcome = await runOrchestrator(deps, { detectionSummaryText: detectionText, detectionRunId, autoApply });
  const summary = markdownFor(outcome);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  const record = outcome.kind === "awaiting_approval" ? { kind: outcome.kind, runs: outcome.runs, ...outcome.approval.json, autoApplyPolicy: outcome.policy, route: outcome.route } : outcome;
  writeFileSync(path.join(workDir, "reference-data-update-approval.json"), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(summary);
  if (outcome.kind === "stopped") return 1;
  if (outcome.kind === "auto_applied" && outcome.verdict !== "AUTO_APPLY_APPLIED_VERIFIED") return 1;
  return 0;
}
