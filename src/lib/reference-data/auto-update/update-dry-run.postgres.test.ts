import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestOnlyPgConfigFromEnv } from "./postgres-adapter";
import { runGuardedCleanup } from "./postgres-test-lifecycle";
import { buildIsolatedReferenceSchemaDdl, REPOSITORY_REFERENCE_SQL_FILES } from "./isolated-reference-schema";
import { createRecordedFixtureTransport, type RecordedExchange } from "./source-transport";
import { buildWorldSearchRequest, normalizeWorldPlayerRecord, toWorldSourceRow } from "./source-world";
import { buildManagersRequest, toManagerSourceRow } from "./source-managers";
import { buildInsertRow } from "./update-diff";
import { runDetectionPipeline, runIsolatedDryRunApply } from "./update-dry-run";

/**
 * Phase E: fixture transport → 検出pipeline → 実DDLの隔離schemaへのdry run適用 → checksum・再diff検証、
 * を使い捨てPostgreSQLで通す。通常のvitestからは除外(`*.postgres.test.ts`)。接続先は
 * PHASE2_TEST_PG_*(localhost・テスト専用DB名だけ)。対象schemaは`reference_data_phase_e_dry_run`だけ。
 */

const SCHEMA = "reference_data_phase_e_dry_run";
const SQL_DIR = path.resolve(__dirname, "..", "..", "..", "..", "docs", "production-readiness", "sql");
const FIX = path.join(__dirname, "__fixtures__", "source");
const FETCHED_AT = "2026-09-23T00:00:00.000Z";
const NOW = "2026-09-23T12:00:00.000Z";
const sql = {
  base: readFileSync(path.join(SQL_DIR, REPOSITORY_REFERENCE_SQL_FILES.base), "utf8"),
  detailExtension: readFileSync(path.join(SQL_DIR, REPOSITORY_REFERENCE_SQL_FILES.detailExtension), "utf8"),
  nameSortKeyExtension: readFileSync(path.join(SQL_DIR, REPOSITORY_REFERENCE_SQL_FILES.nameSortKeyExtension), "utf8"),
};

const players = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: unknown[] }).players.slice(0, 3);
const managers = (JSON.parse(readFileSync(path.join(FIX, "managers-synthetic.json"), "utf8")) as unknown[]).slice(0, 3);
const json = (body: unknown) => ({ status: 200, headers: { "content-type": "application/json" }, bodyText: JSON.stringify(body) });
const exchanges = (): RecordedExchange[] => [
  { request: buildWorldSearchRequest(1, "CREATED_AT"), responses: [json({ players, totalCount: 3, totalPages: 1, pageSize: 3, hasNext: false })] },
  { request: buildManagersRequest(), responses: [json(managers)] },
];

/** 現在行fixture: World 2件(1件は古い値)+upstreamに無い1件、manager 2件(1件は古い値)。 */
function currentRows() {
  const w = players.map((p) => toWorldSourceRow(normalizeWorldPlayerRecord(p), "2026-09-01T00:00:00.000Z")).flatMap((r) => (r.ok ? [r.row] : []));
  const m = managers.map((x) => toManagerSourceRow(x, "2026-09-01T00:00:00.000Z")).flatMap((r) => (r.ok ? [r.row] : []));
  const world = [
    { ...buildInsertRow("world_player_cards", w[0]), team: "Old FC", dataset_version: "v0", import_batch_id: null },
    { ...buildInsertRow("world_player_cards", w[1]), efhub_card_id: "12345", dataset_version: "v0", import_batch_id: null },
    { ...buildInsertRow("world_player_cards", { ...w[1], world_card_id: "900000000000077", name_en: "Delisted", name_sort_key: "delisted" }), dataset_version: "v0", import_batch_id: null },
  ];
  const mgr = [
    { ...buildInsertRow("managers", { ...m[0], possession_game: 1 }, 5), name_ja: "既存監督", dataset_version: "v0", import_batch_id: null },
    { ...buildInsertRow("managers", m[1], 6), dataset_version: "v0", import_batch_id: null },
  ];
  return { world_player_cards: world, managers: mgr };
}

const config = buildTestOnlyPgConfigFromEnv(process.env);
let client: Client;
let connected = false;

