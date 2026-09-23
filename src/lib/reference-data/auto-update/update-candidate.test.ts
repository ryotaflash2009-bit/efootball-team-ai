import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildSourceSnapshot, buildStagingDataset, type SnapshotTable, type StagingDataset } from "./source-snapshot";
import { normalizeWorldPlayerRecord, toWorldSourceRow, type WorldSourceRow } from "./source-world";
import { toManagerSourceRow, type ManagerSourceRow } from "./source-managers";
import { buildInsertRow, computeUpdateDiff } from "./update-diff";
import { buildUpdateCandidate, computeCandidatePayloadBytes, countPreservedColumnDrift, summarizeUpdateCandidate, type CandidateHistory } from "./update-candidate";
import { canTransition } from "./update-batch-state";
import { isSha256Hex } from "./update-contract";

const FIX = path.join(__dirname, "__fixtures__", "source");
const FETCHED_AT = "2026-09-23T00:00:00.000Z";
const NOW = "2026-09-23T12:00:00.000Z";
const worldRows = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: unknown[] }).players
  .map((p) => toWorldSourceRow(normalizeWorldPlayerRecord(p), FETCHED_AT))
  .flatMap((r) => (r.ok ? [r.row] : []));
const managerRows = (JSON.parse(readFileSync(path.join(FIX, "managers-synthetic.json"), "utf8")) as unknown[])
  .map((m) => toManagerSourceRow(m, FETCHED_AT))
  .flatMap((r) => (r.ok ? [r.row] : []));

function staging(table: SnapshotTable, rows: readonly (WorldSourceRow | ManagerSourceRow)[], scope: "full" | "incremental" = "full"): StagingDataset {
  const n = rows.length;
  const world = table === "world_player_cards";
  return buildStagingDataset(
    buildSourceSnapshot({
      table, scope, fetchedAt: FETCHED_AT, attempts: [], rows, rejected: [], expectedPageSize: n,
      pages: [{ page: 1, recordCount: n, contentHash: "h", bodyBytes: 1, totalCount: world ? n : null, totalPages: world ? 1 : null, hasNext: false }],
    }),
  );
}

const worldCurrent = (): Record<string, unknown>[] => worldRows.map((r) => ({ ...buildInsertRow("world_player_cards", r), dataset_version: "v0" }));
const managerCurrent = () => managerRows.map((r, i) => buildInsertRow("managers", r, i + 1));

const history = (over: Partial<CandidateHistory> = {}): CandidateHistory => ({
  baselinePayloadBytes: null,
  appliedSourceChecksums: [],
  previousWorldMaxUpdatedAt: null,
  lastAppliedAt: null,
  ...over,
});

function worldCandidate(current: Record<string, unknown>[], rows: WorldSourceRow[], h: CandidateHistory, scope: "full" | "incremental" = "full") {
  const s = staging("world_player_cards", rows, scope);
  const plan = computeUpdateDiff({ table: "world_player_cards", currentRows: current, staging: s });
  return buildUpdateCandidate({ plans: [plan], stagings: [s], currentRows: { world_player_cards: current }, history: h, now: NOW });
}

