import { describe, it, expect } from "vitest";
import {
  computeBackupRowChecksum,
  computeBackupTableChecksum,
  computeBackupTotalChecksum,
  computeSourceMetadataChecksum,
  deriveSourceDatasetPairs,
} from "./backup-checksum";

describe("computeBackupRowChecksum / computeBackupTableChecksum", () => {
  it("列の取得順序に依存しない(決定的)", () => {
    const a = computeBackupRowChecksum({ b: 2, a: 1 });
    const b = computeBackupRowChecksum({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("行の並び順に依存しない(id順でソートしてから計算する)", () => {
    const rows1 = [{ id: "2", fields: { x: 2 } }, { id: "1", fields: { x: 1 } }];
    const rows2 = [{ id: "1", fields: { x: 1 } }, { id: "2", fields: { x: 2 } }];
    expect(computeBackupTableChecksum(rows1)).toBe(computeBackupTableChecksum(rows2));
  });

  it("1件でも値が異なればchecksumが変わる", () => {
    const rows1 = [{ id: "1", fields: { x: 1 } }];
    const rows2 = [{ id: "1", fields: { x: 2 } }];
    expect(computeBackupTableChecksum(rows1)).not.toBe(computeBackupTableChecksum(rows2));
  });

  it("空配列は空配列専用の一意なchecksumを返す(0件と1件を区別できる)", () => {
    const empty = computeBackupTableChecksum([]);
    const oneRow = computeBackupTableChecksum([{ id: "1", fields: { x: 1 } }]);
    expect(empty).not.toBe(oneRow);
  });
});

describe("computeBackupTotalChecksum", () => {
  it("テーブル名の順序に依存しない", () => {
    const a = computeBackupTotalChecksum({ managers: "m", world_player_cards: "w" });
    const b = computeBackupTotalChecksum({ world_player_cards: "w", managers: "m" });
    expect(a).toBe(b);
  });

  it("1テーブルのchecksumが変われば全体も変わる", () => {
    const a = computeBackupTotalChecksum({ managers: "m1", world_player_cards: "w" });
    const b = computeBackupTotalChecksum({ managers: "m2", world_player_cards: "w" });
    expect(a).not.toBe(b);
  });
});

describe("deriveSourceDatasetPairs / computeSourceMetadataChecksum", () => {
  it("重複するsource/dataset_versionの組は1件に集約される", () => {
    const pairs = deriveSourceDatasetPairs([
      { source: "efootball-world.com", dataset_version: "v1" },
      { source: "efootball-world.com", dataset_version: "v1" },
      { source: "efootball-world.com", dataset_version: "v2" },
    ]);
    expect(pairs.length).toBe(2);
  });

  it("source/dataset_versionが欠けている行は無視する", () => {
    const pairs = deriveSourceDatasetPairs([{ other: "x" }]);
    expect(pairs.length).toBe(0);
  });

  it("checksumはエントリの順序に依存しない", () => {
    const a = computeSourceMetadataChecksum([
      { tableName: "managers", sourceDatasetPairs: [{ source: "s", datasetVersion: "v1" }] },
      { tableName: "world_player_cards", sourceDatasetPairs: [{ source: "s", datasetVersion: "v2" }] },
    ]);
    const b = computeSourceMetadataChecksum([
      { tableName: "world_player_cards", sourceDatasetPairs: [{ source: "s", datasetVersion: "v2" }] },
      { tableName: "managers", sourceDatasetPairs: [{ source: "s", datasetVersion: "v1" }] },
    ]);
    expect(a).toBe(b);
  });
});
