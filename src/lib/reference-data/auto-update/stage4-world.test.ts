import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SOURCE_ENDPOINTS, createRecordedFixtureTransport } from "./source-transport";
import { isRetryAllowed } from "./update-batch-state";
import { buildWorldSearchRequest } from "./source-world";
import {
  WORLD_CONFIRM,
  WORLD_LIMITS,
  buildWorldBundle,
  buildWorldCandidate,
  evaluateWorldPlan,
  fetchWorldFullOnce,
  isFirstWorldApply,
  parseWorldBundle,
  summarizeWorldPlan,
} from "./stage4-world";
import { runWorldMode } from "./stage4-world-cli";
import { evaluateUpdatePolicy } from "./update-policy";
import { recordedWorldPages, upstreamPlayers, worldState } from "./__fixtures__/stage4-world-fixtures";

const FETCHED = "2026-09-25T09:00:00.000Z";
const NOW = "2026-09-25T10:00:00.000Z";

describe("World: 取得の安全上限(本人の安全条件 2026-09-24)", () => {
  it("転送量40MB・14,000件・460 page(443基準)・462 request。間隔3秒・timeout 20秒・同時1件・429/403は再試行しない", () => {
    expect(WORLD_LIMITS).toMatchObject({ maxTotalBytes: 40 * 1024 * 1024, maxRecords: 14_000, maxPages: 460, maxRequests: 462 });
    expect(SOURCE_ENDPOINTS["efootball-world"]).toMatchObject({ minIntervalMs: 3_000, timeoutMs: 20_000, maxAttempts: 3 });
    expect(isRetryAllowed("source_fetch", "http_429", 1)).toBe(false);
    expect(isRetryAllowed("source_fetch", "http_403", 1)).toBe(false);
    expect(isRetryAllowed("source_fetch", "http_5xx", 1)).toBe(true);
  });
});

describe("World: 全件の1回取得と記録", () => {
  it("全pageを1回ずつ取得して応答を記録し、記録の再生で同じcandidateになる", async () => {
    const pages = recordedWorldPages();
    const t = createRecordedFixtureTransport(pages.map((p) => ({ request: buildWorldSearchRequest(p.page, "CREATED_AT"), responses: [{ status: 200, headers: { "content-type": p.contentType }, bodyText: p.bodyText }] })));
    const recorded = await fetchWorldFullOnce(t, FETCHED, async () => undefined);
    expect(t.calls).toHaveLength(2);
    expect(recorded.map((p) => p.page)).toEqual([1, 2]);
    const a = await buildWorldCandidate(recorded, FETCHED, worldState(), NOW);
    const b = await buildWorldCandidate(pages, FETCHED, worldState(), NOW);
    expect(a.plan.planChecksum).toBe(b.plan.planChecksum);
    expect(a.candidate.sourceChecksum).toBe(b.candidate.sourceChecksum);
  });

  it("途中のpageが欠けた不完全な取得は停止する", async () => {
    const pages = recordedWorldPages();
    const t = createRecordedFixtureTransport([{ request: buildWorldSearchRequest(1, "CREATED_AT"), responses: [{ status: 200, headers: { "content-type": "application/json" }, bodyText: pages[0].bodyText }] }]);
    await expect(fetchWorldFullOnce(t, FETCHED, async () => undefined)).rejects.toMatchObject({ code: expect.stringMatching(/^source_/) });
  });
});

