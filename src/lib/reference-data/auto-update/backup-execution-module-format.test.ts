import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 初回workflow run #1が、Backup処理を一切開始する前に
 * "ReferenceError: exports is not defined in ES module scope"で失敗した
 * (repository package.jsonの"type": "module"と、tsconfig.backup-execution.json
 * (module: CommonJS)が生成した.jsの不一致、GitHub Actions実行環境でのみ再現し、
 * このセッションの当時のローカル検証では再現できなかった)。
 *
 * このファイルは、修正(scripts/run-production-backup-entry.mjsが
 * dist-backup-execution/package.jsonを都度書き出す)がソースコード上に
 * 存在すること、および両方のworkflow(ci.yml・reference-data-production-backup.yml)に
 * 実行時smoke testが追加されていることを、静的に(実際のtsc/node実行は行わずに)
 * 確認する。実際にcompile→node実行までを行うsmoke test自体は、このリポジトリの
 * 通常のvitest実行を遅くしない・環境非依存にするため、ci.yml/workflow YAML内の
 * shellステップとして実装している(このセッションで実際に手動実行し、
 * 修正前のコードに戻すと確実に検出することも確認済み)。
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const ENTRY_SCRIPT = readFileSync(resolve(REPO_ROOT, "scripts/run-production-backup-entry.mjs"), "utf8");
const CI_YAML = readFileSync(resolve(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
const BACKUP_WORKFLOW_YAML = readFileSync(resolve(REPO_ROOT, ".github/workflows/reference-data-production-backup.yml"), "utf8");
const TSCONFIG_BACKUP_EXECUTION = readFileSync(resolve(REPO_ROOT, "tsconfig.backup-execution.json"), "utf8");

describe("scripts/run-production-backup-entry.mjs(module-system不一致の修正)", () => {
  it("dist-backup-execution/package.jsonを、importを試みる前に書き出す", () => {
    expect(ENTRY_SCRIPT).toMatch(/writeFileSync/);
    expect(ENTRY_SCRIPT).toMatch(/"type"\s*:\s*"commonjs"/);
    const writeIndex = ENTRY_SCRIPT.indexOf("writeFileSync(markerPath");
    const importIndex = ENTRY_SCRIPT.indexOf("await import(");
    expect(writeIndex).toBeGreaterThan(-1);
    expect(importIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeLessThan(importIndex);
  });

  it("marker(package.json)の出力先ディレクトリ名が、tsconfig.backup-execution.jsonのoutDirと一致する(手動同期に依存しない)", () => {
    const outDirMatch = TSCONFIG_BACKUP_EXECUTION.match(/"outDir"\s*:\s*"\.\/([^"]+)"/);
    expect(outDirMatch).not.toBeNull();
    const outDirName = outDirMatch![1];
    expect(ENTRY_SCRIPT).toContain(outDirName);
  });

  it("動的な文字置換・危険なrenameに依存しない(単純なJSON.stringifyのwriteFileSyncだけ)", () => {
    expect(ENTRY_SCRIPT).not.toMatch(/\.replace\(/);
    expect(ENTRY_SCRIPT).not.toMatch(/\brename(Sync)?\(/);
  });

  it("新規npm packageをimportしていない(node:fs/node:url/node:pathとローカルファイルだけ)", () => {
    const importLines = [...ENTRY_SCRIPT.matchAll(/^import .+ from "([^"]+)";?$/gm)].map((m) => m[1]);
    for (const spec of importLines) {
      expect(spec.startsWith("node:") || spec.startsWith("../") || spec.startsWith("./")).toBe(true);
    }
  });
});

describe("CI(ci.yml)にBackup execution module-format smoke testが追加されている(2026-09-21、回帰防止)", () => {
  it("build-and-testジョブがsmoke testステップを含み、tsc→node実行まで行う", () => {
    expect(CI_YAML).toMatch(/tsconfig\.backup-execution\.json/);
    expect(CI_YAML).toMatch(/run-production-backup-entry\.mjs/);
  });

  it("module-system不一致(exports/require is not defined等)を検出したら失敗させる", () => {
    expect(CI_YAML).toMatch(/is not defined in ES module scope/);
    expect(CI_YAML).toMatch(/require is not defined/);
  });

  it("secretをこのworkflowへ一切渡さない既存方針と矛盾しない(secrets\\.を参照していない)", () => {
    const smokeStepMatch = CI_YAML.match(/Backup execution module-format smoke test[\s\S]*?(?=\n {6}- name:|\n {2}reference-data-postgres-validation:|$)/);
    expect(smokeStepMatch).not.toBeNull();
    expect(smokeStepMatch![0]).not.toMatch(/secrets\./);
  });
});

describe("Backup workflow(reference-data-production-backup.yml)にも同じsmoke testが追加されている(2重の防御)", () => {
  it("Compileステップの後、Run Production backupステップの前にsmoke testがある", () => {
    const compileIndex = BACKUP_WORKFLOW_YAML.indexOf("Compile the backup execution entrypoint");
    const smokeIndex = BACKUP_WORKFLOW_YAML.indexOf("Runtime smoke test");
    const runIndex = BACKUP_WORKFLOW_YAML.indexOf("Run Production backup (preflight");
    expect(compileIndex).toBeGreaterThan(-1);
    expect(smokeIndex).toBeGreaterThan(-1);
    expect(runIndex).toBeGreaterThan(-1);
    expect(compileIndex).toBeLessThan(smokeIndex);
    expect(smokeIndex).toBeLessThan(runIndex);
  });

  it("smoke testステップは実Secretの代わりに明示的な空文字を使う(secrets.を参照しない)", () => {
    const smokeStepMatch = BACKUP_WORKFLOW_YAML.match(/Runtime smoke test[\s\S]*?(?=\n {6}- name:)/);
    expect(smokeStepMatch).not.toBeNull();
    expect(smokeStepMatch![0]).not.toMatch(/secrets\./);
    expect(smokeStepMatch![0]).toMatch(/REFERENCE_DATA_BACKUP_DB_URL:\s*""/);
  });

  it("既存のconfirm/backup_category/secret-check/Environment/permissionsの各ステップは維持されている", () => {
    expect(BACKUP_WORKFLOW_YAML).toMatch(/inputs\.confirm\s*!=\s*'backup'/);
    expect(BACKUP_WORKFLOW_YAML).toMatch(/type:\s*choice/);
    expect(BACKUP_WORKFLOW_YAML).toMatch(/environment:\s*production-backup-approval/);
    expect(BACKUP_WORKFLOW_YAML).toMatch(/contents:\s*read/);
  });

  it("YAML内の各stepのnameフィールドに、コメント化されてしまう生の#が含まれていない(この修正自体で発生した実バグの回帰テスト)", () => {
    const nameLines = BACKUP_WORKFLOW_YAML.split("\n").filter((l) => /^\s*- name:/.test(l));
    for (const line of nameLines) {
      const value = line.replace(/^\s*- name:\s*/, "");
      const isQuoted = value.startsWith('"') || value.startsWith("'");
      if (value.includes("#")) {
        expect(isQuoted, `unquoted '#' in step name will be parsed as a YAML comment: ${line}`).toBe(true);
      }
    }
  });
});
