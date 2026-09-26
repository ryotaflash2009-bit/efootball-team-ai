import { describe, it, expect } from "vitest";
import { APPLY_WORKFLOW, BACKUP_WORKFLOW, runOrchestrator, type OrchestratorDeps, type RunInfo } from "./update-orchestrator-cli";
import { SHA, backupSummary, dryRunSummary, planSummary } from "./__fixtures__/orchestrator-fixtures";

const DETECTION = JSON.stringify({ ok: true, world: { decision: "update_available" }, managers: { decision: "no_change" } });
const BACKUP_RUN = "36248197028";

interface Fake {
  deps: OrchestratorDeps;
  dispatched: { workflow: string; inputs: Record<string, string> }[];
}

/** GitHub を模した偽物。dispatch するとその workflow に新しい run が1つ現れ、getRun で完了(または承認待ち)になる。 */
function fake(opts: {
  artifacts?: Partial<Record<string, string>>;
  conclusion?: Partial<Record<string, string>>;
  applyStatus?: string;
  mainShas?: string[];
  runSha?: string;
} = {}): Fake {
  let clock = Date.parse("2026-09-27T00:00:00.000Z");
  const runs: Record<string, RunInfo[]> = { [APPLY_WORKFLOW]: [], [BACKUP_WORKFLOW]: [] };
  const byId = new Map<string, RunInfo>();
  const dispatched: Fake["dispatched"] = [];
  const shas = [...(opts.mainShas ?? [])];
  let next = 100;
  const artifacts: Record<string, string> = {
    "reference-data-apply-plan-world-summary": planSummary(),
    "reference-data-backup-summary": backupSummary(),
    "reference-data-apply-dry-run-world-summary": dryRunSummary(),
    ...(opts.artifacts as Record<string, string>),
  };
  const deps: OrchestratorDeps = {
    mainSha: async () => shas.shift() ?? SHA,
    dispatch: async (workflow, inputs) => {
      dispatched.push({ workflow, inputs });
      const id = workflow === BACKUP_WORKFLOW ? BACKUP_RUN : String(next++);
      const mode = inputs.mode ?? "backup";
      const run: RunInfo = {
        id, status: "queued", conclusion: null, headSha: opts.runSha ?? SHA,
        createdAt: new Date(clock).toISOString(), updatedAt: new Date(clock).toISOString(),
        url: `https://github.com/o/r/actions/runs/${id}`, displayTitle: workflow === APPLY_WORKFLOW ? `reference-data ${mode} world` : "Reference data Production backup", attempt: 1,
      };
      runs[workflow].push(run);
      byId.set(id, run);
    },
    listRuns: async (workflow) => runs[workflow].map((r) => ({ ...r })),
    getRun: async (id) => {
      const r = byId.get(id)!;
      const mode = r.displayTitle.split(" ")[1] ?? "backup";
      if (mode === "apply") r.status = opts.applyStatus ?? "waiting";
      else {
        r.status = "completed";
        r.conclusion = opts.conclusion?.[mode] ?? "success";
      }
      r.updatedAt = new Date(clock).toISOString();
      return { ...r };
    },
    downloadArtifact: async (_runId, name) => {
      const a = artifacts[name];
      if (a === undefined) throw new Error(`no artifact ${name}`);
      return a;
    },
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    log: () => undefined,
  };
  return { deps, dispatched };
}