describe("World: candidate・policy", () => {
  it("card_ratingだけの変更を別集計し、appearanceだけの違いは更新しない(保持列)。追加1・変更2・削除0", async () => {
    const b = await buildWorldCandidate(recordedWorldPages(), FETCHED, worldState(), NOW);
    expect(b.plan.report).toMatchObject({ beforeCount: 4, afterCount: 5, addedCount: 1, changedCount: 2, removedCount: 0 });
    expect(b.cardRatingOnlyChangedCount).toBe(1);
    const fields = b.plan.updates.map((u) => u.changedFields).sort();
    expect(fields).toEqual([["card_rating"], ["ovr_max"]]);
    expect(b.candidate.preservedColumnDrift.world_player_cards?.appearance).toBeGreaterThanOrEqual(1);
    const codes = b.candidate.policy.findings.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["world_card_rating_only_changes", "world_first_apply", "baseline_missing", "preserved_column_drift"]));
    expect(b.candidate.policy.findings.filter((f) => f.severity === "hard_block")).toEqual([]);
    const e = evaluateWorldPlan(b);
    expect(e.problems).toEqual([]);
    expect(e.manualReviewCodes).toEqual(expect.arrayContaining(["baseline_missing", "world_first_apply"]));
    const s = summarizeWorldPlan(b, e);
    expect(s).toMatchObject({ addedCount: 1, changedCount: 2, cardRatingOnlyChangedCount: 1, structuralChangedCount: 1, removedCount: 0 });
    expect((s.sourceTimestamps as { rawWithoutTimezone: number }).rawWithoutTimezone).toBe(5);
    expect(JSON.stringify(s)).not.toMatch(/Synthetic World Player|合成/);
  });

  it("removedが1件でもあれば停止(物理削除なし)", async () => {
    const b = await buildWorldCandidate(recordedWorldPages(upstreamPlayers({ removeFourth: true })), FETCHED, worldState(), NOW);
    expect(evaluateWorldPlan(b).problems).toContain("removal_not_allowed");
  });

  it("将来日時はhard block、Productionの最大値より古い(逆行)もhard block", async () => {
    const future = await buildWorldCandidate(recordedWorldPages(upstreamPlayers({ updatedAt: "2027-01-01T00:00:00" })), FETCHED, worldState(), NOW);
    expect(evaluateWorldPlan(future).problems).toContain("policy_hard_block:source_timestamp_future");
    const regressed = await buildWorldCandidate(recordedWorldPages(upstreamPlayers({ updatedAt: "2026-01-01T00:00:00" })), FETCHED, worldState(), NOW);
    expect(evaluateWorldPlan(regressed).problems).toContain("policy_hard_block:source_timestamp_regression");
  });

  it("同一時刻への偏りはmanual review(hard blockではない)", async () => {
    const b = await buildWorldCandidate(recordedWorldPages(), FETCHED, worldState(), NOW);
    expect(b.timestamps.findings).toContain("mass_identical_timestamps");
    expect(evaluateWorldPlan(b).manualReviewCodes).toContain("mass_identical_source_timestamps");
  });

  it("自動更新でWorldを適用した監査batchがあれば初回ではない", () => {
    expect(isFirstWorldApply([{ target_table: "world_player_cards", status: "verified", notes: "initial import" }])).toBe(true);
    expect(isFirstWorldApply([{ target_table: "world_player_cards", status: "verified", notes: "auto-update 0123456789ab" }])).toBe(false);
  });
});

describe("World policy: card_ratingだけの大量変動", () => {
  const base = {
    sourceFetchFailed: false, sourceParseFailed: false, checksumGenerationFailed: false, unexpectedTableCount: 0, userOrAuthDataDetected: false,
    identityReuseConflictCount: 0, sourceTimestampRegression: false, sourceChecksumAlreadyApplied: false, physicalDeleteAttempted: false,
    frozenTableMutationCount: 0, existingImportBatchMutationCount: 0, baseline: { payloadBytes: 100 }, payloadBytes: 100, lastAppliedAt: null, now: NOW,
  };
  const counts = (changed: number, cardRatingOnly: number) => ({
    beforeCount: 13_009, afterCount: 13_286, addedCount: 277, changedCount: changed, removedCount: 0, resurrectedCount: 0, duplicateCount: 0,
    invalidCount: 0, schemaDriftCount: 0, sourceMissingCount: 0, approvedRemovalCount: 0, cardRatingOnlyChangedCount: cardRatingOnly,
  });

  it("card_ratingだけの変更は規模の判定から除き、件数を必ずwarningで示す(hard blockにしない)", () => {
    const r = evaluateUpdatePolicy({ ...base, tables: { world_player_cards: counts(9_000, 8_900) } });
    expect(r.findings.map((f) => f.code)).toContain("world_card_rating_only_changes");
    expect(r.findings.map((f) => f.code)).not.toContain("world_large_change");
    expect(r.severity).not.toBe("hard_block");
  });

  it("card_rating以外の大量変更は従来どおりmanual review", () => {
    const r = evaluateUpdatePolicy({ ...base, tables: { world_player_cards: counts(9_000, 100) } });
    expect(r.findings.map((f) => f.code)).toContain("world_large_change");
  });

  it("将来日時・同一時刻の偏り・初回適用のsignal", () => {
    const r = evaluateUpdatePolicy({ ...base, tables: { world_player_cards: counts(10, 0) }, sourceTimestampFuture: true, massIdenticalSourceTimestamps: true, firstWorldApply: true });
    const by = Object.fromEntries(r.findings.map((f) => [f.code, f.severity]));
    expect(by).toMatchObject({ source_timestamp_future: "hard_block", mass_identical_source_timestamps: "manual_review", world_first_apply: "manual_review" });
  });
});

