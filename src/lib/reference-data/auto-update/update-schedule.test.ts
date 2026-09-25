import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DETECTION_CRON, DETECTION_ENABLE_VARIABLE, DETECTION_WORKFLOW_FILE, SCHEDULE_POLICY, decideDetectionRun, decideDetectionTrigger } from "./update-schedule";
import { CONCURRENCY_GROUPS } from "./update-contract";

const WORKFLOWS = path.resolve(__dirname, "..", "..", "..", "..", ".github", "workflows");
const readWf = (f: string) => readFileSync(path.join(WORKFLOWS, f), "utf8");
/** `#`コメントを除いたYAML本文。 */
const code = (yaml: string) => yaml.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "")).join("\n");

/** cron(分 時 * * 曜日、UTC)をJSTの曜日(0=日)・時刻へ変換する。 */
function cronToJst(cron: string): { weekday: number; hour: number; minute: number } {
  const [min, hour, dom, mon, dow] = cron.split(" ");
  expect([dom, mon]).toEqual(["*", "*"]);
  const utcMinutes = Number(dow) * 24 * 60 + Number(hour) * 60 + Number(min);
  const jst = (utcMinutes + 9 * 60) % (7 * 24 * 60);
  return { weekday: Math.floor(jst / (24 * 60)), hour: Math.floor((jst % (24 * 60)) / 60), minute: jst % 60 };
}

describe("定期実行の判定(fail-closed)", () => {
  it("明示の'true'と承認済み実transportの両方が無ければ実行しない", () => {
    expect(decideDetectionRun({ stage: "detection", enableVariable: undefined })).toEqual({ run: false, reason: "not_enabled" });
    for (const v of ["TRUE", "True", "false", "1", "yes", "", " true"]) expect(decideDetectionRun({ stage: "detection", enableVariable: v, realNetworkApproved: true }).run).toBe(false);
    expect(decideDetectionRun({ stage: "detection", enableVariable: "true" })).toEqual({ run: false, reason: "real_network_not_approved" });
    expect(decideDetectionRun({ stage: "detection", enableVariable: "true", realNetworkApproved: true })).toEqual({ run: true });
  });

  it("Backup・apply・rollback・Restoreは決してscheduleしない", () => {
    for (const stage of SCHEDULE_POLICY.neverScheduledStages) {
      expect(decideDetectionRun({ stage, enableVariable: "true", realNetworkApproved: true })).toEqual({ run: false, reason: "stage_not_schedulable" });
    }
    expect(SCHEDULE_POLICY.schedulableStages).toEqual(["detection"]);
    expect(SCHEDULE_POLICY.scheduleTriggerPresent).toBe(true);
  });

  it("起動元: scheduleは確認入力なしで可、手動は確認入力'detect'が必須、その他のeventは不可", () => {
    expect(decideDetectionTrigger({ eventName: "schedule", confirm: undefined })).toEqual({ run: true });
    expect(decideDetectionTrigger({ eventName: "schedule", confirm: "" })).toEqual({ run: true });
    expect(decideDetectionTrigger({ eventName: "workflow_dispatch", confirm: "detect" })).toEqual({ run: true });
    for (const c of [undefined, "", "Detect", "DETECT", "detect ", "yes"]) {
      expect(decideDetectionTrigger({ eventName: "workflow_dispatch", confirm: c })).toEqual({ run: false, reason: "confirmation_missing" });
    }
    for (const e of [undefined, "", "push", "pull_request", "pull_request_target", "workflow_run", "repository_dispatch"]) {
      expect(decideDetectionTrigger({ eventName: e, confirm: "detect" })).toEqual({ run: false, reason: "trigger_not_allowed" });
    }
  });
});

