import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildApplyEvidence, classifyOutcome } from "../../../../scripts/lib/reference-data-evidence.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const APPLY = readFileSync(path.join(ROOT, ".github", "workflows", "reference-data-production-apply.yml"), "utf8");
const BACKUP = readFileSync(path.join(ROOT, ".github", "workflows", "reference-data-production-backup.yml"), "utf8");
const strip = (s: string) => s.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

const H = "a".repeat(64);
const ENV = {
  EVIDENCE_MODE: "apply",
  EVIDENCE_DATASET: "world",
  GITHUB_REPOSITORY: "owner/repo",
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_SHA: "b".repeat(40),
  GITHUB_REF: "refs/heads/main",
  GITHUB_ACTOR: "github-actions[bot]",
  STAGE4_APPROVED_BY: "owner-login",
};
const verified = { ok: true, phase: "apply", reasons: [], facts: { status: "applied_verified" }, checkedAt: "2026-10-02T00:00:00Z" };
const applyResult = { status: "applied_verified", applyRunId: "123", expectation: { before: { counts: { world_player_cards: 13297, managers: 67 } }, insertedIdentities: ["x", "y"] } };
const bundle = { sourceChecksum: "60fdd79fb61f" + "c".repeat(52) };
const build = (over: Record<string, unknown> = {}) =>
  buildApplyEvidence({ env: ENV, summary: verified, inputs: [{ path: "plan/stage4-world-bundle.json", sha256: H }], outputs: [], applyResult, bundle, now: "2026-10-02T01:00:00Z", ...over });

describe("apply の機械可読 Evidence", () => {
  it("run・attempt・commit・ref・actor・承認者・mode・dataset・入力 hash を記録する", () => {
    const { evidence } = build();
    expect(evidence).toMatchObject({
      schema: "reference-data-apply-evidence/v1",
      runId: "123",
      runAttempt: "1",
      commitSha: "b".repeat(40),
      ref: "refs/heads/main",
      actor: "github-actions[bot]",
      approvedBy: "owner-login",
      mode: "apply",
      dataset: "world",
      outcome: "applied_verified",
      productionWritten: true,
      automaticUndo: false,
    });
    expect(evidence.inputs).toEqual([{ path: "plan/stage4-world-bundle.json", sha256: H }]);
  });

  it("applied_verified でこの run の結果のときだけ applied-state 候補を作る", () => {
    expect(build().candidate).toMatchObject({ dataset: "world_player_cards", entry: { sourceChecksum12: "60fdd79fb61f", recordCount: 13299, applyRunId: "123" } });
    expect(build({ applyResult: { ...applyResult, applyRunId: "999" } }).candidate).toBeNull();
    expect(build({ summary: { ...verified, facts: { status: "rollback_required" } } }).candidate).toBeNull();
    expect(build({ bundle: { sourceChecksum: "short" } }).candidate).toBeNull();
    expect(buildApplyEvidence({ env: { ...ENV, EVIDENCE_MODE: "dry-run" }, summary: { ...verified, facts: {} }, inputs: [], outputs: [], applyResult, bundle, now: "t" }).candidate).toBeNull();
  });

  it("一部失敗・summary 無しを成功にしない", () => {
    expect(classifyOutcome("apply", undefined)).toBe("no_summary");
    expect(classifyOutcome("apply", { ok: false, facts: { status: "rollback_required" } })).toBe("rollback_required");
    expect(classifyOutcome("apply", { ok: true, facts: {} })).toBe("unexpected_apply_status");
    expect(classifyOutcome("plan", { ok: false })).toBe("failed");
    expect(classifyOutcome("plan", { ok: true })).toBe("ok");
    expect(build({ summary: { ok: false, reasons: ["rollback_required"], facts: { status: "rollback_required" } } }).evidence.productionWritten).toBe(true);
    expect(build({ summary: { ok: false, reasons: ["backup_gate"] } }).evidence.productionWritten).toBe(false);
  });

  it("許可した形以外の値・URL・改行・パスの細工を出さない", () => {
    const { evidence } = buildApplyEvidence({
      env: { ...ENV, GITHUB_ACTOR: "x; curl evil", STAGE4_APPROVED_BY: "a\nb", GITHUB_REF: "refs/heads/../../x y" },
      summary: { ok: false, reasons: ["https://evil.example/x", "line\nbreak", "backup_gate"], facts: {} },
      inputs: [{ path: "../secret", sha256: H }, { path: "plan/ok.json", sha256: "nothex" }],
      outputs: [],
      now: "t",
    });
    expect(evidence.actor).toBeNull();
    expect(evidence.approvedBy).toBeNull();
    expect(evidence.ref).toBeNull();
    expect(evidence.summary?.reasons).toEqual(["backup_gate"]);
    expect(evidence.inputs).toEqual([]);
  });
});

