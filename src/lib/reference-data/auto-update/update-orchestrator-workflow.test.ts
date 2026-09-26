import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/** 承認1回化の自動進行workflowの静的監査(実行はしない)。 */

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const WF = readFileSync(path.join(ROOT, ".github", "workflows", "reference-data-update-orchestrator.yml"), "utf8");
const code = WF.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
const ENTRY = readFileSync(path.join(ROOT, "scripts", "run-update-orchestrator-entry.mjs"), "utf8");
const TSCONFIG = readFileSync(path.join(ROOT, "tsconfig.update-orchestrator.json"), "utf8");
const CLI = readFileSync(path.join(__dirname, "update-orchestrator-cli.ts"), "utf8");

describe("reference-data-update-orchestrator.yml", () => {
  it("起動は検出workflowの完了と確認入力付きの手動だけ(schedule・push・pull_request なし)", () => {
    expect(code).toMatch(/^on:\s*\n\s+workflow_run:\s*\n\s+workflows: \["Reference data update detection \(weekly \+ manual; detection only\)"\]\s*\n\s+types: \[completed\]\s*\n\s+workflow_dispatch:/m);
    expect(code).not.toMatch(/^\s*(schedule|push|pull_request|pull_request_target|repository_dispatch|workflow_call)\s*:/m);
    const detection = readFileSync(path.join(ROOT, ".github", "workflows", "reference-data-update-detection.yml"), "utf8");
    expect(detection).toMatch(/^name: Reference data update detection \(weekly \+ manual; detection only\)$/m);
  });

  it("変数 'true'・main・検出成功(または確認入力 'orchestrate')でなければjobを実行しない", () => {
    expect(code).toContain("vars.REFERENCE_DATA_AUTO_UPDATE_PIPELINE_ENABLED == 'true'");
    expect(code).toContain("github.ref == 'refs/heads/main'");
    expect(code).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(code).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(code).toContain("inputs.confirm == 'orchestrate'");
  });

  it("Secret・Environmentを一切使わず、GITHUB_TOKENの actions: write と contents: read だけ", () => {
    expect(code).not.toMatch(/secrets\./);
    expect(code).not.toMatch(/^\s*environment\s*:/m);
    expect(code).toMatch(/^permissions:\s*\n\s+actions: write\s*\n\s+contents: read\s*\n\s*\nconcurrency:/m);
    expect(code.match(/:\s*write\b/g)).toHaveLength(1);
    expect(code).toContain("GH_TOKEN: ${{ github.token }}");
  });

  it("本番書き込み用のconcurrency groupを使わない(Apply runの承認待ちと干渉しない)", () => {
    expect(code).not.toContain("reference-data-production-write");
    expect(code).toMatch(/group: reference-data-update-orchestrator/);
  });

  it("入力値はshellへ直接展開せずenv経由で渡し、smoke testの後に実行する", () => {
    const runBlocks = [...code.matchAll(/run: \|\n([\s\S]*?)(?=\n\s+- name:|$)/g)].map((m) => m[1]);
    for (const b of runBlocks) expect(b).not.toMatch(/\$\{\{/);
    expect(code.indexOf("Runtime smoke test")).toBeLessThan(code.indexOf("node scripts/run-update-orchestrator-entry.mjs\n"));
    expect(code).toContain("name: reference-data-update-approval");
  });

  it("entry・tsconfigが対応している", () => {
    expect(TSCONFIG).toContain('"outDir": "./dist-update-orchestrator"');
    expect(TSCONFIG).toContain("update-orchestrator-cli.ts");
    expect(ENTRY.indexOf("writeFileSync(")).toBeLessThan(ENTRY.indexOf("await import("));
    expect(ENTRY).toContain("dist-update-orchestrator/reference-data/auto-update/update-orchestrator-cli.js");
  });
});

describe("update-orchestrator-cli.ts(承認・Level 3・再試行をしない)", () => {
  it("Environment承認・reviewの承認APIやrerunを呼ばない", () => {
    expect(CLI).not.toMatch(/pending_deployments|\/approve|"rerun"|\/rerun|--force/);
    expect(CLI).not.toMatch(/process\.env\.(REFERENCE_DATA_[A-Z_]*(URL|CERT|KEY|SECRET|RECIPIENT|BUCKET|ENDPOINT))/);
  });

  it("起動するのは既存の Plan・Backup(automation の pre-apply)・Dry run・Apply run だけ", () => {
    expect(CLI).toContain('APPLY_WORKFLOW = "reference-data-production-apply.yml"');
    expect(CLI).toContain('BACKUP_WORKFLOW = "reference-data-production-backup.yml"');
    expect(CLI).toContain('{ confirm: "backup", backup_category: "pre-apply", execution: "automation" }');
    const modes = [...CLI.matchAll(/mode: "([a-z-]+)"/g)].map((m) => m[1]);
    expect(new Set(modes)).toEqual(new Set(["plan", "dry-run", "apply"]));
  });
});
