import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRecordedFixtureTransport } from "./source-transport";
import { buildManagersRequest } from "./source-managers";
import {
  STAGE4_CONFIRM,
  Stage4Stop,
  buildManagersCandidate,
  buildSourceBundle,
  checkRun,
  evaluateBackupBinding,
  evaluateManagersPlan,
  fetchManagersOnce,
  newerPlanRuns,
  parseRunFacts,
  parseSourceBundle,
  priorApplications,
  summarizeManagersPlan,
  APPLY_WORKFLOW_PATH,
  BACKUP_WORKFLOW_PATH,
  stage4RunTitle,
} from "./stage4-managers";
import { runStage4Mode } from "./stage4-managers-cli";
import { SYNTHETIC_MANAGERS, backupSummaryText, managersResponse, minutesAgo, runFacts, state, COMMIT_SHA } from "./__fixtures__/stage4-fixtures";

const NOW = new Date("2026-09-24T12:00:00.000Z");
const FETCHED = "2026-09-24T09:00:00.000Z";
const COUNTS = { world_player_cards: 1, managers: 4, player_card_analysis: 1, import_batches: 1 };

async function build(list: readonly unknown[] = SYNTHETIC_MANAGERS, s = state()) {
  return buildManagersCandidate(managersResponse(list), FETCHED, s.managers, NOW.toISOString());
}

describe("Stage 4: managers.jsonの1回取得", () => {
  it("1 requestだけ送り、応答を記録する(再試行しない)", async () => {
    const t = createRecordedFixtureTransport([{ request: buildManagersRequest(), responses: [{ status: 200, headers: { "content-type": "text/plain" }, bodyText: JSON.stringify(SYNTHETIC_MANAGERS) }] }]);
    const r = await fetchManagersOnce(t, FETCHED);
    expect(t.calls).toHaveLength(1);
    expect(r).toEqual({ status: 200, contentType: "text/plain", bodyText: JSON.stringify(SYNTHETIC_MANAGERS) });
  });

  it("403・429・5xxは停止し、再試行しない", async () => {
    for (const status of [403, 429, 503]) {
      const t = createRecordedFixtureTransport([{ request: buildManagersRequest(), responses: [{ status, headers: { "content-type": "text/plain" }, bodyText: "x" }, { status: 200, headers: { "content-type": "text/plain" }, bodyText: "[]" }] }]);
      await expect(fetchManagersOnce(t, FETCHED)).rejects.toBeInstanceOf(Stage4Stop);
      expect(t.calls).toHaveLength(1);
    }
  });
});

