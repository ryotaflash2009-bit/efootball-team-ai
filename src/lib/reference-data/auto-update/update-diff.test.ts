import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildSourceSnapshot, buildStagingDataset, type SnapshotTable, type StagingDataset } from "./source-snapshot";
import { normalizeWorldPlayerRecord, toWorldSourceRow, type WorldRowRejection, type WorldSourceRow } from "./source-world";
import { toManagerSourceRow, type ManagerSourceRow } from "./source-managers";
import { buildInsertRow, computeUpdateDiff, mergeSourceIntoCurrent } from "./update-diff";
import { managerIdentity, validateUpdateDiffReport } from "./update-contract";

const FIX = path.join(__dirname, "__fixtures__", "source");
const FETCHED_AT = "2026-09-23T00:00:00.000Z";
const worldRaw = (JSON.parse(readFileSync(path.join(FIX, "world-players-synthetic.json"), "utf8")) as { players: unknown[] }).players;
const managersRaw = JSON.parse(readFileSync(path.join(FIX, "managers-synthetic.json"), "utf8")) as unknown[];

const worldResults = worldRaw.map((p) => toWorldSourceRow(normalizeWorldPlayerRecord(p), FETCHED_AT));
const worldRows = worldResults.flatMap((r) => (r.ok ? [r.row] : []));
const worldRejected = worldResults.flatMap((r) => (r.ok ? [] : [r.rejection]));
const managerRows = managersRaw.slice(0, 3).map((m) => {
  const r = toManagerSourceRow(m, FETCHED_AT);
  if (!r.ok) throw new Error("fixture");
  return r.row;
});

function staging(
  table: SnapshotTable,
  rows: readonly (WorldSourceRow | ManagerSourceRow)[],
  opts: { scope?: "full" | "incremental"; rejected?: WorldRowRejection[] } = {},
): StagingDataset {
  const rejected = opts.rejected ?? [];
  const n = rows.length + rejected.length;
  const world = table === "world_player_cards";
  return buildStagingDataset(
    buildSourceSnapshot({
      table, scope: opts.scope ?? "full", fetchedAt: FETCHED_AT, attempts: [], rows, rejected, expectedPageSize: n,
      pages: [{ page: 1, recordCount: n, contentHash: "h", bodyBytes: 1, totalCount: world ? n : null, totalPages: world ? 1 : null, hasNext: false }],
    }),
  );
}

/** Production形の現在行(fixture)。eFHUB由来列・insert時のみの列に値を持たせ、保持されることを確かめる。 */
function currentWorldRows(): Record<string, unknown>[] {
  return worldRows.map((r, i) => ({ ...buildInsertRow("world_player_cards", r), efhub_card_id: `efhub-${i}`, efhub_conflicts: [{ fieldName: "team", efhubValue: "A", worldValue: "B" }], dataset_version: "v0", import_batch_id: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }));
}
function currentManagerRows(): Record<string, unknown>[] {
  return managerRows.map((r, i) => ({ ...buildInsertRow("managers", r, 10 + i), name_ja: `監督${i}`, formation: "4-3-3" }));
}

