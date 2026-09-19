import { describe, it, expect } from "vitest";
import { buildAuditLogEntry } from "./audit-log";
import { generateUpdatePlan } from "./plan";
import { computeRecordChecksum } from "./diff";
import type { RecordSchemaConfig } from "./schema-validation";
import type { PreviousSnapshot, StagingDataset } from "./types";

const SCHEMA: RecordSchemaConfig = {
  idPattern: /^wc-\d+$/,
  requiredFields: ["nameEn"],
  knownFields: ["nameEn"],
};
const THRESHOLDS = { maxDecreaseRatio: 0.05, maxIncreaseRatio: 0.1, maxRemovedCount: 50 };

function buildPlan() {
  const previous: PreviousSnapshot = {
    table: "world_player_cards",
    records: [{ id: "wc-1", checksum: computeRecordChecksum({ nameEn: "A" }) }],
  };
  const staging: StagingDataset = {
    table: "world_player_cards",
    sourceMeta: {
      source: "efootball-world.com",
      sourceUrl: "https://efootball-world.com/api/proxy/v1/api/players/search?token=SECRET123",
      fetchedAt: "2026-09-19T00:00:00.000Z",
      httpStatus: 200,
      contentType: "application/json",
      contentLength: 100,
    },
    records: [{ id: "wc-1", fields: { nameEn: "A" } }],
  };
  return { plan: generateUpdatePlan({ staging, previous, schemaConfig: SCHEMA, diffThresholds: THRESHOLDS }), sourceMeta: staging.sourceMeta };
}

describe("buildAuditLogEntry", () => {
  it("writesPerformed/deletedCount/tombstoneCountは常に0", () => {
    const { plan, sourceMeta } = buildPlan();
    const entry = buildAuditLogEntry(plan, sourceMeta, "2026-09-19T00:00:01.000Z");
    expect(entry.writesPerformed).toBe(0);
    expect(entry.deletedCount).toBe(0);
    expect(entry.tombstoneCount).toBe(0);
  });

  it("接続文字列らしきパターンやpostgres://は含まれない(存在しないため確認のみ)", () => {
    const { plan, sourceMeta } = buildPlan();
    const entry = buildAuditLogEntry(plan, sourceMeta, "2026-09-19T00:00:01.000Z");
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toMatch(/postgres(?:ql)?:\/\//);
    expect(serialized).not.toMatch(/service_role/i);
  });

  it("集計値がplanのdiffと一致する", () => {
    const { plan, sourceMeta } = buildPlan();
    const entry = buildAuditLogEntry(plan, sourceMeta, "2026-09-19T00:00:01.000Z");
    expect(entry.previousCount).toBe(plan.diff.previousCount);
    expect(entry.candidateCount).toBe(plan.diff.candidateCount);
    expect(entry.decision).toBe(plan.decision);
  });
});
