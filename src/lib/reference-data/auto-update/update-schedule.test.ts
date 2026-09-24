import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DETECTION_ENABLE_VARIABLE, DETECTION_WORKFLOW_FILE, PROPOSED_DETECTION_CRON, SCHEDULE_POLICY, decideDetectionRun } from "./update-schedule";
import { CONCURRENCY_GROUPS } from "./update-contract";

const WORKFLOWS = path.resolve(__dirname, "..", "..", "..", "..", ".github", "workflows");
const readWf = (f: string) => readFileSync(path.join(WORKFLOWS, f), "utf8");
/** `#`コメントを除いたYAML本文。 */
const code = (yaml: string) => yaml.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "")).join("\n");

describe("定期実行の判定(fail-closed)", () => {
  it("明示の'true'と承認済み実transportの両方が無ければ実行しない", () => {
    expect(decideDetectionRun({ stage: "detection", enableVariable: undefined })).toEqual({ run: false, reason: "not_enabled" });
    for (const v of ["TRUE", "1", "yes", ""]) expect(decideDetectionRun({ stage: "detection", enableVariable: v }).run).toBe(false);
    expect(decideDetectionRun({ stage: "detection", enableVariable: "true" })).toEqual({ run: false, reason: "real_network_not_approved" });
    expect(decideDetectionRun({ stage: "detection", enableVariable: "true", realNetworkApproved: true })).toEqual({ run: true });
  });

  it("Backup・apply・rollback・Restoreは決してscheduleしない", () => {
    for (const stage of SCHEDULE_POLICY.neverScheduledStages) {
      expect(decideDetectionRun({ stage, enableVariable: "true", realNetworkApproved: true })).toEqual({ run: false, reason: "stage_not_schedulable" });
    }
    expect(SCHEDULE_POLICY.scheduleTriggerPresent).toBe(false);
  });
});

describe("検出workflowの静的監査", () => {
  const yaml = readWf(DETECTION_WORKFLOW_FILE);
  const body = code(yaml);

  it("workflow_dispatchだけで、schedule・push・pull_requestトリガーを持たない", () => {
    expect(body).toMatch(/^on:\s*\n\s+workflow_dispatch:\s*$/m);
    expect(body).not.toMatch(/^\s*(schedule|push|pull_request|pull_request_target|workflow_run|repository_dispatch)\s*:/m);
  });

  it("read-only権限・Secretなし・Environmentなし・検出用concurrency group", () => {
    expect(body).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
    expect(body).not.toMatch(/secrets\./);
    expect(body).not.toMatch(/^\s*environment\s*:/m);
    expect(body).toMatch(new RegExp(`group: ${CONCURRENCY_GROUPS.detection}$`, "m"));
  });

  it("変数で明示有効化されない限りjobはskipし、実行するのは検出CLIだけ(Production・Backup・applyのentryを呼ばない)", () => {
    expect(body).toContain(`if: \${{ vars.${DETECTION_ENABLE_VARIABLE} == 'true' }}`);
    expect(body).toContain("npx tsc -p tsconfig.update-detection.json");
    expect(body).toContain("node scripts/run-update-detection-entry.mjs");
    expect(body).not.toMatch(/run-production-apply-entry|run-production-backup-entry|tsconfig\.production-apply|tsconfig\.backup-execution/);
    expect(body).not.toMatch(/\bcurl\b|\bwget\b|gh (workflow|run) /);
    // 変数なしのsmoke testで、upstreamへ1件も送らずに止まることを毎回確認する。
    expect(body).toMatch(/Runtime smoke test[\s\S]*REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED: ""[\s\S]*"not_enabled"[\s\S]*"upstreamRequests": 0/);
    const uploads = [...body.matchAll(/uses: actions\/upload-artifact@v4\s*\n\s+with:\s*\n\s+name: ([^\n]+)/g)].map((m) => m[1].trim());
    expect(uploads).toEqual(["reference-data-detection-summary"]);
  });

  it("scheduleの候補は週1回(本人承認まで追加しない)", () => {
    expect(PROPOSED_DETECTION_CRON).toBe("17 18 * * 0");
    expect(yaml).toContain(`#   - cron: "${PROPOSED_DETECTION_CRON}"`);
  });
});

describe("リポジトリ内の全workflow: scheduleを使わない", () => {
  it("どのworkflowも`schedule:`トリガーを持たない(Backup・apply・rollbackは特に禁止)", () => {
    const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) expect(code(readWf(f)), f).not.toMatch(/^\s*schedule\s*:/m);
  });
});