describe("runOrchestrator（Plan → Backup → Dry run → Apply run 作成）", () => {
  it("全段階が合格すれば、Apply run を承認待ちまで作り、承認要約を返す（承認はしない）", async () => {
    const f = fake();
    const out = await runOrchestrator(f.deps, { detectionSummaryText: DETECTION });
    expect(out.kind).toBe("awaiting_approval");
    expect(f.dispatched.map((d) => `${d.workflow}:${d.inputs.mode ?? d.inputs.backup_category}`)).toEqual([
      `${APPLY_WORKFLOW}:plan`, `${BACKUP_WORKFLOW}:pre-apply`, `${APPLY_WORKFLOW}:dry-run`, `${APPLY_WORKFLOW}:apply`,
    ]);
    expect(f.dispatched[0].inputs).toEqual({ mode: "plan", dataset: "world", confirm: "plan-world" });
    expect(f.dispatched[1].inputs).toEqual({ confirm: "backup", backup_category: "pre-apply", execution: "automation" });
    expect(f.dispatched[2].inputs).toMatchObject({ mode: "dry-run", confirm: "dry-run-world", plan_run_id: "100", backup_run_id: BACKUP_RUN });
    expect(f.dispatched[3].inputs).toMatchObject({ mode: "apply", confirm: "apply-world-to-production", dry_run_run_id: "101", acknowledge_manual_review: "baseline_missing" });
    if (out.kind === "awaiting_approval") {
      expect(out.approval.json.applyRunUrl).toBe("https://github.com/o/r/actions/runs/102");
      expect(out.approval.markdown).toContain("本人の承認が1回必要です");
      expect(out.runs).toEqual({ plan: "100", backup: BACKUP_RUN, dryRun: "101", apply: "102" });
    }
  });

  it("変化なし・attention_required は何も起動しない", async () => {
    for (const d of [
      JSON.stringify({ ok: true, world: { decision: "no_change" }, managers: { decision: "no_change" } }),
      JSON.stringify({ ok: true, world: { decision: "attention_required" }, managers: { decision: "update_available" } }),
    ]) {
      const f = fake();
      expect((await runOrchestrator(f.deps, { detectionSummaryText: d })).kind).toBe("no_action");
      expect(f.dispatched).toEqual([]);
    }
  });

  it("Plan が removed を含めば Backup 以降を起動しない", async () => {
    const f = fake({ artifacts: { "reference-data-apply-plan-world-summary": planSummary((p) => { p.removedCount = 1; }) } });
    const out = await runOrchestrator(f.deps, { detectionSummaryText: DETECTION });
    expect(out).toMatchObject({ kind: "stopped", stage: "plan" });
    expect(out.kind === "stopped" && out.reasons).toContain("plan_removed_not_zero");
    expect(f.dispatched).toHaveLength(1);
  });

  it("Plan run が失敗したら停止（再実行しない）", async () => {
    const f = fake({ conclusion: { plan: "failure" } });
    const out = await runOrchestrator(f.deps, { detectionSummaryText: DETECTION });
    expect(out).toMatchObject({ kind: "stopped", stage: "plan", reasons: ["run_not_successful", "100:failure"] });
    expect(f.dispatched).toHaveLength(1);
  });

  it("Backup が無効なら Dry run を起動しない", async () => {
    const f = fake({ artifacts: { "reference-data-backup-summary": backupSummary((s) => { s.restoreVerified = false; }) } });
    const out = await runOrchestrator(f.deps, { detectionSummaryText: DETECTION });
    expect(out).toMatchObject({ kind: "stopped", stage: "backup" });
    expect(f.dispatched).toHaveLength(2);
  });

  it("Dry run の re-diff が0でなければ Apply run を作らない", async () => {
    const f = fake({ artifacts: { "reference-data-apply-dry-run-world-summary": dryRunSummary((x) => { (x.isolated as { dryRun: { rediffChanges: number } }).dryRun.rediffChanges = 1; }) } });
    const out = await runOrchestrator(f.deps, { detectionSummaryText: DETECTION });
    expect(out).toMatchObject({ kind: "stopped", stage: "dry-run" });
    expect(f.dispatched.some((d) => d.inputs.mode === "apply")).toBe(false);
  });

  it("途中で main が進んだら停止する", async () => {
    const f = fake({ mainShas: [SHA, "f".repeat(40)] });
    const out = await runOrchestrator(f.deps, { detectionSummaryText: DETECTION });
    expect(out).toMatchObject({ kind: "stopped", stage: "backup", reasons: ["main_sha_changed"] });
    expect(f.dispatched).toHaveLength(1);
  });

  it("起動した run が別の commit なら停止する", async () => {
    const f = fake({ runSha: "e".repeat(40) });
    const out = await runOrchestrator(f.deps, { detectionSummaryText: DETECTION });
    expect(out).toMatchObject({ kind: "stopped", stage: "plan", reasons: ["dispatch_commit_sha_mismatch"] });
  });

  it("Apply run が承認待ちにならずに終わったら停止として報告する", async () => {
    const f = fake({ applyStatus: "completed" });
    const out = await runOrchestrator(f.deps, { detectionSummaryText: DETECTION });
    expect(out).toMatchObject({ kind: "stopped", stage: "apply-run" });
  });
});
