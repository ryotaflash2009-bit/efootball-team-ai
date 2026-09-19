import { describe, it, expect } from "vitest";
import { computeTombstoneCandidates, checkTombstoneCandidateCount, assertNoPhysicalDeletion } from "./tombstone";
import type { DiffReport } from "./diff";

function diffWithRemoved(removedIds: string[]): DiffReport {
  return {
    table: "world_player_cards",
    addedIds: [],
    removedIds,
    updatedIds: [],
    unchangedCount: 100,
    addedCount: 0,
    removedCount: removedIds.length,
    updatedCount: 0,
    previousCount: 100 + removedIds.length,
    candidateCount: 100,
  };
}

describe("computeTombstoneCandidates", () => {
  it("初回不在は物理削除候補にせず、追跡対象として1回とカウントする", () => {
    const result = computeTombstoneCandidates(diffWithRemoved(["wc-1"]), new Map(), 3);
    expect(result.readyForTombstone).toEqual([]);
    expect(result.stillTracking).toEqual([{ id: "wc-1", consecutiveMissingCount: 1 }]);
  });

  it("閾値に達したら無効化候補になる(物理削除ではない)", () => {
    const result = computeTombstoneCandidates(diffWithRemoved(["wc-1"]), new Map([["wc-1", 2]]), 3);
    expect(result.readyForTombstone).toEqual(["wc-1"]);
    expect(result.stillTracking).toEqual([]);
  });

  it("複数IDを正しく分類する", () => {
    const result = computeTombstoneCandidates(
      diffWithRemoved(["wc-1", "wc-2"]),
      new Map([["wc-1", 2]]),
      3,
    );
    expect(result.readyForTombstone).toEqual(["wc-1"]);
    expect(result.stillTracking).toEqual([{ id: "wc-2", consecutiveMissingCount: 1 }]);
  });
});

describe("checkTombstoneCandidateCount", () => {
  it("上限以下はok", () => {
    expect(checkTombstoneCandidateCount(5, 10).ok).toBe(true);
  });
  it("上限超過は拒否(大量削除候補の即reject)", () => {
    expect(checkTombstoneCandidateCount(11, 10).ok).toBe(false);
  });
});

describe("assertNoPhysicalDeletion", () => {
  it("DELETE/TRUNCATEを含まない文はok", () => {
    expect(assertNoPhysicalDeletion(["insert into target_records (record_id) values (?)"]).ok).toBe(true);
  });
  it("DELETE FROMを含む文は拒否", () => {
    expect(assertNoPhysicalDeletion(["delete from target_records where record_id = ?"]).ok).toBe(false);
  });
  it("TRUNCATEを含む文は拒否", () => {
    expect(assertNoPhysicalDeletion(["truncate table target_records"]).ok).toBe(false);
  });
});