describe("検出workflowの静的監査", () => {
  const yaml = readWf(DETECTION_WORKFLOW_FILE);
  const body = code(yaml);

  it("トリガーは週1回のscheduleと確認入力付きworkflow_dispatchだけ(push・pull_request等を持たない)", () => {
    expect(body).toMatch(/^on:\s*\n\s+schedule:\s*\n\s+- cron: "17 18 \* \* 0"\s*\n\s+workflow_dispatch:\s*\n\s+inputs:/m);
    expect(body.match(/- cron:/g)).toHaveLength(1);
    expect(body).not.toMatch(/^\s*(push|pull_request|pull_request_target|workflow_run|repository_dispatch|workflow_call)\s*:/m);
  });

  it("cronは月曜03:17 JST(GitHubのcronはUTC)", () => {
    expect(DETECTION_CRON).toBe("17 18 * * 0");
    expect(cronToJst(DETECTION_CRON)).toEqual({ weekday: 1, hour: 3, minute: 17 });
    expect(body).toContain(`- cron: "${DETECTION_CRON}"`);
  });

  it("read-only権限・Secretなし・Environmentなし・検出用concurrency group", () => {
    expect(body).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
    expect(body.match(/^permissions:/gm)).toHaveLength(1);
    expect(body).not.toMatch(/:\s*write\b/);
    expect(body).not.toMatch(/secrets\./);
    expect(body).not.toMatch(/^\s*environment\s*:/m);
    expect(body).toMatch(new RegExp(`group: ${CONCURRENCY_GROUPS.detection}$`, "m"));
  });

  it("重なる実行を防ぐ(同じconcurrency group・実行中のrunは取り消さず次を待たせる)・timeoutあり", () => {
    expect(body).toMatch(/^concurrency:\s*\n\s+group: reference-data-update-detection\s*\n\s+cancel-in-progress: false\s*$/m);
    const t = /timeout-minutes: (\d+)/.exec(body);
    expect(Number(t?.[1])).toBeGreaterThan(0);
    expect(Number(t?.[1])).toBeLessThanOrEqual(60);
  });

  it("scheduleとmanualは同じ安全Gateを通る(変数'true'が必須。scheduleは確認入力不要、manualは'detect'必須)。CLIも同じ判定をする", () => {
    const gates = [...body.matchAll(/^\s+if: (.+)$/gm)].map((m) => m[1].trim()).filter((x) => x.includes("vars."));
    expect(gates).toEqual([`\${{ vars.${DETECTION_ENABLE_VARIABLE} == 'true' && (github.event_name == 'schedule' || inputs.confirm == 'detect') }}`]);
    const confirmBlock = body.slice(body.indexOf("      confirm:"), body.indexOf("permissions:"));
    expect(confirmBlock).toContain("'detect'");
    expect(confirmBlock).toContain("required: true");
    expect(body).toContain("REFERENCE_DATA_DETECTION_CONFIRM: ${{ inputs.confirm }}");
  });

  it("実行するのは検出CLIだけ(Production・Backup・applyのentryを呼ばない)、要約artifactだけを残す", () => {
    expect(body).toContain("npx tsc -p tsconfig.update-detection.json");
    expect(body).toContain("node scripts/run-update-detection-entry.mjs");
    expect(body).not.toMatch(/run-production-apply-entry|run-production-backup-entry|tsconfig\.production-apply|tsconfig\.backup-execution/);
    expect(body).not.toMatch(/\bcurl\b|\bwget\b|gh (workflow|run|pr) |git (commit|push)/);
    // 変数なしのsmoke testで、upstreamへ1件も送らずに止まることを毎回確認する。
    expect(body).toMatch(/Runtime smoke test[\s\S]*REFERENCE_DATA_AUTO_UPDATE_DETECTION_ENABLED: ""[\s\S]*"not_enabled"[\s\S]*"upstreamRequests": 0/);
    const uploads = [...body.matchAll(/uses: actions\/upload-artifact@v4\s*\n\s+with:\s*\n\s+name: ([^\n]+)/g)].map((m) => m[1].trim());
    expect(uploads).toEqual(["reference-data-detection-summary"]);
  });

  it("取得はWorld・managers.jsonの2 sourceだけ(検出CLIの上限設定)", () => {
    const cli = readFileSync(path.resolve(__dirname, "update-detection-cli.ts"), "utf8");
    expect(cli).toMatch(/maxRequests: \{ "efootball-world": WORLD_LIMITS\.maxRequests, "managers-json": 1 \}/);
  });
});

describe("リポジトリ内の全workflow: scheduleは検出workflowだけ", () => {
  it("検出workflow以外は`schedule:`トリガーを持たない(Backup・apply・rollbackは特に禁止)", () => {
    const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      if (f === DETECTION_WORKFLOW_FILE) expect(code(readWf(f)).match(/^\s*schedule\s*:/gm), f).toHaveLength(1);
      else expect(code(readWf(f)), f).not.toMatch(/^\s*schedule\s*:/m);
    }
  });
});
