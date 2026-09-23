import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assessWorldPaginationCompleteness,
  buildSourceSnapshot,
  buildStagingDataset,
  canonicalizeSourceRow,
  computeSourceRowChecksum,
  summarizeSnapshot,
  type SnapshotPageRecord,
  type SourceSnapshot,
} from "./source-snapshot";
import { createRecordedFixtureTransport, fetchSourceWithRetry, type SourceAttemptRecord } from "./source-transport";
import { buildWorldSearchRequest, normalizeWorldPlayerRecord, parseWorldSearchPage, toWorldSourceRow, type WorldSourceRow, type WorldRowRejection } from "./source-world";
import { buildManagersRequest, parseManagersDocument, toManagerSourceRow, type ManagerSourceRow, type ManagerRowRejection } from "./source-managers";

const FIX = path.join(__dirname, "__fixtures__", "source");
const worldPlayers = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: unknown[] }).players;
const managersBody = readFileSync(path.join(FIX, "managers-synthetic.json"), "utf8");
const FETCHED_AT = "2026-09-23T00:00:00.000Z";
const PAGE_SIZE = 3;
const noSleep = async () => {};

function worldPageBody(page: number, players: unknown[], over: Record<string, unknown> = {}): string {
  const totalPages = Math.ceil(worldPlayers.length / PAGE_SIZE);
  return JSON.stringify({ players, totalCount: worldPlayers.length, totalPages, pageSize: PAGE_SIZE, hasNext: page < totalPages, ...over });
}

/** 記録済みfixture transport経由でWorld full scanを行い、snapshotを作る(ネットワークなし)。 */
async function worldFullSnapshot(bodies: string[]): Promise<SourceSnapshot> {
  const exchanges = bodies.map((b, i) => ({
    request: buildWorldSearchRequest(i + 1, "CREATED_AT"),
    responses: [{ status: 200, headers: { "content-type": "application/json" }, bodyText: b }],
  }));
  const transport = createRecordedFixtureTransport(exchanges);
  const pages: SnapshotPageRecord[] = [];
  const attempts: SourceAttemptRecord[] = [];
  const rows: WorldSourceRow[] = [];
  const rejected: WorldRowRejection[] = [];
  for (let i = 0; i < bodies.length; i++) {
    const r = await fetchSourceWithRetry(transport, buildWorldSearchRequest(i + 1, "CREATED_AT"), { sleep: noSleep });
    attempts.push(...r.attempts);
    const page = parseWorldSearchPage(r.response.bodyText);
    pages.push({ page: i + 1, recordCount: page.players.length, contentHash: page.contentHash, bodyBytes: page.bodyBytes, totalCount: page.totalCount, totalPages: page.totalPages, hasNext: page.hasNext });
    for (const p of page.players) {
      const res = toWorldSourceRow(normalizeWorldPlayerRecord(p), FETCHED_AT);
      if (res.ok) rows.push(res.row);
      else rejected.push(res.rejection);
    }
  }
  expect(transport.calls.length).toBe(bodies.length);
  return buildSourceSnapshot({ table: "world_player_cards", scope: "full", fetchedAt: FETCHED_AT, pages, attempts, rows, rejected, expectedPageSize: PAGE_SIZE });
}

const completeBodies = () => [worldPageBody(1, worldPlayers.slice(0, 3)), worldPageBody(2, worldPlayers.slice(3, 6)), worldPageBody(3, worldPlayers.slice(6))];

