import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRecordedFixtureTransport, createDisabledSourceTransport, type RecordedExchange, type SourceResponse } from "./source-transport";
import { buildWorldSearchRequest } from "./source-world";
import { buildManagersRequest } from "./source-managers";
import { collectWorldFullSnapshot, collectWorldIncrementalSnapshot, runDetectionPipeline, summarizeDetection, runIsolatedDryRunApply, type DryRunPgClient } from "./update-dry-run";
import { buildInsertRow } from "./update-diff";
import { assertIsolatedSchemaName, buildIsolatedReferenceSchemaDdl, REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import type { CandidateHistory } from "./update-candidate";

const FIX = path.join(__dirname, "__fixtures__", "source");
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql");
const players = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: unknown[] }).players;
const managersBody = JSON.stringify((JSON.parse(readFileSync(path.join(FIX, "managers-synthetic.json"), "utf8")) as unknown[]).slice(0, 3));
const good = players.slice(0, 3); // 受理される3件
const FETCHED_AT = "2026-09-23T00:00:00.000Z";
const NOW = "2026-09-23T12:00:00.000Z";

const json = (body: unknown): SourceResponse => ({ status: 200, headers: { "content-type": "application/json" }, bodyText: JSON.stringify(body) });
const worldPage = (page: number, list: unknown[], totalPages: number, totalCount: number, sortBy: "CREATED_AT" | "UPDATED_AT" = "CREATED_AT", extra: Partial<SourceResponse> = {}): RecordedExchange => ({
  request: buildWorldSearchRequest(page, sortBy),
  responses: [{ ...json({ players: list, totalCount, totalPages, pageSize: 2, hasNext: page < totalPages }), ...extra }],
});
const fullScan = (): RecordedExchange[] => [worldPage(1, good.slice(0, 2), 2, 3), worldPage(2, good.slice(2), 2, 3)];
const managersExchange = (): RecordedExchange => ({ request: buildManagersRequest(), responses: [json(JSON.parse(managersBody))] });
const history: CandidateHistory = { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null };

describe("collectWorldFullSnapshot", () => {
  it("totalPagesまで順に取得し、page間に3秒の間隔を空け、complete snapshotを作る", async () => {
    const waits: number[] = [];
    const t = createRecordedFixtureTransport(fullScan());
    const c = await collectWorldFullSnapshot(t, { fetchedAt: FETCHED_AT, sleep: async (ms) => void waits.push(ms) });
    if (!c.ok) throw new Error(c.failure.code);
    expect(c.snapshot.completeness.status).toBe("complete");
    expect(c.snapshot.rows.length).toBe(3);
    expect(waits).toEqual([3000]);
    expect(t.calls.length).toBe(2);
  });

  it("途中pageの429は部分snapshotにせず即停止(以降のpageを取得しない)", async () => {
    const t = createRecordedFixtureTransport([worldPage(1, good.slice(0, 2), 3, 5), { request: buildWorldSearchRequest(2, "CREATED_AT"), responses: [{ status: 429, headers: {}, bodyText: "" }] }]);
    const c = await collectWorldFullSnapshot(t, { fetchedAt: FETCHED_AT, sleep: async () => {} });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.failure).toMatchObject({ stage: "source_fetch", code: "http_429" });
    expect(t.calls.length).toBe(2);
  });

  it("構造変化(players配列なし)はparse failure", async () => {
    const t = createRecordedFixtureTransport([{ request: buildWorldSearchRequest(1, "CREATED_AT"), responses: [json({ items: [] })] }]);
    const c = await collectWorldFullSnapshot(t, { fetchedAt: FETCHED_AT });
    expect(c.ok ? null : c.failure).toMatchObject({ stage: "parse", code: "schema_drift" });
  });
});