describe("Production apply・Backup workflow の main 限定と承認者の記録", () => {
  it("どちらの job も main 以外から起動されたら Environment に入る前に skip する", () => {
    expect(strip(APPLY)).toMatch(/^ {2}production:\n {4}if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}\n {4}runs-on:/m);
    expect(strip(BACKUP)).toMatch(/^ {2}backup:\n {4}if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}\n {4}runs-on:/m);
  });

  it("apply は Environment の承認記録から承認者を取り、無ければ DB 接続前に止まる", () => {
    const code = strip(APPLY);
    const i = code.indexOf("Record the Environment approver");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(code.indexOf("- name: Run the selected mode"));
    const step = code.slice(i, code.indexOf("- name: Run the selected mode"));
    expect(step).toContain("if: ${{ inputs.mode == 'apply' && !startsWith(inputs.confirm, 'auto-apply-') }}");
    expect(step).toContain('actions/runs/$RUN_ID/approvals');
    expect(step).toContain('.name == "reference-data-production-apply"');
    expect(step).toContain("exit 1");
    expect(step).toContain('echo "STAGE4_APPROVED_BY=$approver" >> "$GITHUB_ENV"');
    expect(step).not.toMatch(/secrets\./);
  });

  it("secret の確認などで Checkout の前に止まっても Evidence を作る（Evidence 用の Checkout だけを行う。2026-10-03）", () => {
    const code = strip(APPLY);
    expect(code).toMatch(/- name: Checkout\n\s+id: checkout\n\s+uses: actions\/checkout@v4/);
    const fallback = code.indexOf("- name: Checkout for the Evidence step (only after an early stop)");
    expect(fallback).toBeGreaterThan(code.indexOf("- name: Run the selected mode"));
    expect(fallback).toBeLessThan(code.indexOf("- name: Build the machine-readable Evidence"));
    const step = code.slice(fallback, code.indexOf("- name: Build the machine-readable Evidence"));
    expect(step).toContain("if: ${{ always() && steps.checkout.outcome != 'success' }}");
    expect(step).not.toMatch(/secrets\.|run:/);
    expect(code).toContain("EVIDENCE_JOB_STATUS: ${{ job.status }}");
  });

  it("CLI の前に止まった run は job=failure・outcome=no_summary・Production へは書いていない", () => {
    const { evidence, candidate } = buildApplyEvidence({ env: { ...ENV, EVIDENCE_MODE: "plan", EVIDENCE_JOB_STATUS: "failure" }, summary: undefined, inputs: [], outputs: [], now: "t" });
    expect(evidence).toMatchObject({ jobStatus: "failure", outcome: "no_summary", productionWritten: false, approvedBy: null });
    expect(candidate).toBeNull();
    expect(buildApplyEvidence({ env: { ...ENV, EVIDENCE_JOB_STATUS: "weird" }, summary: verified, inputs: [], outputs: [], now: "t" }).evidence.jobStatus).toBeNull();
  });

  it("自動の経路は、kill switch と自動 Apply の判定を書き込みの step の前に再確認し、承認記録を求めない（2026-10-03）", () => {
    const code = strip(APPLY);
    const i = code.indexOf("- name: Re-check the kill switches and the auto-apply policy (no secret)");
    expect(i).toBeGreaterThan(code.indexOf("- name: Record the bound runs' facts"));
    expect(i).toBeLessThan(code.indexOf("- name: Run the selected mode"));
    const step = code.slice(i, code.indexOf("- name: Record the Environment approver"));
    expect(step).toContain("if: ${{ inputs.mode == 'apply' && startsWith(inputs.confirm, 'auto-apply-') }}");
    for (const v of ["REFERENCE_DATA_AUTO_APPLY_ENABLED", "REFERENCE_DATA_AUTO_APPLY_WORLD_ENABLED", "REFERENCE_DATA_AUTO_APPLY_MANAGERS_ENABLED"]) expect(step).toContain(`vars.${v}`);
    expect(step).toContain("node scripts/run-auto-apply-check-entry.mjs");
    expect(step).not.toMatch(/secrets\./);
    // 自動の経路は orchestrator（github-actions[bot]）だけが起動できる。
    expect(code).toContain('if [ "$MODE" = "apply" ] && [ "$CONFIRM" = "auto-$expected" ]; then');
    expect(code).toContain('if [ "$ACTOR" != "github-actions[bot]" ]; then');
  });

  it("Evidence は always() で作り 90 日保存し、Secret を渡さない", () => {
    const code = strip(APPLY);
    const step = code.slice(code.indexOf("- name: Build the machine-readable Evidence"), code.indexOf("- name: Upload the Evidence"));
    expect(step).toContain("if: always()");
    expect(step).toContain("node scripts/reference-data-evidence.mjs");
    expect(step).not.toMatch(/secrets\./);
    expect(code.slice(code.indexOf("- name: Upload the Evidence"))).toContain("retention-days: 90");
  });
});
