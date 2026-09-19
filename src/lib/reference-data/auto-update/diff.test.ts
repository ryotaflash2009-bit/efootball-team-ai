import { describe, it, expect } from "vitest";
import { computeDiff, computeRecordChecksum } from "./diff";
import type { PreviousSnapshot, StagingRecord } from "./types";

describe("computeRecordChecksum", () => {
  it("キー順が違っても同じchecksumになる", () => {
    const a = computeRecordChecksum({ a: 1, b: 2 });
    const b = computeRecordChecksum({ b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("値が違えばchecksumも変わる", () => {
    expect(computeRecordChecksum({ a: 1 })).not.toBe(computeRecordChecksum({ a: 2 }));
  });
});

describe("computeDiff", () => {
  const previous: PreviousSnapshot = {
    table: "world_player_cards",
    records: [
      { id: "wc-1", checksum: computeRecordChecksum({ ovrMax: 90 }) },
      { id: "wc-2", checksum: computeRecordChecksum({ ovrMax: 80 }) },
      { id: "wc-3", checksum: computeRecordChecksum({ ovrMax: 70 }) },
    ],
  };

  it("追加・更新・削除・不変を正しく分類する", () => {
    const candidate: StagingRecord[] = [
      { id: "wc-1", fields: { ovrMax: 90 } }, // unchanged
      { id: "wc-2", fields: { ovrMax: 85 } }, // updated
      { id: "wc-4", fields: { ovrMax: 60 } }, // added (wc-3 removed)
    ];
    const diff = computeDiff(previous, candidate);
    expect(diff.addedIds).toEqual(["wc-4"]);
    expect(diff.updatedIds).toEqual(["wc-2"]);
    expect(diff.removedIds).toEqual(["wc-3"]);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.previousCount).toBe(3);
    expect(diff.candidateCount).toBe(3);
  });

  it("完全一致(差分なし)の場合はすべて0件", () => {
    const candidate: StagingRecord[] = previous.records.map((r) => ({ id: r.id, fields: { ovrMax: 0 } }));
    // checksumを一致させるため、previousと同じ内容で再構成する
    const matching: StagingRecord[] = [
      { id: "wc-1", fields: { ovrMax: 90 } },
      { id: "wc-2", fields: { ovrMax: 80 } },
      { id: "wc-3", fields: { ovrMax: 70 } },
    ];
    const diff = computeDiff(previous, matching);
    expect(diff.addedCount).toBe(0);
    expect(diff.updatedCount).toBe(0);
    expect(diff.removedCount).toBe(0);
    expect(diff.unchangedCount).toBe(3);
    void candidate;
  });

  it("前回0件・今回全件は全件addedになる(初回投入相当)", () => {
    const empty: PreviousSnapshot = { table: "x", records: [] };
    const diff = computeDiff(empty, [{ id: "wc-1", fields: { a: 1 } }]);
    expect(diff.addedCount).toBe(1);
    expect(diff.previousCount).toBe(0);
  });
});