describe("World full snapshot (recorded fixture transport)", () => {
  it("全pageを取得したsnapshotはcomplete。rejectedに識別不能な行があるとremoved検出は不可", async () => {
    const snap = await worldFullSnapshot(completeBodies());
    expect(snap.completeness.status).toBe("complete");
    expect(snap.completeness.receivedRecordCount).toBe(7);
    expect(snap.rows.length).toBe(3);
    expect(snap.completeness.rejectedCount).toBe(4);
    expect(snap.completeness.rejectedWithoutIdentityCount).toBe(1);
    expect(snap.removalDetectionAllowed).toBe(false);
    expect(snap.rows.map((r) => (r as WorldSourceRow).world_card_id)).toEqual(["900000000000001", "900000000000002", "900000000000003"]);
    expect(snap.attempts.length).toBe(3);
  });

  it("StagingDatasetはidentity順・入力順に依存しないchecksum・rejected identityを持つ", async () => {
    const a = buildStagingDataset(await worldFullSnapshot(completeBodies()));
    expect(a.rowCount).toBe(3);
    expect(a.sourceChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(a.rejectedIdentities).toEqual(["900000000000005", "900000000000006", "900000000000007"]);
    // 同じ内容を別の取得時刻・逆順で渡してもchecksumは同じ(fetched_atはvolatile)
    const snap = await worldFullSnapshot(completeBodies());
    const reordered = buildSourceSnapshot({
      table: "world_player_cards", scope: "full", fetchedAt: "2026-09-24T00:00:00Z", pages: snap.pages, attempts: [],
      rows: [...snap.rows].reverse().map((r) => ({ ...r, fetched_at: "2026-09-24T00:00:00.000Z" })), rejected: snap.rejected, expectedPageSize: PAGE_SIZE,
    });
    expect(buildStagingDataset(reordered).sourceChecksum).toBe(a.sourceChecksum);
  });

  it("paginationの途中停止・件数不一致・hasNext=true・途中の短いpageはincompleteでStagingDatasetを作れない", async () => {
    const cases: string[][] = [
      completeBodies().slice(0, 2),
      [worldPageBody(1, worldPlayers.slice(0, 3)), worldPageBody(2, worldPlayers.slice(3, 5)), worldPageBody(3, worldPlayers.slice(6))],
      [...completeBodies().slice(0, 2), worldPageBody(3, worldPlayers.slice(6), { hasNext: true })],
      [...completeBodies().slice(0, 2), worldPageBody(3, worldPlayers.slice(6), { totalCount: 8 })],
    ];
    for (const bodies of cases) {
      const snap = await worldFullSnapshot(bodies);
      expect(snap.completeness.status, snap.completeness.reasons.join()).toBe("incomplete");
      expect(snap.removalDetectionAllowed).toBe(false);
      expect(() => buildStagingDataset(snap)).toThrow(/不完全/);
    }
  });

  it("pagination判定の単体: page欠番・totalPages不明", () => {
    const base = { contentHash: "h", bodyBytes: 1, totalCount: 6, totalPages: 2, hasNext: false };
    expect(assessWorldPaginationCompleteness([], 3).reasons).toEqual(["pageを1件も取得していない"]);
    expect(assessWorldPaginationCompleteness([{ ...base, page: 2, recordCount: 3 }, { ...base, page: 1, recordCount: 3 }], 3).reasons.join()).toMatch(/連続していない/);
    expect(assessWorldPaginationCompleteness([{ ...base, page: 1, recordCount: 3, totalPages: null }], 3).reasons.join()).toMatch(/totalPagesが不明/);
    expect(assessWorldPaginationCompleteness([{ ...base, page: 1, recordCount: 3 }, { ...base, page: 2, recordCount: 3 }], 3).reasons).toEqual([]);
  });

  it("同一内容の重複は1件にまとめ、内容の異なる重複identityはblocked", async () => {
    const snap = await worldFullSnapshot(completeBodies());
    const dupSame = buildSourceSnapshot({
      table: "world_player_cards", scope: "incremental", fetchedAt: FETCHED_AT, attempts: [],
      pages: [{ page: 1, recordCount: 4, contentHash: "h", bodyBytes: 1, totalCount: null, totalPages: null, hasNext: null }],
      rows: [...snap.rows, snap.rows[0]], rejected: [],
    });
    expect(dupSame.completeness.identicalDuplicateCount).toBe(1);
    expect(dupSame.rows.length).toBe(3);
    expect(dupSame.completeness.status).toBe("complete");
    expect(dupSame.removalDetectionAllowed).toBe(false); // incrementalはremoved検出不可
    const conflicting = buildSourceSnapshot({
      table: "world_player_cards", scope: "incremental", fetchedAt: FETCHED_AT, attempts: [],
      pages: [{ page: 1, recordCount: 4, contentHash: "h", bodyBytes: 1, totalCount: null, totalPages: null, hasNext: null }],
      rows: [...snap.rows, { ...snap.rows[0], team: "Other FC" }], rejected: [],
    });
    expect(conflicting.completeness.conflictingDuplicateIdentities).toEqual(["900000000000001"]);
    expect(() => buildStagingDataset(conflicting)).toThrow(/内容の異なる/);
  });
});

describe("managers snapshot", () => {
  async function managersSnapshot(bodyText: string): Promise<SourceSnapshot> {
    const transport = createRecordedFixtureTransport([{ request: buildManagersRequest(), responses: [{ status: 200, headers: {}, bodyText }] }]);
    const r = await fetchSourceWithRetry(transport, buildManagersRequest(), { sleep: noSleep });
    const doc = parseManagersDocument(r.response.bodyText);
    const rows: ManagerSourceRow[] = [];
    const rejected: ManagerRowRejection[] = [];
    for (const m of doc.managers) {
      const res = toManagerSourceRow(m, FETCHED_AT);
      if (res.ok) rows.push(res.row);
      else rejected.push(res.rejection);
    }
    return buildSourceSnapshot({
      table: "managers", scope: "full", fetchedAt: FETCHED_AT, attempts: r.attempts, rows, rejected,
      pages: [{ page: 1, recordCount: doc.managers.length, contentHash: doc.contentHash, bodyBytes: doc.bodyBytes, totalCount: null, totalPages: null, hasNext: null }],
    });
  }

  it("1文書を取得したsnapshotはcompleteで、manager identity順に並ぶ", async () => {
    const snap = await managersSnapshot(managersBody);
    expect(snap.completeness.status).toBe("complete");
    expect(snap.rows.map((r) => (r as ManagerSourceRow).source_manager_id)).toEqual(["3", "synthetic-manager-1", "synthetic-manager-2"]);
    expect(snap.removalDetectionAllowed).toBe(false); // id不正でidentity不明の行がある
    const staging = buildStagingDataset(snap);
    expect(staging.identities[0]).toBe(JSON.stringify(["amine250", "3"]));
    expect(summarizeSnapshot(snap)).not.toHaveProperty("rows");
  });

  it("空配列はincomplete(既存行の全削除と誤判定しない)", async () => {
    const snap = await managersSnapshot("[]");
    expect(snap.completeness.status).toBe("incomplete");
    expect(() => buildStagingDataset(snap)).toThrow();
  });

  it("識別不能なrejectが無ければremoved検出を許可する", async () => {
    const good = JSON.stringify((JSON.parse(managersBody) as unknown[]).slice(0, 3));
    const snap = await managersSnapshot(good);
    expect(snap.completeness.status).toBe("complete");
    expect(snap.removalDetectionAllowed).toBe(true);
  });
});

describe("source row canonicalization", () => {
  it("列の欠落・想定外の列・非有限数はblocked", async () => {
    const snap = await worldFullSnapshot(completeBodies());
    const row = snap.rows[0] as WorldSourceRow;
    expect(() => canonicalizeSourceRow("world_player_cards", { ...row, extra: 1 })).toThrow(/想定外の列/);
    const { team: _team, ...missing } = row;
    void _team;
    expect(() => canonicalizeSourceRow("world_player_cards", missing)).toThrow(/無い/);
    expect(() => canonicalizeSourceRow("world_player_cards", { ...row, ovr_base: Number.NaN })).toThrow(/有限/);
    expect(computeSourceRowChecksum("world_player_cards", row)).toBe(computeSourceRowChecksum("world_player_cards", { ...row, fetched_at: "2030-01-01T00:00:00.000Z" }));
    expect(computeSourceRowChecksum("world_player_cards", row)).not.toBe(computeSourceRowChecksum("world_player_cards", { ...row, skills: [...(row.skills as string[])].reverse() }));
  });

  it("Evidence要約は本文・rowを含まずhashは短縮表示", async () => {
    const s = summarizeSnapshot(await worldFullSnapshot(completeBodies()));
    expect(String(s.rawContentHash).length).toBe(12);
    expect(JSON.stringify(s)).not.toMatch(/Synthetic/);
  });
});