describe("Stage 4: candidate planner(Productionの現在行が基準)", () => {
  it("現在4件・upstream 5件 → 追加1件・変更0件・removed 0。決定的で、要約に名前・行データを含まない", async () => {
    const a = await build();
    const b = await build();
    expect(a.plan.report).toMatchObject({ beforeCount: 4, afterCount: 5, addedCount: 1, changedCount: 0, removedCount: 0, unchangedCount: 4 });
    expect(a.plan.planChecksum).toBe(b.plan.planChecksum);
    expect(a.candidate.sourceChecksum).toBe(b.candidate.sourceChecksum);
    expect(a.candidate.targetTables).toEqual(["managers"]);
    const e = evaluateManagersPlan(a);
    expect(e.problems).toEqual([]);
    expect(e.manualReviewCodes.length).toBeGreaterThan(0);
    const summary = summarizeManagersPlan(a, e);
    expect(summary).toMatchObject({ addedCount: 1, changedCount: 0, addedIdentities: [a.plan.inserts[0].identity], addedIdentitiesTruncated: false });
    expect(JSON.stringify(summary)).not.toMatch(/Synthetic|images\//);
  });

  it("identityは[source, source_manager_id]", async () => {
    const a = await build();
    expect(a.plan.inserts[0].identity).toContain(String(SYNTHETIC_MANAGERS[4].id));
  });

  it("upstreamの重複manager(内容違い)・不正recordはhard stop", async () => {
    const conflicting = { ...SYNTHETIC_MANAGERS[0], name: "Synthetic Conflicting Name" };
    const dup = build([...SYNTHETIC_MANAGERS, conflicting]).then((b) => evaluateManagersPlan(b).problems);
    await expect(dup).rejects.toMatchObject({ code: expect.stringMatching(/^(duplicate_identity|source_incomplete)$/) });
    const invalid = evaluateManagersPlan(await build([...SYNTHETIC_MANAGERS, { id: "bad id with spaces", name: "x" }]));
    expect(invalid.problems).toContain("invalid_source_records");
  });

  it("managerのremovedは自動適用せず停止(物理削除なし)", async () => {
    const e = evaluateManagersPlan(await build(SYNTHETIC_MANAGERS.slice(1)));
    expect(e.ok).toBe(false);
    expect(e.problems).toContain("removal_requires_manual_decision");
  });

  it("World・analysisが対象に入ったら停止、変更0件・上限超過も停止", async () => {
    const a = await build();
    expect(evaluateManagersPlan({ ...a, candidate: { ...a.candidate, targetTables: ["world_player_cards", "managers"] } }).problems).toContain("unexpected_target_tables");
    expect(evaluateManagersPlan({ ...a, plan: { ...a.plan, table: "world_player_cards" } }).problems).toContain("unexpected_target_tables");
    expect(evaluateManagersPlan(await build(SYNTHETIC_MANAGERS.slice(0, 4))).problems).toContain("no_changes");
    const many = { ...a, plan: { ...a.plan, inserts: Array.from({ length: 11 }, () => a.plan.inserts[0]) } };
    expect(evaluateManagersPlan(many).problems).toContain("rehearsal_scope_exceeded");
  });
});

describe("Stage 4: source bundle", () => {
  it("本文hashを検証し、改ざん・形の違いを拒否する", async () => {
    const a = await build();
    const bundle = buildSourceBundle(managersResponse(), FETCHED, a, state().counts);
    expect(parseSourceBundle(JSON.stringify(bundle)).planChecksum).toBe(a.plan.planChecksum);
    const tampered = { ...bundle, response: { ...bundle.response, bodyText: JSON.stringify(SYNTHETIC_MANAGERS.slice(0, 3)) } };
    expect(() => parseSourceBundle(JSON.stringify(tampered))).toThrow("bundle_body_hash_mismatch");
    expect(() => parseSourceBundle(JSON.stringify({ ...bundle, schema: "x" }))).toThrow("bundle_shape");
    expect(() => parseSourceBundle("nope")).toThrow("bundle_not_json");
  });
});

describe("Stage 4: workflow runのbinding", () => {
  const at = { created: minutesAgo(NOW, 120), updated: minutesAgo(NOW, 110) };
  it("同じworkflow・mode・main・手動実行・成功・再実行なし・同じcommitだけ通す", () => {
    const f = runFacts("plan", 101, at);
    expect(checkRun(f, { id: "101", path: APPLY_WORKFLOW_PATH, title: stage4RunTitle("plan"), commitSha: COMMIT_SHA }, "plan")).toEqual([]);
    const cases: Array<[Parameters<typeof runFacts>[3], string]> = [
      [{ path: BACKUP_WORKFLOW_PATH }, "plan_wrong_workflow"],
      [{ displayTitle: stage4RunTitle("dry-run") }, "plan_wrong_mode"],
      [{ headBranch: "feature" }, "plan_not_main"],
      [{ event: "push" }, "plan_not_workflow_dispatch"],
      [{ conclusion: "failure" }, "plan_not_successful"],
      [{ runAttempt: 2 }, "plan_is_rerun"],
      [{ headSha: "b".repeat(40) }, "plan_commit_sha_mismatch"],
    ];
    for (const [patch, problem] of cases) {
      expect(checkRun(runFacts("plan", 101, at, patch), { id: "101", path: APPLY_WORKFLOW_PATH, title: stage4RunTitle("plan"), commitSha: COMMIT_SHA }, "plan")).toContain(problem);
    }
    expect(checkRun(f, { id: "102", path: APPLY_WORKFLOW_PATH }, "plan")).toContain("plan_run_id_mismatch");
    expect(() => parseRunFacts("{}")).toThrow("run_facts_shape");
  });

  it("後から成功したplan runがあれば古いplanは使わない(新しいcandidateの存在)", () => {
    const plan = runFacts("plan", 101, at);
    expect(newerPlanRuns(plan, [{ id: 101, displayTitle: "reference-data plan", createdAt: at.created, conclusion: "success" }])).toBe(0);
    expect(newerPlanRuns(plan, [{ id: 105, displayTitle: "reference-data plan", createdAt: minutesAgo(NOW, 60), conclusion: "success" }])).toBe(1);
    expect(newerPlanRuns(plan, [{ id: 105, displayTitle: "reference-data plan", createdAt: minutesAgo(NOW, 60), conclusion: "failure" }])).toBe(0);
    expect(newerPlanRuns(plan, [{ id: 106, displayTitle: "reference-data dry-run", createdAt: minutesAgo(NOW, 60), conclusion: "success" }])).toBe(0);
  });
});

describe("Stage 4: Backup binding", () => {
  const facts = (patch = {}, updatedMin = 60) => runFacts("backup", 900, { created: minutesAgo(NOW, updatedMin + 5), updated: minutesAgo(NOW, updatedMin) }, patch);
  const evaluate = (text: string, f = facts(), counts = { world_player_cards: 1, managers: 4, import_batches: 1 }) =>
    evaluateBackupBinding({ runId: "900", facts: f, summaryText: text, productionCounts: counts, now: NOW.toISOString() });

  it("形式\"2\"・pre-apply・24時間以内・Productionの件数と一致なら使える", () => {
    const r = evaluate(backupSummaryText("900", COUNTS));
    expect(r.problems).toEqual([]);
    expect(r.backup).toMatchObject({ runId: "900", category: "pre-apply", conclusion: "success", restoreVerified: true, storageVerified: true });
  });

  it("期限切れ(Run #8を翌日に使う等)・Run #6のような空Backup・旧形式・daily・別runの要約・件数の差・失敗runを拒否する", () => {
    expect(evaluate(backupSummaryText("900", COUNTS), facts({}, 25 * 60)).problems).toContain("backup_expired");
    const empty = evaluate(backupSummaryText("900", { world_player_cards: 0, managers: 0, player_card_analysis: 0, import_batches: 0 })).problems;
    expect(empty.some((p) => p.startsWith("backup_summary:content_policy"))).toBe(true);
    expect(evaluate(backupSummaryText("900", COUNTS, (s) => (s.backupVersion = "1"))).problems).toContain("backup_summary:format_version_not_2");
    expect(evaluate(backupSummaryText("900", COUNTS, (s) => (s.category = "daily"))).problems).toContain("backup_summary:category");
    expect(evaluate(backupSummaryText("777", COUNTS)).problems).toContain("backup_summary_not_from_this_run");
    expect(evaluate(backupSummaryText("900", { ...COUNTS, managers: 5 })).problems).toContain("backup_counts_differ_from_production:managers");
    expect(evaluate(backupSummaryText("900", COUNTS), facts({ conclusion: "failure" })).problems).toContain("backup_not_successful");
    expect(evaluate(backupSummaryText("900", COUNTS), facts({ runAttempt: 2 })).problems).toContain("backup_is_rerun");
    expect(evaluate(backupSummaryText("900", COUNTS, (s) => (s.restoreVerified = false))).backup.restoreVerified).toBe(false);
    expect(evaluate("{}").problems.length).toBeGreaterThan(0);
  });
});

describe("Stage 4: 二重適用の検出", () => {
  it("同じ計画のbatch(payload_hash)・同じcandidateの適用済みbatchを検出する", () => {
    const rows = [{ payload_hash: "c".repeat(64), notes: "auto-update abcdefabcdef", status: "verified" }];
    expect(priorApplications(rows, "c".repeat(64), "abcdefabcdef0000")).toEqual({ duplicateBatch: true, sourceAlreadyApplied: true });
    expect(priorApplications(rows, "d".repeat(64), "123456789012")).toEqual({ duplicateBatch: false, sourceAlreadyApplied: false });
  });
});

describe("Stage 4: CLI", () => {
  it("確認入力がmodeの固定値と一致しなければ、接続もupstream取得もしない", async () => {
    // 接続先は到達不能なport。確認入力で止まるため接続は試みられない。
    const db = { host: "127.0.0.1", port: 1, user: "x", password: "y", database: "z" };
    for (const mode of ["plan", "dry-run", "apply", "verify"] as const) {
      const r = await runStage4Mode(mode, { REFERENCE_DATA_APPLY_CONFIRM: "yes" }, db);
      expect(r).toEqual({ ok: false, reasons: ["confirmation_mismatch"], facts: {} });
    }
    expect(STAGE4_CONFIRM.apply).toBe("apply-managers-to-production");
  });

  it("入力(run id・checksum・作業フォルダ)が不正なら接続前に停止し、値を出力しない", async () => {
    const db = { host: "127.0.0.1", port: 1, user: "x", password: "secret-password-value", database: "z" };
    const r = await runStage4Mode("dry-run", { REFERENCE_DATA_APPLY_CONFIRM: STAGE4_CONFIRM["dry-run"], STAGE4_WORK_DIR: "relative/dir" }, db);
    expect(r.reasons).toEqual(["work_dir_invalid"]);
    expect(JSON.stringify(r)).not.toContain("secret-password-value");
  });

  it("stage4のコードは削除・TRUNCATE・World/analysisへの書き込み・自動undo・Restoreを含まない", () => {
    const src = readFileSync(path.join(__dirname, "stage4-managers.ts"), "utf8");
    const cli = readFileSync(path.join(__dirname, "stage4-managers-cli.ts"), "utf8");
    for (const raw of [src, cli]) {
      const s = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join("\n");
      expect(s).not.toMatch(/delete from|truncate |drop table|insert into [a-z_${}.]*(world_player_cards|player_card_analysis)|update [a-z_${}.]*(world_player_cards|player_card_analysis)/i);
      expect(s).not.toMatch(/restoreReferenceDataBackup|setTimeout\(|fetchSourceWithRetry|for \(let attempt/i);
    }
    // undoは隔離DBの模擬(runManagersIsolatedValidation)の中だけで呼ぶ。
    const undoCalls = [...src.matchAll(/applyUndoPlan\(/g)].length;
    expect(undoCalls).toBe(1);
    expect(src.slice(src.indexOf("export async function runManagersApply"))).not.toMatch(/applyUndoPlan/);
    expect(cli).not.toMatch(/applyUndoPlan/);
  });
});
