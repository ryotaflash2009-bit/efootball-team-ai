import { describe, it, expect } from "vitest";
import {
  buildBackupSnapshotEntries,
  checkSnapshotCountMatchesExpected,
  checkSnapshotExcludesUnrelatedRows,
  checkSnapshotOperationConsistency,
  evaluateSnapshotGates,
} from "./backup-snapshot";
import type { StagingRecord } from "./types";
import type { SourceMeta } from "./types";

const sourceMeta: SourceMeta = {
  source: "efootball-world.com",
  sourceUrl: "https://efootball-world.com/x",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  httpStatus: 200,
  contentType: "application/json",
  contentLength: 10,
};

describe("buildBackupSnapshotEntries", () => {
  it("既存IDはupdate、未存在IDはinsertとして分類する", () => {
    const targetRecords: StagingRecord[] = [
      { id: "wc-1", fields: { name_en: "A2" } },
      { id: "wc-2", fields: { name_en: "B" } },
    ];
    const existingBeforeRecords: StagingRecord[] = [{ id: "wc-1", fields: { name_en: "A" } }];
    const entries = buildBackupSnapshotEntries({
      jobId: "job-1",
      table: "world_player_cards",
      targetRecords,
      existingBeforeRecords,
      sourceMeta,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const byId = new Map(entries.map((e) => [e.recordId, e]));
    expect(byId.get("wc-1")?.operation).toBe("update");
    expect(byId.get("wc-1")?.beforeRow).toEqual({ name_en: "A" });
    expect(byId.get("wc-2")?.operation).toBe("insert");
    expect(byId.get("wc-2")?.beforeRow).toBeNull();
    expect(byId.get("wc-2")?.beforeChecksum).toBeNull();
  });

  it("無関係な行(existingBeforeRecordsにあってtargetRecordsに無いID)はentryへ含めない", () => {
    const targetRecords: StagingRecord[] = [{ id: "wc-1", fields: { name_en: "A2" } }];
    const existingBeforeRecords: StagingRecord[] = [
      { id: "wc-1", fields: { name_en: "A" } },
      { id: "wc-unrelated", fields: { name_en: "Z" } },
    ];
    const entries = buildBackupSnapshotEntries({
      jobId: "job-1",
      table: "world_player_cards",
      targetRecords,
      existingBeforeRecords,
      sourceMeta,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(entries.map((e) => e.recordId)).toEqual(["wc-1"]);
  });
});

describe("checkSnapshotCountMatchesExpected", () => {
  it("insert/update件数が期待値と一致すれば合格", () => {
    const entries = [
      { jobId: "j", table: "t", recordId: "1", operation: "insert" as const, beforeRow: null, beforeChecksum: null, sourceMeta, createdAt: "" },
      { jobId: "j", table: "t", recordId: "2", operation: "update" as const, beforeRow: {}, beforeChecksum: "x", sourceMeta, createdAt: "" },
    ];
    expect(checkSnapshotCountMatchesExpected(entries, 1, 1).ok).toBe(true);
    expect(checkSnapshotCountMatchesExpected(entries, 2, 1).ok).toBe(false);
    expect(checkSnapshotCountMatchesExpected(entries, 1, 2).ok).toBe(false);
  });
});

describe("checkSnapshotExcludesUnrelatedRows", () => {
  it("許可されたID集合外のrecordIdが含まれていれば拒否", () => {
    const entries = [
      { jobId: "j", table: "t", recordId: "1", operation: "insert" as const, beforeRow: null, beforeChecksum: null, sourceMeta, createdAt: "" },
    ];
    expect(checkSnapshotExcludesUnrelatedRows(entries, new Set(["1"])).ok).toBe(true);
    expect(checkSnapshotExcludesUnrelatedRows(entries, new Set(["2"])).ok).toBe(false);
  });
});

describe("checkSnapshotOperationConsistency", () => {
  it("updateにbeforeRowが無ければ拒否", () => {
    const entries = [
      { jobId: "j", table: "t", recordId: "1", operation: "update" as const, beforeRow: null, beforeChecksum: null, sourceMeta, createdAt: "" },
    ];
    expect(checkSnapshotOperationConsistency(entries).ok).toBe(false);
  });

  it("insertにbeforeRowが設定されていれば拒否", () => {
    const entries = [
      { jobId: "j", table: "t", recordId: "1", operation: "insert" as const, beforeRow: {}, beforeChecksum: "x", sourceMeta, createdAt: "" },
    ];
    expect(checkSnapshotOperationConsistency(entries).ok).toBe(false);
  });

  it("正しい組み合わせは合格", () => {
    const entries = [
      { jobId: "j", table: "t", recordId: "1", operation: "insert" as const, beforeRow: null, beforeChecksum: null, sourceMeta, createdAt: "" },
      { jobId: "j", table: "t", recordId: "2", operation: "update" as const, beforeRow: { a: 1 }, beforeChecksum: "x", sourceMeta, createdAt: "" },
    ];
    expect(checkSnapshotOperationConsistency(entries).ok).toBe(true);
  });
});

describe("evaluateSnapshotGates", () => {
  it("すべての条件を満たせば全ゲート合格", () => {
    const targetRecords: StagingRecord[] = [{ id: "wc-1", fields: { name_en: "A2" } }];
    const existingBeforeRecords: StagingRecord[] = [{ id: "wc-1", fields: { name_en: "A" } }];
    const entries = buildBackupSnapshotEntries({
      jobId: "job-1",
      table: "world_player_cards",
      targetRecords,
      existingBeforeRecords,
      sourceMeta,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const checks = evaluateSnapshotGates(entries, 0, 1, new Set(["wc-1"]));
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});
