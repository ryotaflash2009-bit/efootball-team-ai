import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildPipelineNotification, parseApplyRunTitle } from "../../../../scripts/lib/reference-data-notify.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const RUN = { runId: "1", runUrl: "https://github.com/owner/repo/actions/runs/1" };

describe("自動進行・Apply の通知", () => {
  it("orchestrator: 停止は段階・理由・起動した run を通知し、no_action と skip は通知しない", () => {
    const n = buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "failure", approval: { kind: "stopped", stage: "backup", reasons: ["backup_counts_differ_from_plan:managers", "https://evil.example"], runs: { detection: "10", plan: "11" } } });
    expect(n).toMatchObject({ notify: true });
    if (!n.notify) return;
    expect(n.title).toContain("停止");
    expect(n.body).toContain("段階: backup");
    expect(n.body).toContain("backup_counts_differ_from_plan:managers");
    expect(n.body).not.toContain("evil.example");
    expect(n.body).toContain("detection 10 / plan 11");
    expect(n.body).toContain("Apply run は作成していません");
    expect(buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "success", approval: { kind: "no_action", reasons: ["no_change"] } })).toMatchObject({ notify: false });
    expect(buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "skipped" })).toMatchObject({ notify: false });
  });

  it("orchestrator: 要約を読めない失敗も停止として通知する（成功扱いにしない）", () => {
    const n = buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "failure", approval: null });
    expect(n).toMatchObject({ notify: true });
    if (n.notify) expect(n.body).toContain("要約を読めなかった");
  });

  it("orchestrator: Apply 承認待ちは件数と binding を通知する", () => {
    const n = buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "success", approval: { kind: "awaiting_approval", dataset: "world", added: 75, updated: 3, removed: 0, runs: { plan: "2", backup: "3", dryRun: "4", apply: "5" } } });
    expect(n).toMatchObject({ notify: true });
    if (!n.notify) return;
    expect(n.title).toContain("承認待ち");
    expect(n.body).toContain("追加 75 件・更新 3 件・削除 0 件");
    expect(n.body).toContain("plan 2 / backup 3 / dryRun 4 / apply 5");
  });

  it("apply: 検証済み・要 rollback・失敗を区別し、plan/dry-run の成功と preflight は通知しない", () => {
    const ok = buildPipelineNotification({ ...RUN, source: "apply", conclusion: "success", title: "reference-data apply world", evidence: { outcome: "applied_verified", approvedBy: "owner-login" } });
    expect(ok).toMatchObject({ notify: true });
    if (ok.notify) {
      expect(ok.title).toContain("検証済み");
      expect(ok.body).toContain("承認者: owner-login");
      expect(ok.body).toContain("applied-state.candidate.json");
    }
    const rb = buildPipelineNotification({ ...RUN, source: "apply", conclusion: "failure", title: "reference-data apply", evidence: { outcome: "rollback_required" } });
    if (rb.notify) expect(rb.title).toContain("要対応");
    // 成功の conclusion でも Evidence が applied_verified でなければ完了と書かない
    const odd = buildPipelineNotification({ ...RUN, source: "apply", conclusion: "success", title: "reference-data apply", evidence: null });
    if (odd.notify) expect(odd.title).not.toContain("検証済み");
    expect(buildPipelineNotification({ ...RUN, source: "apply", conclusion: "failure", title: "reference-data dry-run world" })).toMatchObject({ notify: true });
    expect(buildPipelineNotification({ ...RUN, source: "apply", conclusion: "success", title: "reference-data plan" })).toMatchObject({ notify: false });
    expect(buildPipelineNotification({ ...RUN, source: "apply", conclusion: "failure", title: "reference-data preflight" })).toMatchObject({ notify: false });
    expect(parseApplyRunTitle("reference-data verify world")).toEqual({ mode: "verify", dataset: "world" });
    expect(parseApplyRunTitle("something else")).toBeNull();
  });
});

describe("reference-data-pipeline-notify.yml の静的監査", () => {
  const wf = readFileSync(path.join(ROOT, ".github", "workflows", "reference-data-pipeline-notify.yml"), "utf8");
  const code = wf.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

  it("起動は orchestrator と Production apply の完了だけで、main の run だけを扱う", () => {
    expect(code).toMatch(/^on:\s*\n\s+workflow_run:\s*\n\s+workflows: \[[^\]]+\]\s*\n\s+types: \[completed\]\s*\n\s*\npermissions:/m);
    expect(code).not.toMatch(/^\s*(schedule|push|pull_request|pull_request_target|workflow_dispatch|repository_dispatch)\s*:/m);
    expect(code).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  it("権限は contents: read・actions: read・issues: write だけ。Secret・Environment・Production・dispatch を使わない", () => {
    expect(code).toMatch(/^permissions:\s*\n\s+contents: read\s*\n\s+actions: read\s*\n\s+issues: write\s*$/m);
    expect(code).not.toMatch(/secrets\.|environment:/);
    expect(code).not.toMatch(/run-production|run-update-orchestrator|tsconfig\.(production|backup)|git (commit|push)|gh (workflow|pr) |gh run (rerun|cancel)|pending_deployments/);
  });

  it("イベントの値はシェルへ直接埋め込まず、環境変数で渡す", () => {
    const runBlocks = [...code.matchAll(/run: \|\n([\s\S]*?)(?=\n\s{6}- name:|\n*$)/g)].map((m) => m[1]).join("\n");
    expect(runBlocks).not.toMatch(/\$\{\{/);
  });
});
