import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  auditBackupApprovalWorkflow,
  assertWorkflowDispatchOnly,
  assertReadOnlyPermissions,
  assertEnvironmentApprovalConfigured,
  assertRequiredSecretsMatch,
  assertSecretCheckRunsFirst,
  assertNoSecretValuePrinted,
  assertNoApprovalBypassFlag,
} from "./backup-workflow-audit";

const REPO_ROOT = resolve(__dirname, "../../../..");
const WORKFLOW_YAML = readFileSync(resolve(REPO_ROOT, ".github/workflows/reference-data-production-backup.yml"), "utf8");

describe("reference-data-production-backup.yml(実ファイル)", () => {
  it("静的監査に合格する(issues: []であること)", () => {
    const checks = auditBackupApprovalWorkflow(WORKFLOW_YAML);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("schedule/pull_request/pushトリガーを一切含まない", () => {
    expect(WORKFLOW_YAML).not.toMatch(/^\s*schedule\s*:/m);
    expect(WORKFLOW_YAML).not.toMatch(/^\s*pull_request\s*:/m);
    expect(WORKFLOW_YAML).not.toMatch(/^\s*push\s*:/m);
  });

  it("手動実行はGitHub Environment承認を要求する。自動実行(orchestratorのpre-applyだけ)は承認者なしのautomation Environment", () => {
    // 2026-09-27 本人指示(承認1回化): manual = production-backup-approval(承認必須)、automation = reference-data-automation。
    expect(WORKFLOW_YAML).toContain("environment: ${{ inputs.execution == 'automation' && 'reference-data-automation' || 'production-backup-approval' }}");
    expect(WORKFLOW_YAML).toMatch(/execution:\s*\n\s+description:[^\n]*\n\s+required: false\s*\n\s+type: choice\s*\n\s+options:\s*\n\s+- manual\s*\n\s+- automation\s*\n\s+default: manual/);
    // automationは、orchestrator(github-actions[bot])・pre-apply・mainの場合以外はSecretを読む前に停止する。
    const guard = WORKFLOW_YAML.slice(WORKFLOW_YAML.indexOf("Reject automation unless"), WORKFLOW_YAML.indexOf("Reject unless execution is exactly"));
    expect(guard).toContain("inputs.execution == 'automation' && (github.actor != 'github-actions[bot]' || inputs.backup_category != 'pre-apply' || github.ref != 'refs/heads/main')");
    expect(guard).toContain("exit 1");
    expect(WORKFLOW_YAML.indexOf("Reject automation unless")).toBeLessThan(WORKFLOW_YAML.indexOf("${{ secrets."));
  });

  it("Secretが無い現状では、secretチェックステップで必ず失敗する設計になっている", () => {
    expect(WORKFLOW_YAML).toMatch(/required secret not configured/);
    expect(WORKFLOW_YAML).toMatch(/exit 1/);
  });

  it("承認をCLIのyesフラグ等で代替していない", () => {
    expect(WORKFLOW_YAML).not.toMatch(/--yes\b/);
  });

  it("backup_category choice inputはpre-apply/daily/weekly/monthlyの4値だけを許可し、既定値はpre-apply(2026-09-21追加)", () => {
    const m = WORKFLOW_YAML.match(/backup_category:[\s\S]*?options:\s*\n((?:\s*-\s*\S+\n)+)\s*default:\s*(\S+)/);
    expect(m, "backup_category inputのoptions/defaultが見つからない").not.toBeNull();
    const options = m![1]
      .trim()
      .split("\n")
      .map((l) => l.replace(/^\s*-\s*/, "").trim());
    expect(options.sort()).toEqual(["daily", "monthly", "pre-apply", "weekly"].sort());
    expect(m![2]).toBe("pre-apply");
  });

  it("backup_category inputはtype: choiceかつrequired: trueである", () => {
    const m = WORKFLOW_YAML.match(/backup_category:[\s\S]*?(?=\n {6}\S|\npermissions:)/);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/type:\s*choice/);
    expect(m![0]).toMatch(/required:\s*true/);
  });

  it("REFERENCE_DATA_BACKUP_PREFIXという自由指定は廃止されている(category経由でしか渡せない)", () => {
    expect(WORKFLOW_YAML).not.toMatch(/REFERENCE_DATA_BACKUP_PREFIX/);
    expect(WORKFLOW_YAML).toMatch(/REFERENCE_DATA_BACKUP_CATEGORY:\s*\$\{\{\s*inputs\.backup_category\s*\}\}/);
  });

  it("confirmation文字列(backup)は変更されていない", () => {
    expect(WORKFLOW_YAML).toMatch(/inputs\.confirm\s*!=\s*'backup'/);
  });
});

describe("静的監査関数の検出力(合成の悪いYAML)", () => {
  it("scheduleトリガーを検出する", () => {
    const bad = "on:\n  workflow_dispatch:\n  schedule:\n    - cron: '0 0 * * *'\n";
    expect(assertWorkflowDispatchOnly(bad).ok).toBe(false);
  });

  it("pull_requestトリガーを検出する", () => {
    const bad = "on:\n  workflow_dispatch:\n  pull_request:\n";
    expect(assertWorkflowDispatchOnly(bad).ok).toBe(false);
  });

  it("pushトリガーを検出する", () => {
    const bad = "on:\n  workflow_dispatch:\n  push:\n    branches: [main]\n";
    expect(assertWorkflowDispatchOnly(bad).ok).toBe(false);
  });

  it("workflow_dispatchが無ければ不合格", () => {
    expect(assertWorkflowDispatchOnly("on:\n  push:\n").ok).toBe(false);
  });

  it("write権限を含むpermissionsを検出する", () => {
    const bad = "permissions:\n  contents: read\n  issues: write\n";
    expect(assertReadOnlyPermissions(bad).ok).toBe(false);
  });

  it("permissionsブロックが無ければ不合格", () => {
    expect(assertReadOnlyPermissions("jobs:\n  x:\n    runs-on: ubuntu-latest\n").ok).toBe(false);
  });

  it("environmentが指定されていなければ不合格", () => {
    expect(assertEnvironmentApprovalConfigured("jobs:\n  x:\n    runs-on: ubuntu-latest\n").ok).toBe(false);
  });

  it("想定外のSecretを参照していれば不合格", () => {
    const bad = "env:\n  X: ${{ secrets.REFERENCE_DATA_BACKUP_DB_URL }}\n  Y: ${{ secrets.SOME_OTHER_SECRET }}\n";
    expect(assertRequiredSecretsMatch(bad).ok).toBe(false);
  });

  it("6件のうち1件でも不足していれば不合格(R2固有4項目 + DB_URL + AGE_RECIPIENT)", () => {
    const bad = [
      "env:",
      "  A: ${{ secrets.REFERENCE_DATA_BACKUP_DB_URL }}",
      "  B: ${{ secrets.REFERENCE_DATA_BACKUP_AGE_RECIPIENT }}",
      "  C: ${{ secrets.REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID }}",
      "  D: ${{ secrets.REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY }}",
      "  E: ${{ secrets.REFERENCE_DATA_BACKUP_R2_ENDPOINT }}",
    ].join("\n");
    expect(assertRequiredSecretsMatch(bad).ok).toBe(false);
  });

  it("secretの生値を直接echoしていれば不合格", () => {
    const bad = "run: |\n  echo ${{ secrets.REFERENCE_DATA_BACKUP_DB_URL }}\n";
    expect(assertNoSecretValuePrinted(bad).ok).toBe(false);
  });

  it("secret由来の環境変数の値をechoしていれば不合格", () => {
    const bad = 'run: |\n  echo "$REFERENCE_DATA_BACKUP_DB_URL"\n';
    expect(assertNoSecretValuePrinted(bad).ok).toBe(false);
  });

  it("secretチェックより前に他のステップ(confirm確認以外)があれば不合格", () => {
    const bad = [
      "steps:",
      "  - name: Do something else first",
      "    run: echo hi",
      "  - name: Check required secret not configured",
      "    run: exit 1",
    ].join("\n");
    expect(assertSecretCheckRunsFirst(bad).ok).toBe(false);
  });

  it("承認バイパスフラグ(--yes等)を検出する", () => {
    expect(assertNoApprovalBypassFlag("run: some-cli --yes\n").ok).toBe(false);
    expect(assertNoApprovalBypassFlag("run: some-cli --skip-approval\n").ok).toBe(false);
  });

  it("apt-get install -yのような、承認バイパスとは無関係な単独の-yは誤検出しない(2026-09-21修正)", () => {
    expect(assertNoApprovalBypassFlag("run: sudo apt-get install -y --no-install-recommends age\n").ok).toBe(true);
  });
});