describe("World Evidence(2026-09-25 Production rehearsal)", () => {
  it("同じcommitの4 run・削除0・hard block 0・applied_verified。managers/analysisへの書き込み0、行データ・秘密情報なし", () => {
    const text = readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "evidence", "stage4-world-rehearsal-2026-09-25.json"), "utf8");
    const ev = JSON.parse(text);
    for (const r of [ev.runs.plan, ev.runs.backup, ev.runs.dryRun, ev.runs.apply]) expect(r).toMatchObject({ attempt: 1, event: "workflow_dispatch", branch: "main", conclusion: "success", headSha: ev.mainCommit });
    expect(ev.diff.removed).toBe(0);
    expect(ev.diff.after).toBe(ev.diff.before + ev.diff.added);
    expect(ev.diff.changed).toBe(ev.diff.cardRatingOnlyChanged + ev.diff.structuralChanged);
    expect(ev.policy).toMatchObject({ hardBlocks: 0, planProblems: [] });
    expect(ev.upstream.managersRequests).toBe(0);
    expect(ev.upstream.totalBytes).toBeLessThanOrEqual(40 * 1024 * 1024);
    expect(ev.apply).toMatchObject({ status: "applied_verified", inserted: ev.diff.added, updated: ev.diff.changed, removed: 0, automaticUndo: false });
    expect(ev.postVerify).toMatchObject({ ok: true, problems: [], facts: { worldCount: ev.diff.after, managersCount: ev.productionBefore.managers } });
    expect(ev.productionEffects).toMatchObject({ worldDeleted: 0, managersWrites: 0, playerCardAnalysisWrites: 0, undo: 0, rollback: 0, restore: 0 });
    expect(text).not.toMatch(/postgres(ql)?:\/\/|-----BEGIN|AGE-SECRET-KEY|cloudflarestorage|supabase\.co|[0-9a-f]{64}/i);
  });
});

describe("World: bundle・CLI", () => {
  it("本文hashで改ざんを検出する", async () => {
    const pages = recordedWorldPages();
    const b = await buildWorldCandidate(pages, FETCHED, worldState(), NOW);
    const bundle = buildWorldBundle(pages, FETCHED, b, worldState().counts);
    expect(parseWorldBundle(JSON.stringify(bundle)).planChecksum).toBe(b.plan.planChecksum);
    const tampered = { ...bundle, pages: bundle.pages.map((p, i) => (i === 0 ? { ...p, bodyText: p.bodyText.replace("104", "105") } : p)) };
    expect(() => parseWorldBundle(JSON.stringify(tampered))).toThrow("bundle_body_hash_mismatch");
  });

  it("確認入力がworld用の固定値でなければ接続もupstream取得もしない", async () => {
    const db = { host: "127.0.0.1", port: 1, user: "x", password: "y", database: "z" };
    for (const mode of ["plan", "dry-run", "apply", "verify"] as const) {
      expect(await runWorldMode(mode, { REFERENCE_DATA_APPLY_CONFIRM: "plan-managers" }, db)).toEqual({ ok: false, reasons: ["confirmation_mismatch"], facts: {} });
    }
    expect(WORLD_CONFIRM.apply).toBe("apply-world-to-production");
  });

  it("World用コードは削除・TRUNCATE・managers/analysisへの書き込み・自動undo・Restoreを含まない", () => {
    const src = readFileSync(path.join(__dirname, "stage4-world.ts"), "utf8");
    const cli = readFileSync(path.join(__dirname, "stage4-world-cli.ts"), "utf8");
    for (const raw of [src, cli]) {
      const s = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join("\n");
      expect(s).not.toMatch(/delete from|truncate |drop table|insert into [a-z_${}.]*(managers|player_card_analysis)|update [a-z_${}.]*(managers|player_card_analysis)/i);
      expect(s).not.toMatch(/restoreReferenceDataBackup/);
    }
    expect([...src.matchAll(/applyUndoPlan\(/g)]).toHaveLength(1);
    expect(src.slice(src.indexOf("export async function runWorldApply"))).not.toMatch(/applyUndoPlan/);
    expect(cli).not.toMatch(/applyUndoPlan|applyUpdatePlans/);
  });
});
