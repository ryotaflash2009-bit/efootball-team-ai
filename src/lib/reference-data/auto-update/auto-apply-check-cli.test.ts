import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runAutoApplyCheck, checkKillSwitches } from "./auto-apply-check-cli";
import { planSummary, backupSummary, dryRunSummary, SHA } from "./__fixtures__/orchestrator-fixtures";

/** 自動の Apply job の中の再確認（kill switch と artifact からの判定）。 */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
let dir = "";

beforeEach(() => {
  dir = path.join(ROOT, "data", "test-tmp", `auto-apply-check-${process.pid}-${Date.now()}`);
  for (const d of ["autocheck/plan", "autocheck/dry-run", "backup"]) mkdirSync(path.join(dir, d), { recursive: true });
  writeFileSync(path.join(dir, "autocheck", "plan", "reference-data-apply-summary.json"), planSummary());
  writeFileSync(path.join(dir, "autocheck", "dry-run", "reference-data-apply-summary.json"), dryRunSummary());
  writeFileSync(path.join(dir, "backup", "reference-data-backup-summary.json"), backupSummary());
  writeFileSync(path.join(dir, "facts-backup.json"), JSON.stringify({ conclusion: "success", updatedAt: "2026-09-26T14:28:00.000Z" }));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const env = (over: Record<string, string | undefined> = {}) => ({
  REFERENCE_DATA_APPLY_ROUTE: "automatic", REFERENCE_DATA_APPLY_MODE: "apply", REFERENCE_DATA_APPLY_DATASET: "world",
  AUTO_APPLY_ENABLED: "true", AUTO_APPLY_WORLD_ENABLED: "true", AUTO_APPLY_MANAGERS_ENABLED: "true",
  STAGE4_WORK_DIR: dir, GITHUB_SHA: SHA, CURRENT_MAIN_SHA: SHA, STAGE4_BACKUP_RUN_ID: "36248197028", STAGE4_DRY_RUN_RUN_ID: "36248400000",
  GITHUB_WORKSPACE: path.join(dir, "no-repo"),
  ...over,
});
const NOW = new Date("2026-09-26T15:00:00.000Z");

describe("自動の Apply job の再確認", () => {
  it("kill switch がすべて true で、artifact が契約内なら ELIGIBLE（書き込みの step へ進める）", () => {
    const r = runAutoApplyCheck(env(), NOW);
    expect(r.result.decision).toBe("AUTO_APPLY_ELIGIBLE");
    expect(r.ok).toBe(true);
  });

  it("kill switch のどれかが true でなければ、artifact を読む前に止める（次の run から書き込みを止められる）", () => {
    for (const k of ["AUTO_APPLY_ENABLED", "AUTO_APPLY_WORLD_ENABLED"]) {
      for (const v of [undefined, "false", "True", "1"]) {
        const r = runAutoApplyCheck(env({ [k]: v }), NOW);
        expect(r.ok).toBe(false);
        expect(r.result.decision).toBe("AUTO_APPLY_BLOCKED");
      }
    }
    expect(checkKillSwitches({ AUTO_APPLY_ENABLED: "true", AUTO_APPLY_MANAGERS_ENABLED: "false" }, "managers")).toEqual(["kill_switch_off:REFERENCE_DATA_AUTO_APPLY_MANAGERS_ENABLED"]);
    expect(checkKillSwitches({ AUTO_APPLY_ENABLED: "true", AUTO_APPLY_MANAGERS_ENABLED: "false" }, "world")).toEqual(["kill_switch_off:REFERENCE_DATA_AUTO_APPLY_WORLD_ENABLED"]);
  });

  it("manual の経路・apply 以外・main の SHA の不一致・Backup の期限切れ・artifact の欠落は止める", () => {
    expect(runAutoApplyCheck(env({ REFERENCE_DATA_APPLY_ROUTE: "manual" }), NOW).result.decision).toBe("INVALID_INPUT");
    expect(runAutoApplyCheck(env({ REFERENCE_DATA_APPLY_MODE: "dry-run" }), NOW).result.decision).toBe("INVALID_INPUT");
    const moved = runAutoApplyCheck(env({ CURRENT_MAIN_SHA: "1".repeat(40) }), NOW);
    expect(moved.ok).toBe(false);
    expect(moved.result.reasonCodes).toContain("main_sha_changed");
    const expired = runAutoApplyCheck(env(), new Date("2026-09-27T15:00:00.000Z"));
    expect(expired.result.reasonCodes).toContain("backup_expired");
    rmSync(path.join(dir, "autocheck", "dry-run", "reference-data-apply-summary.json"));
    expect(runAutoApplyCheck(env(), NOW).result).toMatchObject({ decision: "AUTO_APPLY_BLOCKED", reasonCodes: ["input_missing:reference-data-apply-summary.json"] });
  });

  it("Backup の run が成功していなければ止める", () => {
    writeFileSync(path.join(dir, "facts-backup.json"), JSON.stringify({ conclusion: "failure", updatedAt: "2026-09-26T14:28:00.000Z" }));
    expect(runAutoApplyCheck(env(), NOW).result).toMatchObject({ decision: "AUTO_APPLY_BLOCKED", reasonCodes: ["backup_run_not_successful"] });
  });
});