async function resetSchema() {
  await client.query(`drop schema if exists ${SCHEMA} cascade`);
  await client.query(buildIsolatedReferenceSchemaDdl(SCHEMA, sql));
}

beforeAll(async () => {
  client = new Client(config);
  await client.connect();
  connected = true;
});
beforeEach(resetSchema);
afterAll(async () => {
  if (!connected) return;
  await runGuardedCleanup([{ ready: true, run: () => client.query(`drop schema if exists ${SCHEMA} cascade`).then(() => undefined) }]);
  await client.end();
});

describe("Phase E isolated dry run (使い捨てPostgreSQL)", () => {
  it("検出pipelineの計画を隔離schemaへ適用し、after checksum一致・再diff 0でverified", async () => {
    const cur = currentRows();
    const r = await runDetectionPipeline({
      transport: createRecordedFixtureTransport(exchanges()), tables: ["world_player_cards", "managers"], currentRows: cur,
      history: { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null }, fetchedAt: FETCHED_AT, now: NOW, sleep: async () => {},
    });
    expect(r.failure).toBeNull();
    expect(r.stateHistory.at(-1)).toBe("awaiting_review");
    const world = r.plans.find((p) => p.table === "world_player_cards")!;
    expect(world.report).toMatchObject({ addedCount: 1, changedCount: 1, removedCount: 1, unchangedCount: 1 });
    const res = await runIsolatedDryRunApply(client, SCHEMA, r.plans, r.stagings, cur);
    expect(res.problems).toEqual([]);
    expect(res.verified).toBe(true);
    expect(res.tables.map((t) => [t.table, t.inserted, t.updated, t.rediffChanges])).toEqual([["world_player_cards", 1, 1, 0], ["managers", 1, 1, 0]]);
    // removed候補は物理削除しない・eFHUB列とinsert時のみの列は保持される
    const kept = await client.query(`select world_card_id, efhub_card_id from ${SCHEMA}.world_player_cards order by world_card_id`);
    expect(kept.rows.map((x) => x.world_card_id)).toContain("900000000000077");
    expect(kept.rows.find((x) => x.world_card_id === "900000000000002")?.efhub_card_id).toBe("12345");
    const mgr = await client.query(`select internal_manager_id, name_ja, possession_game from ${SCHEMA}.managers order by internal_manager_id`);
    expect(mgr.rows.map((x) => x.internal_manager_id)).toEqual([5, 6, 7]);
    expect(mgr.rows[0]).toMatchObject({ name_ja: "既存監督", possession_game: 88 });
  });

  it("計画と実結果が食い違えばverifiedにしない", async () => {
    const cur = currentRows();
    const r = await runDetectionPipeline({
      transport: createRecordedFixtureTransport(exchanges()), tables: ["world_player_cards", "managers"], currentRows: cur,
      history: { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null }, fetchedAt: FETCHED_AT, now: NOW,
    });
    const tampered = r.plans.map((p) => (p.table === "managers" ? { ...p, report: { ...p.report, afterChecksum: "0".repeat(64) } } : p));
    const res = await runIsolatedDryRunApply(client, SCHEMA, tampered, r.stagings, cur);
    expect(res.verified).toBe(false);
    expect(res.problems.join()).toMatch(/managers: 適用後checksumが計画と一致しない/);
  });

  it("空でない隔離tableへの適用はrollbackして拒否する", async () => {
    const cur = currentRows();
    const r = await runDetectionPipeline({
      transport: createRecordedFixtureTransport(exchanges()), tables: ["managers"], currentRows: cur,
      history: { baselinePayloadBytes: null, appliedSourceChecksums: [], previousWorldMaxUpdatedAt: null, lastAppliedAt: null }, fetchedAt: FETCHED_AT, now: NOW,
    });
    await runIsolatedDryRunApply(client, SCHEMA, r.plans, r.stagings, cur);
    const count = async () => Number((await client.query(`select count(*)::int as n from ${SCHEMA}.managers`)).rows[0].n);
    const before = await count();
    const second = await runIsolatedDryRunApply(client, SCHEMA, r.plans, r.stagings, cur);
    expect(second.verified).toBe(false);
    expect(second.problems.join()).toMatch(/空ではない/);
    expect(await count()).toBe(before);
  });
});