describe("collectWorldIncrementalSnapshot", () => {
  const upd = (id: string, u: string) => ({ ...(good[0] as object), id, appearance: { updatedAt: u } });

  it("既知・無変化のpageで早期停止し、incremental snapshot(removed検出なし)を作る", async () => {
    const t = createRecordedFixtureTransport([
      worldPage(1, [upd("900000000000011", "2026-09-22T00:00:00Z"), upd("900000000000012", "2026-09-21T00:00:00Z")], 5, 10, "UPDATED_AT"),
      worldPage(2, [upd("900000000000013", "2026-09-01T00:00:00Z")], 5, 10, "UPDATED_AT"),
    ]);
    const known = new Map([["900000000000013", "2026-09-01T00:00:00.000Z"], ["900000000000012", "2026-09-01T00:00:00.000Z"]]);
    const c = await collectWorldIncrementalSnapshot(t, known, { previousMaxUpdatedAt: "2026-09-10T00:00:00.000Z", previousFirstPageHash: null }, { fetchedAt: FETCHED_AT, sleep: async () => {} });
    if (!c.ok) throw new Error(c.failure.code);
    expect(c.decision).toBe("stop_all_known");
    expect(c.snapshot.scope).toBe("incremental");
    expect(c.snapshot.removalDetectionAllowed).toBe(false);
    expect(c.maxUpdatedAtSeen).toBe("2026-09-22T00:00:00.000Z");
    expect(t.calls.length).toBe(2);
  });

  it("UPDATED_AT降順が崩れていれば別方式へ切り替えずに停止", async () => {
    const t = createRecordedFixtureTransport([worldPage(1, [upd("900000000000011", "2026-01-01T00:00:00Z"), upd("900000000000012", "2026-09-21T00:00:00Z")], 5, 10, "UPDATED_AT")]);
    const c = await collectWorldIncrementalSnapshot(t, new Map(), { previousMaxUpdatedAt: null, previousFirstPageHash: null }, { fetchedAt: FETCHED_AT });
    expect(c.ok ? null : c.failure.code).toBe("sort_contract_violation");
  });
});

describe("runDetectionPipeline", () => {
  it("World+managersを取得し、状態をawaiting_reviewまで進め、Productionへ何も書かない", async () => {
    const t = createRecordedFixtureTransport([...fullScan(), managersExchange()]);
    const r = await runDetectionPipeline({ transport: t, tables: ["world_player_cards", "managers"], currentRows: {}, history, fetchedAt: FETCHED_AT, now: NOW, sleep: async () => {} });
    expect(r.failure).toBeNull();
    expect(r.stateHistory).toEqual(["detected", "source_fetched", "normalized", "diff_generated", "awaiting_review"]);
    expect(r.plans.map((p) => [p.table, p.report.addedCount])).toEqual([["world_player_cards", 3], ["managers", 3]]);
    expect(r.candidate?.policy.severity).toBe("manual_review");
    const summary = JSON.stringify(summarizeDetection(r));
    expect(summary).not.toMatch(/Synthetic/);
  });

  it("取得失敗・不完全snapshotでは状態を進めずに止まる", async () => {
    const disabled = await runDetectionPipeline({ transport: createDisabledSourceTransport(), tables: ["managers"], currentRows: {}, history, fetchedAt: FETCHED_AT, now: NOW });
    expect(disabled.stateHistory).toEqual(["detected"]);
    expect(disabled.failure).toMatchObject({ stage: "source_fetch", code: "network_disabled" });
    const t = createRecordedFixtureTransport([worldPage(1, good.slice(0, 2), 1, 5)]);
    const incomplete = await runDetectionPipeline({ transport: t, tables: ["world_player_cards"], currentRows: {}, history, fetchedAt: FETCHED_AT, now: NOW });
    expect(incomplete.stateHistory).toEqual(["detected", "source_fetched"]);
    expect(incomplete.failure).toMatchObject({ stage: "normalize", code: "source_incomplete" });
    expect(incomplete.candidate).toBeNull();
  });

  it("現在行に不正があればpolicy_blocked", async () => {
    const t = createRecordedFixtureTransport([managersExchange()]);
    const bad = [{ ...buildInsertRow("managers", { source: "amine250", source_manager_id: "x", name_en: "n", released_at: null, possession_game: null, quick_counter: null, long_ball_counter: null, out_wide: null, long_ball: null, overload: null, has_booster: false, has_link_up_play: false, booster_confirmation: null, boosters: [], link_up_plays: [], name_sort_key: "n", source_url: null, fetched_at: FETCHED_AT }, 1), unknown: 1 }];
    const r = await runDetectionPipeline({ transport: t, tables: ["managers"], currentRows: { managers: bad }, history, fetchedAt: FETCHED_AT, now: NOW });
    expect(r.stateHistory.at(-1)).toBe("policy_blocked");
  });
});

