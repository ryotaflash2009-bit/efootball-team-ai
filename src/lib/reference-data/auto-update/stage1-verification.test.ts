import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRecordedFixtureTransport, type RecordedExchange } from "./source-transport";
import { buildWorldSearchRequest, normalizeWorldPlayerRecord, toWorldSourceRow } from "./source-world";
import { buildManagersRequest, toManagerSourceRow } from "./source-managers";
import { buildInsertRow } from "./update-diff";
import { STAGE1_LIMITS, analyzeWorldPage, runStage1Full, summarizeStage1Full } from "./stage1-verification";

const FIX = path.join(__dirname, "__fixtures__", "source");
const players = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: Record<string, unknown>[] }).players.slice(0, 3);
const managers = (JSON.parse(readFileSync(path.join(FIX, "managers-synthetic.json"), "utf8")) as unknown[]).slice(0, 3);
const T = "2026-09-23T00:00:00.000Z";
const json = (body: unknown, ct = "application/json") => ({ status: 200, headers: { "content-type": ct }, bodyText: JSON.stringify(body) });
const withUpdated = (p: Record<string, unknown>, u: string) => ({ ...p, appearance: { ...((p.appearance as object) ?? {}), updatedAt: u } });

function currentRows() {
  const w = players.map((p) => toWorldSourceRow(normalizeWorldPlayerRecord(withUpdated(p, "2026-04-01T00:00:00")), T)).flatMap((r) => (r.ok ? [r.row] : []));
  const m = managers.map((x) => toManagerSourceRow(x, T)).flatMap((r) => (r.ok ? [r.row] : []));
  return {
    world_player_cards: w.map((r) => ({ ...buildInsertRow("world_player_cards", r), dataset_version: "v0", import_batch_id: null })),
    managers: m.map((r, i) => ({ ...buildInsertRow("managers", r, i + 1), dataset_version: "v0", import_batch_id: null })),
  };
}

describe("Stage 1: page 1の実schema確認", () => {
  it("期待項目の存在率・未知の項目・上限超過を報告し、本文や名前を含まない", () => {
    const r = analyzeWorldPage(JSON.stringify({ players, totalCount: 13286, totalPages: 443, pageSize: 30, hasNext: true }), T);
    expect(r.missingRequiredKeys).toEqual([]);
    expect(r.withinLimits).toBe(false);
    expect(r.schemaDrift).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/Synthetic/);
    expect(analyzeWorldPage(JSON.stringify({ players: [{ foo: 1 }] }), T).schemaDrift).toBe(true);
    expect(STAGE1_LIMITS.worldMaxPages).toBe(30);
  });
});

describe("Stage 1: incremental(UPDATED_AT) + managers.json", () => {
  it("更新された選手だけをchangedにし、removed検出をせず、managersは変更なし", async () => {
    const newer = [withUpdated(players[0], "2026-09-20T00:00:00"), withUpdated(players[1], "2026-04-01T00:00:00"), withUpdated(players[2], "2026-04-01T00:00:00")];
    const exchanges: RecordedExchange[] = [
      { request: buildWorldSearchRequest(1, "UPDATED_AT"), responses: [json({ players: newer.slice(0, 2), totalCount: 3, totalPages: 2, pageSize: 2, hasNext: true })] },
      { request: buildWorldSearchRequest(2, "UPDATED_AT"), responses: [json({ players: newer.slice(2), totalCount: 3, totalPages: 2, pageSize: 2, hasNext: false })] },
      { request: buildManagersRequest(), responses: [json(managers, "text/plain; charset=utf-8")] },
    ];
    const r = await runStage1Full({
      transport: createRecordedFixtureTransport(exchanges), currentRows: currentRows(),
      history: { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null },
      fetchedAt: T, now: T, worldMode: "incremental", sleep: async () => undefined,
    });
    expect(r.failure).toBeNull();
    const world = r.plans.find((p) => p.table === "world_player_cards")!;
    expect(world.removalDetection).toBe("skipped");
    expect(world.report).toMatchObject({ changedCount: 1, addedCount: 0, removedCount: 0 });
    expect(world.updates[0].changedFields).toEqual(["appearance_updated_at"]);
    const mgr = r.plans.find((p) => p.table === "managers")!;
    expect(mgr.report).toMatchObject({ changedCount: 0, addedCount: 0, unchangedCount: 3 });
    const summary = JSON.stringify(summarizeStage1Full(r));
    expect(summary).not.toMatch(/Synthetic/);
    expect(summary).toContain('"worldMode":"incremental"');
  });
});