describe("computeUpdateDiff: 基本分類", () => {
  it("現在行とsourceが同じなら全件unchanged・計画は空・before=after", () => {
    const plan = computeUpdateDiff({ table: "world_player_cards", currentRows: currentWorldRows(), staging: staging("world_player_cards", worldRows) });
    expect(plan.report.unchangedCount).toBe(3);
    expect(plan.inserts.length + plan.updates.length + plan.removedCandidates.length + plan.resurrected.length).toBe(0);
    expect(plan.report.beforeChecksum).toBe(plan.report.afterChecksum);
    expect(plan.blockingReasons).toEqual([]);
    expect(validateUpdateDiffReport(plan.report)).toEqual([]);
  });

  it("added・changed(変更列つき)・removed候補を分類し、removedは物理削除しない(afterに残る)", () => {
    const cur = currentWorldRows();
    cur[0] = { ...cur[0], team: "Old FC", ovr_max: 100 };
    const extra = { ...cur[2], world_card_id: "900000000000099", name_en: "Gone Player", name_sort_key: "gone player" };
    const plan = computeUpdateDiff({ table: "world_player_cards", currentRows: [cur[0], cur[1], extra], staging: staging("world_player_cards", worldRows) });
    expect(plan.inserts.map((r) => r.identity)).toEqual(["900000000000003"]);
    expect(plan.updates.map((u) => [u.identity, u.changedFields])).toEqual([["900000000000001", ["team", "ovr_max"]]]);
    expect(plan.removedCandidates).toEqual(["900000000000099"]);
    expect(plan.report).toMatchObject({ beforeCount: 3, afterCount: 4, addedCount: 1, changedCount: 1, removedCount: 1, unchangedCount: 1 });
    expect(plan.report.changedFieldNames).toEqual(["ovr_max", "team"]);
    expect(plan.report.sampleIdentifiers).toEqual(["900000000000003", "900000000000001", "900000000000099"]);
    expect(plan.removalDetection).toBe("performed");
  });

  it("計画を適用した後の状態で再度diffすると変更0(冪等)", () => {
    const cur = currentWorldRows().slice(1);
    cur[0] = { ...cur[0], skills: [] };
    const first = computeUpdateDiff({ table: "world_player_cards", currentRows: cur, staging: staging("world_player_cards", worldRows) });
    const applied = new Map(cur.map((r) => [r.world_card_id as string, r as Record<string, unknown>]));
    for (const r of [...first.inserts, ...first.updates]) applied.set(r.identity, { ...r.row });
    const second = computeUpdateDiff({ table: "world_player_cards", currentRows: [...applied.values()], staging: staging("world_player_cards", worldRows) });
    expect(second.inserts.length + second.updates.length).toBe(0);
    expect(second.report.beforeChecksum).toBe(first.report.afterChecksum);
  });
});

describe("computeUpdateDiff: 保持規則", () => {
  it("World: eFHUB由来列とpreserve列(ai_styles・appearance)は現在値を保持し、差があってもchangedにしない", () => {
    const cur = currentWorldRows();
    cur[0] = { ...cur[0], ai_styles: ["Old Style"], appearance: null };
    const plan = computeUpdateDiff({ table: "world_player_cards", currentRows: cur, staging: staging("world_player_cards", worldRows) });
    expect(plan.updates).toEqual([]);
    const merged = mergeSourceIntoCurrent("world_player_cards", cur[0], worldRows[0]);
    expect(merged.ai_styles).toEqual(["Old Style"]);
    expect(merged.appearance).toBeNull();
    expect(merged.efhub_card_id).toBe("efhub-0");
    expect(merged.fetched_at).toBe(FETCHED_AT);
  });

  it("World insert: eFHUB由来列はDDL既定値(null・[])、ai_styles/appearanceはsource値", () => {
    const plan = computeUpdateDiff({ table: "world_player_cards", currentRows: [], staging: staging("world_player_cards", worldRows) });
    const first = plan.inserts[0].row;
    expect(first.efhub_card_id).toBeNull();
    expect(first.efhub_conflicts).toEqual([]);
    expect(first.ai_styles).toEqual(["Long Ranger"]);
  });

  it("managers: internal_manager_idとinsert時のみの列を保持し、新規は既存最大+1からidentity順に採番", () => {
    const cur = currentManagerRows();
    const changedSource = { ...managerRows[0], possession_game: 1 };
    const plan = computeUpdateDiff({ table: "managers", currentRows: [cur[1], cur[2]], staging: staging("managers", [changedSource, managerRows[1], managerRows[2]]) });
    // cur[0](synthetic-manager-1)を除いたので新規1件。現在の最大は12 → 13。
    expect(plan.inserts.map((r) => [r.identity, r.row.internal_manager_id])).toEqual([[managerIdentity("amine250", "synthetic-manager-1"), 13]]);
    const upd = computeUpdateDiff({ table: "managers", currentRows: cur, staging: staging("managers", [changedSource, managerRows[1], managerRows[2]]) });
    expect(upd.updates.map((u) => u.changedFields)).toEqual([["possession_game"]]);
    expect(upd.updates[0].row).toMatchObject({ internal_manager_id: 10, name_ja: "監督0", formation: "4-3-3", possession_game: 1 });
  });
});

