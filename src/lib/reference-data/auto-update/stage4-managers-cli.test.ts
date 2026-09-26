import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { STAGE4_CONFIRM, buildManagersCandidate, buildSourceBundle } from "./stage4-managers";
import { runStage4Mode } from "./stage4-managers-cli";
import { serializeStateSnapshot } from "./stage4-state-snapshot";
import { COMMIT_SHA, backupSummaryText, managersResponse, minutesAgo, runFacts, state } from "./__fixtures__/stage4-fixtures";

/**
 * CLIの入力配線(workflowが用意するファイル・環境変数)を、接続前の検査まで確かめる。
 * DBの接続先は到達不能なport(127.0.0.1:1)で、すべての検査を通った場合だけ connect_failed になる。
 */

const DB = { host: "127.0.0.1", port: 1, user: "u", password: "never-printed-password", database: "d", connectionTimeoutMillis: 2000 };
const FETCHED = "2026-09-24T09:00:00.000Z";
let dir: string;
let checksums: { source: string; plan: string };
let stateText: string;

function put(rel: string, data: unknown): void {
  const p = path.join(dir, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data));
}

beforeEach(async () => {
  // 作業フォルダ配下(git管理外の./data)だけを使う。
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  dir = mkdtempSync(path.join(process.cwd(), "data", "stage4-cli-test-"));
  mkdirSync(path.join(dir, "out"));
  const now = new Date();
  const s = state();
  const b = await buildManagersCandidate(managersResponse(), FETCHED, s.managers, now.toISOString());
  checksums = { source: b.candidate.sourceChecksum, plan: b.plan.planChecksum };
  // PlanがProduction状態をスナップショットとして残し、そのsha256をbundleに記録する(Dry runはProductionへ接続しない)。
  const snap = serializeStateSnapshot("managers", FETCHED, s);
  stateText = snap.text;
  put("plan/stage4-managers-state.json", snap.text);
  put("plan/stage4-managers-bundle.json", buildSourceBundle(managersResponse(), FETCHED, b, s.counts, snap.sha256));
  put("backup/reference-data-backup-summary.json", backupSummaryText("900", { world_player_cards: 1, managers: 4, player_card_analysis: 1, import_batches: 1 }));
  put("facts-plan.json", runFacts("plan", 101, { created: minutesAgo(now, 180), updated: minutesAgo(now, 170) }));
  put("facts-backup.json", runFacts("backup", 900, { created: minutesAgo(now, 90), updated: minutesAgo(now, 60) }));
  put("facts-dry-run.json", runFacts("dry-run", 202, { created: minutesAgo(now, 50), updated: minutesAgo(now, 35) }));
  put("facts-apply.json", runFacts("apply", 303, { created: minutesAgo(now, 20), updated: minutesAgo(now, 10) }, { conclusion: "failure" }));
  put("plan-runs.json", [{ id: 101, displayTitle: "reference-data plan", createdAt: minutesAgo(now, 180), conclusion: "success" }]);
  put("dry-run/stage4-managers-dry-run.json", {
    schema: "stage4-managers-dry-run/v1", verified: true, dryRunRunId: "202", planRunId: "101", backupRunId: "900",
    sourceChecksum: checksums.source, planChecksum: checksums.plan, beforeChecksum: b.plan.report.beforeChecksum, startedAt: minutesAgo(now, 45), completedAt: minutesAgo(now, 40),
  });
  put("apply/stage4-managers-apply-result.json", { schema: "stage4-managers-apply-result/v1", status: "applied_verified", applyRunId: "303", expectation: { schema: "x", batchId: "b", planChecksum: checksums.plan, afterChecksum: checksums.plan, insertedIdentities: [], before: { counts: s.counts, worldMaxUpdatedAt: null } } });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const env = (mode: keyof typeof STAGE4_CONFIRM, extra: Record<string, string> = {}) => ({
  REFERENCE_DATA_APPLY_CONFIRM: STAGE4_CONFIRM[mode],
  STAGE4_WORK_DIR: dir,
  GITHUB_SHA: COMMIT_SHA,
  STAGE4_PLAN_RUN_ID: "101",
  STAGE4_BACKUP_RUN_ID: "900",
  STAGE4_DRY_RUN_RUN_ID: "202",
  STAGE4_APPLY_RUN_ID: "303",
  STAGE4_SOURCE_CHECKSUM: checksums.source,
  STAGE4_PLAN_CHECKSUM: checksums.plan,
  STAGE4_ACK_MANUAL_REVIEW: "none",
  ...extra,
});

describe("Stage 4 CLI: 接続前の検査", () => {
  it("dry-run: Productionへ接続せず(db=null)、スナップショットから候補を作り、使い捨てPostgreSQLの検証へ進む(ここでは到達不能portでconnect_failed)", async () => {
    const isolatedPg = { PHASE2_TEST_PG_HOST: "127.0.0.1", PHASE2_TEST_PG_PORT: "1", PHASE2_TEST_PG_USER: "u", PHASE2_TEST_PG_PASSWORD: "never-printed-password", PHASE2_TEST_PG_DATABASE: "phase2_test_db" };
    const r = await runStage4Mode("dry-run", env("dry-run", isolatedPg), null);
    expect(r.reasons).toEqual(["connect_failed:net_ECONNREFUSED"]);
    expect(JSON.stringify(r)).not.toContain("never-printed-password");
  }, 20000);

  it("dry-run: スナップショットが無い・改ざん・bundleに未記録なら、候補を作る前に停止する", async () => {
    put("plan/stage4-managers-state.json", stateText.replace("\"managers\":[", "\"managers\":[ "));
    expect((await runStage4Mode("dry-run", env("dry-run"), null)).reasons).toEqual(["state_snapshot_checksum_mismatch"]);
    rmSync(path.join(dir, "plan", "stage4-managers-state.json"));
    expect((await runStage4Mode("dry-run", env("dry-run"), null)).reasons).toEqual(["input_missing:plan/stage4-managers-state.json"]);
    put("plan/stage4-managers-state.json", stateText);
    const s = state();
    const b = await buildManagersCandidate(managersResponse(), FETCHED, s.managers, new Date().toISOString());
    put("plan/stage4-managers-bundle.json", buildSourceBundle(managersResponse(), FETCHED, b, s.counts));
    expect((await runStage4Mode("dry-run", env("dry-run"), null)).reasons).toEqual(["state_snapshot_not_bound"]);
  });

  it("plan・apply・verifyはdb設定が無ければ接続を試みずに停止する", async () => {
    for (const m of ["plan", "apply", "verify"] as const) expect((await runStage4Mode(m, env(m), null)).reasons).toEqual(["db_config_missing"]);
  });

  it("dry-run: checksum・commit・新しいplan run・入力欠落は接続前に停止", async () => {
    expect((await runStage4Mode("dry-run", env("dry-run", { STAGE4_SOURCE_CHECKSUM: "0".repeat(64) }), DB)).reasons).toContain("source_checksum_not_bound");
    expect((await runStage4Mode("dry-run", env("dry-run", { STAGE4_PLAN_CHECKSUM: "0".repeat(64) }), DB)).reasons).toContain("plan_checksum_not_bound");
    expect((await runStage4Mode("dry-run", env("dry-run", { GITHUB_SHA: "b".repeat(40) }), DB)).reasons).toContain("plan_commit_sha_mismatch");
    expect((await runStage4Mode("dry-run", env("dry-run", { STAGE4_PLAN_RUN_ID: "abc" }), DB)).reasons).toEqual(["input_invalid:STAGE4_PLAN_RUN_ID"]);
    put("plan-runs.json", [{ id: 150, displayTitle: "reference-data plan", createdAt: new Date().toISOString(), conclusion: "success" }]);
    expect((await runStage4Mode("dry-run", env("dry-run"), DB)).reasons).toContain("candidate_not_latest");
    rmSync(path.join(dir, "backup", "reference-data-backup-summary.json"));
    expect((await runStage4Mode("dry-run", env("dry-run"), DB)).reasons).toEqual(["input_missing:backup/reference-data-backup-summary.json"]);
  });

  it("apply: 別runのdry-run記録は拒否し、正しい入力なら接続へ進む", async () => {
    expect((await runStage4Mode("apply", env("apply", { STAGE4_DRY_RUN_RUN_ID: "999" }), DB)).reasons).toEqual(["dry_run_record_not_from_this_run"]);
    const r = await runStage4Mode("apply", env("apply"), DB);
    expect(r.reasons).toEqual(["connect_failed:net_ECONNREFUSED"]);
    expect(JSON.stringify(r)).not.toContain("never-printed-password");
  }, 20000);

  it("verify: apply runの結果(failureでも可)を同じrunからだけ受け付ける", async () => {
    expect((await runStage4Mode("verify", env("verify", { STAGE4_APPLY_RUN_ID: "304" }), DB)).reasons).toContain("apply_run_id_mismatch");
    put("facts-apply.json", runFacts("apply", 303, { created: minutesAgo(new Date(), 20), updated: minutesAgo(new Date(), 10) }, { runAttempt: 2 }));
    expect((await runStage4Mode("verify", env("verify"), DB)).reasons).toContain("apply_is_rerun");
    put("facts-apply.json", runFacts("apply", 303, { created: minutesAgo(new Date(), 20), updated: minutesAgo(new Date(), 10) }, { conclusion: "failure" }));
    expect((await runStage4Mode("verify", env("verify"), DB)).reasons).toEqual(["connect_failed:net_ECONNREFUSED"]);
  }, 20000);
});