describe("buildUpdateCandidate", () => {
  it("変更なし・baselineあり・履歴正常ならpass(ただし自動applyはせずawaiting_review)", () => {
    const cur = worldCurrent();
    const payload = computeCandidatePayloadBytes([staging("world_player_cards", worldRows)]);
    const c = worldCandidate(cur, worldRows, history({ baselinePayloadBytes: payload }));
    expect(c.policy.severity).toBe("pass");
    expect(c.policy.findings).toEqual([]);
    expect(c.nextState).toBe("awaiting_review");
    expect(canTransition("diff_generated", c.nextState)).toBe(true);
    expect(isSha256Hex(c.sourceChecksum)).toBe(true);
    expect(isSha256Hex(c.idempotencyKey)).toBe(true);
    expect(c.targetTables).toEqual(["world_player_cards"]);
  });

  it("初回(baselineなし)はmanual review", () => {
    const c = worldCandidate(worldCurrent(), worldRows, history());
    expect(c.policy.severity).toBe("manual_review");
    expect(c.policy.findings.map((f) => f.code)).toContain("baseline_missing");
  });

  it("同じsource checksumの再適用・upstream更新時刻の後退はhard_block → policy_blocked", () => {
    const first = worldCandidate(worldCurrent(), worldRows, history({ baselinePayloadBytes: 1 }));
    const again = worldCandidate(worldCurrent(), worldRows, history({ baselinePayloadBytes: 1, appliedSourceChecksums: [first.sourceChecksum] }));
    expect(again.policy.findings.map((f) => f.code)).toContain("source_checksum_already_applied");
    expect(again.nextState).toBe("policy_blocked");
    expect(canTransition("diff_generated", again.nextState)).toBe(true);
    const regress = worldCandidate(worldCurrent(), worldRows, history({ baselinePayloadBytes: 1, previousWorldMaxUpdatedAt: "2027-01-01T00:00:00.000Z" }));
    expect(regress.policy.findings.map((f) => f.code)).toContain("source_timestamp_regression");
    expect(regress.policy.severity).toBe("hard_block");
  });

  it("diff計画がblockedならhard_block", () => {
    const cur = worldCurrent();
    const c = worldCandidate([...cur, cur[0]], worldRows, history({ baselinePayloadBytes: 1 }));
    expect(c.policy.findings.map((f) => f.code)).toEqual(expect.arrayContaining(["diff_plan_blocked", "duplicate_identity"]));
    expect(c.nextState).toBe("policy_blocked");
  });

  it("World件数の減少(removed)は閾値超でhard_block、incrementalはremoved検出skippedのwarning", () => {
    const cur = worldCurrent();
    const drop = worldCandidate(cur, worldRows.slice(0, 2), history({ baselinePayloadBytes: 1 }));
    expect(drop.policy.findings.map((f) => f.code)).toContain("unapproved_removal");
    const inc = worldCandidate(cur, worldRows.slice(0, 2), history({ baselinePayloadBytes: 1 }), "incremental");
    expect(inc.policy.findings.map((f) => f.code)).toContain("removal_detection_skipped");
    expect(inc.policy.severity).not.toBe("hard_block");
  });

  it("managerの変更はすべてmanual review、両tableの計画を1候補へまとめる", () => {
    const ws = staging("world_player_cards", worldRows);
    const ms = staging("managers", managerRows);
    const wp = computeUpdateDiff({ table: "world_player_cards", currentRows: worldCurrent(), staging: ws });
    const mp = computeUpdateDiff({ table: "managers", currentRows: managerCurrent().slice(1), staging: ms });
    const c = buildUpdateCandidate({ plans: [mp, wp], stagings: [ws, ms], currentRows: { world_player_cards: worldCurrent(), managers: managerCurrent().slice(1) }, history: history({ baselinePayloadBytes: computeCandidatePayloadBytes([ws, ms]) }), now: NOW });
    expect(c.targetTables).toEqual(["world_player_cards", "managers"]);
    expect(c.policy.findings.map((f) => f.code)).toContain("manager_change");
    expect(c.policy.severity).toBe("manual_review");
  });

  it("preserve列(ai_styles・appearance)のupstreamとの差はwarningで件数を示し、計画には含めない", () => {
    const cur = worldCurrent();
    cur[0] = { ...cur[0], ai_styles: ["Old"], appearance: null };
    const c = worldCandidate(cur, worldRows, history({ baselinePayloadBytes: computeCandidatePayloadBytes([staging("world_player_cards", worldRows)]) }));
    expect(c.preservedColumnDrift.world_player_cards).toEqual({ ai_styles: 1, appearance: 1 });
    expect(c.policy.findings.map((f) => [f.severity, f.code])).toEqual([["warning", "preserved_column_drift"]]);
    expect(countPreservedColumnDrift("managers", managerCurrent(), staging("managers", managerRows))).toEqual({});
  });

  it("候補rowに認証情報の兆候があればhard_block", () => {
    const tainted = worldRows.map((r, i) => (i === 0 ? { ...r, stats: { ...(r.stats as object), password: 1 } } : r));
    const c = worldCandidate(worldCurrent(), tainted as WorldSourceRow[], history({ baselinePayloadBytes: 1 }));
    expect(c.policy.findings.map((f) => f.code)).toContain("user_or_auth_data");
  });

  it("入力の不整合はthrow、Evidence要約は値を含まない", () => {
    const s = staging("world_player_cards", worldRows);
    const p = computeUpdateDiff({ table: "world_player_cards", currentRows: [], staging: s });
    expect(() => buildUpdateCandidate({ plans: [], stagings: [s], currentRows: {}, history: history(), now: NOW })).toThrow();
    expect(() => buildUpdateCandidate({ plans: [p, p], stagings: [s], currentRows: {}, history: history(), now: NOW })).toThrow(/複数/);
    expect(() => buildUpdateCandidate({ plans: [p], stagings: [], currentRows: {}, history: history(), now: NOW })).toThrow(/StagingDataset/);
    const summary = summarizeUpdateCandidate(buildUpdateCandidate({ plans: [p], stagings: [s], currentRows: {}, history: history(), now: NOW }));
    expect(JSON.stringify(summary)).not.toMatch(/Synthetic/);
    expect(String(summary.sourceChecksum).length).toBe(12);
  });

  it("同じ入力なら同じsource checksum・idempotency key(決定的)", () => {
    const a = worldCandidate(worldCurrent(), worldRows, history());
    const b = worldCandidate([...worldCurrent()].reverse(), [...worldRows].reverse(), history());
    expect(b.sourceChecksum).toBe(a.sourceChecksum);
    expect(b.idempotencyKey).toBe(a.idempotencyKey);
    expect(b.policy).toEqual(a.policy);
  });
});