describe("computeUpdateDiff: removed検出の制限・resurrected・invalid", () => {
  it("incremental scopeではremoved検出をしない", () => {
    const plan = computeUpdateDiff({ table: "world_player_cards", currentRows: currentWorldRows(), staging: staging("world_player_cards", worldRows.slice(0, 1), { scope: "incremental" }) });
    expect(plan.removalDetection).toBe("skipped");
    expect(plan.removedCandidates).toEqual([]);
    expect(plan.report.unchangedCount).toBe(1);
  });

  it("identity不明のrejectがあるとremoved検出はskipped、rejectしたidentityはremovedにせずinvalidへ数える", () => {
    const cur = [...currentWorldRows(), { ...currentWorldRows()[0], world_card_id: "900000000000005" }];
    const withUnknown = computeUpdateDiff({ table: "world_player_cards", currentRows: cur, staging: staging("world_player_cards", worldRows, { rejected: worldRejected }) });
    expect(withUnknown.removalDetection).toBe("skipped");
    expect(withUnknown.report.invalidCount).toBe(4);
    const known = worldRejected.filter((r) => r.identity != null);
    const withKnown = computeUpdateDiff({ table: "world_player_cards", currentRows: cur, staging: staging("world_player_cards", worldRows, { rejected: known }) });
    expect(withKnown.removalDetection).toBe("performed");
    expect(withKnown.removedCandidates).toEqual([]);
    expect(withKnown.report.invalidCount).toBe(3);
  });

  it("tombstone済みidentityの再出現はresurrected(addedにもremovedにもしない)", () => {
    const plan = computeUpdateDiff({
      table: "world_player_cards", currentRows: currentWorldRows().slice(0, 2), staging: staging("world_player_cards", worldRows), tombstonedIdentities: ["900000000000003"],
    });
    expect(plan.resurrected.map((r) => r.identity)).toEqual(["900000000000003"]);
    expect(plan.inserts).toEqual([]);
    expect(plan.report.resurrectedCount).toBe(1);
  });
});

describe("computeUpdateDiff: 決定性・blocked", () => {
  it("現在行・source rowの入力順を変えても、report・計画checksumは同じ", () => {
    const cur = currentWorldRows();
    cur[1] = { ...cur[1], league: "Changed" };
    const a = computeUpdateDiff({ table: "world_player_cards", currentRows: cur, staging: staging("world_player_cards", worldRows) });
    const b = computeUpdateDiff({ table: "world_player_cards", currentRows: [...cur].reverse(), staging: staging("world_player_cards", [...worldRows].reverse()) });
    expect(b.report).toEqual(a.report);
    expect(b.planChecksum).toBe(a.planChecksum);
    expect(a.planChecksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("現在行の重複identity・契約外の列・欠落列はblocked", () => {
    const cur = currentWorldRows();
    const dup = computeUpdateDiff({ table: "world_player_cards", currentRows: [...cur, cur[0]], staging: staging("world_player_cards", worldRows) });
    expect(dup.blockingReasons.join()).toMatch(/重複identity/);
    expect(dup.report.duplicateCount).toBe(1);
    const drift = computeUpdateDiff({ table: "world_player_cards", currentRows: [{ ...cur[0], unknown_col: 1 }, cur[1], cur[2]], staging: staging("world_player_cards", worldRows) });
    expect(drift.report.schemaDriftCount).toBe(1);
    expect(drift.blockingReasons.join()).toMatch(/契約外の列/);
    const { team: _t, ...missing } = cur[0];
    void _t;
    const miss = computeUpdateDiff({ table: "world_player_cards", currentRows: [missing, cur[1], cur[2]], staging: staging("world_player_cards", worldRows) });
    expect(miss.report.schemaDriftCount).toBe(1);
    const bad = computeUpdateDiff({ table: "world_player_cards", currentRows: [{ ...cur[0], world_card_id: "abc" }], staging: staging("world_player_cards", worldRows) });
    expect(bad.report.invalidCount).toBe(1);
    expect(bad.blockingReasons.length).toBe(1);
  });

  it("StagingDatasetのtable不一致・新規managerのid不正はthrow", () => {
    expect(() => computeUpdateDiff({ table: "managers", currentRows: [], staging: staging("world_player_cards", worldRows) })).toThrow(/一致しない/);
    expect(() => buildInsertRow("managers", managerRows[0])).toThrow(/internal_manager_id/);
  });

  it("reportに行の値(名前など)を含めない", () => {
    const plan = computeUpdateDiff({ table: "managers", currentRows: [], staging: staging("managers", managerRows) });
    expect(JSON.stringify(plan.report)).not.toMatch(/Synthetic Manager/);
    expect(validateUpdateDiffReport(plan.report)).toEqual([]);
    expect(plan.report.addedCount).toBe(3);
    expect(plan.inserts.map((r) => r.row.internal_manager_id)).toEqual([1, 2, 3]);
  });
});