describe("isolated dry run guards", () => {
  it("隔離schema名だけを許可する", () => {
    for (const ok of ["reference_data_dry_run", "reference_data_x_test", "reference_data_phase_e_dry_run"]) expect(assertIsolatedSchemaName(ok)).toBe(ok);
    for (const bad of ["reference_data", "reference_data_ops", "public", "auth", "reference_data_prod", "Reference_data_test", "reference_data_test; drop"]) expect(() => assertIsolatedSchemaName(bad)).toThrow();
  });

  it("実DDLから隔離DDLを組み立て、権限・削除系の文を含まない", () => {
    const sql = {
      base: readFileSync(path.join(SQL_DIR, REPOSITORY_REFERENCE_SQL_FILES.base), "utf8"),
      detailExtension: readFileSync(path.join(SQL_DIR, REPOSITORY_REFERENCE_SQL_FILES.detailExtension), "utf8"),
      nameSortKeyExtension: readFileSync(path.join(SQL_DIR, REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension), "utf8"),
    };
    const ddl = buildIsolatedReferenceSchemaDdl("reference_data_dry_run", sql);
    expect(ddl).toContain("create table if not exists reference_data_dry_run.world_player_cards");
    expect(ddl).toContain("alter table reference_data_dry_run.managers");
    expect(ddl).not.toMatch(/reference_data\./);
    expect(ddl).not.toMatch(/\bgrant\b|\brevoke\b|player_card_analysis/i);
    expect(() => buildIsolatedReferenceSchemaDdl("reference_data", sql)).toThrow();
    expect(() => buildIsolatedReferenceSchemaDdl("reference_data_dry_run", { ...sql, base: "" })).toThrow(/見つからない/);
  });

  it("blockedな計画は隔離DBへ何も送らない", async () => {
    const calls: string[] = [];
    const client: DryRunPgClient = { query: async (s) => (calls.push(s), { rows: [] }) };
    const t = createRecordedFixtureTransport([managersExchange()]);
    const r = await runDetectionPipeline({ transport: t, tables: ["managers"], currentRows: { managers: [{ internal_manager_id: 1 }] }, history, fetchedAt: FETCHED_AT, now: NOW });
    const res = await runIsolatedDryRunApply(client, "reference_data_dry_run", r.plans, r.stagings, { managers: [] });
    expect(res.verified).toBe(false);
    expect(calls).toEqual([]);
    await expect(runIsolatedDryRunApply(client, "reference_data", [], [], {})).rejects.toThrow();
  });
});

describe("collectWorldFullSnapshot: 取得上限", () => {
  it("page 1のtotalPages/totalCountが上限を超えたら、2page目以降を取得せずcap_exceededで停止", async () => {
    const t = createRecordedFixtureTransport([worldPage(1, good.slice(0, 2), 5, 10)]);
    const byPages = await collectWorldFullSnapshot(t, { fetchedAt: FETCHED_AT, maxPages: 4 });
    expect(byPages.ok ? null : byPages.failure.code).toBe("cap_exceeded");
    expect(t.calls.length).toBe(1);
    const t2 = createRecordedFixtureTransport([worldPage(1, good.slice(0, 2), 2, 10)]);
    const byRecords = await collectWorldFullSnapshot(t2, { fetchedAt: FETCHED_AT, maxPages: 4, maxRecords: 5 });
    expect(byRecords.ok ? null : byRecords.failure.code).toBe("cap_exceeded");
    expect(t2.calls.length).toBe(1);
  });
});
