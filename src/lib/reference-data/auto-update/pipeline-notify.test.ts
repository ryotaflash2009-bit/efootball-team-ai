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
    // Apply run を作った後に止まった場合（2026-10-05 の DB の認証の失敗）は「作成していません」と書かない
    const afterApply = buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "failure", approval: { kind: "stopped", stage: "apply", reasons: ["auto_apply_not_applied:failed"], runs: { detection: "10", plan: "11", backup: "12", dryRun: "13", apply: "14" } } });
    expect(afterApply.body).toContain("Apply run は作成されましたが、適用は完了していません");
    expect(afterApply.body).not.toContain("Apply run は作成していません");
    expect(afterApply.body).toContain("apply 14");
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

describe("自動 Apply の通知（2026-10-03）", () => {
  const policy = { contractVersion: "auto-apply-policy/2026-10-03.v1", decision: "AUTO_APPLY_ELIGIBLE", reasonCodes: [], expectedWrites: "world_player_cards: insert 75, update 5675 (1 transaction); import_batches: 1 audit row; no DELETE/TRUNCATE", expectedAfterCount: 13372, sourceChecksum: "f7206c1ee9e6" + "0".repeat(52), planChecksum: "3d5a9c596ecb" + "0".repeat(52) };
  const base = { kind: "auto_applied", dataset: "world", applyOutcome: "applied_verified", runs: { plan: "1", backup: "2", dryRun: "3", apply: "4" }, policy, appliedStateCandidate: { entry: { sourceChecksum12: "f7206c1ee9e6", recordCount: 13372 } } };

  it("検証済みは要約だけ（halt なし）", () => {
    const n = buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "success", approval: { ...base, verdict: "AUTO_APPLY_APPLIED_VERIFIED", publicCheck: { expected: 13372, observed: 13372, ok: true } } });
    expect(n).toMatchObject({ notify: true, halt: false });
    if (!n.notify) return;
    expect(n.title).toContain("自動で適用し、検証しました");
    expect(n.body).toContain("AUTO_APPLY_APPLIED_VERIFIED");
    expect(n.body).toContain("公開サイト: 13372（一致）");
    expect(n.body).toContain("applied-state の候補: f7206c1ee9e6・13372 件");
    expect(n.body).toContain("apply 4");
  });

  it("事後検証の失敗は緊急の通知と halt（Rollback・Restore は未実施と明記）", () => {
    const n = buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "failure", approval: { ...base, verdict: "AUTO_APPLY_POST_VERIFY_FAILED", publicCheck: { expected: 13372, observed: 13371, ok: false } } });
    expect(n).toMatchObject({ notify: true, halt: true });
    if (!n.notify) return;
    expect(n.title).toContain("【要対応】");
    expect(n.body).toContain("Rollback・Restore は実行していません");
    expect(n.body).toContain("不一致");
  });

  it("手動の承認待ちには shadow の判定と手動の理由を書く", () => {
    const n = buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "success", approval: { kind: "awaiting_approval", dataset: "world", added: 1, updated: 0, removed: 0, runs: { apply: "9" }, autoApplyPolicy: { decision: "MANUAL_APPLY_REQUIRED", reasonCodes: ["unknown_changed_field"] }, route: { automatic: false, why: ["policy_manual_apply_required"] } } });
    if (!n.notify) throw new Error("expected notify");
    expect(n.body).toContain("自動 Apply の判定（shadow）: MANUAL_APPLY_REQUIRED（unknown_changed_field）");
    expect(n.body).toContain("policy_manual_apply_required");
  });

  it("通知の値は許可した形だけ（URL・山かっこを出さない）", () => {
    const n = buildPipelineNotification({ ...RUN, source: "orchestrator", conclusion: "success", approval: { ...base, verdict: "AUTO_APPLY_APPLIED_VERIFIED", dataset: "<x>", policy: { ...policy, expectedWrites: "https://evil.example/<x>" }, publicCheck: { ok: true, observed: 1 } } });
    if (!n.notify) throw new Error("expected notify");
    expect(n.body).not.toContain("evil.example");
    expect(n.body).not.toContain("<");
  });

  it("halt の label は自動 Apply の設定と同じ", async () => {
    const { HALT_LABEL } = await import("../../../../scripts/lib/reference-data-notify.mjs");
    const { AUTO_APPLY_POLICY } = await import("./auto-apply-policy-config");
    expect(HALT_LABEL).toBe(AUTO_APPLY_POLICY.haltIssueLabel);
  });
});
