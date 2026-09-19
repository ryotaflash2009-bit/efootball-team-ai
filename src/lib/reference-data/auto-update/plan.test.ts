import { describe, it, expect } from "vitest";
import { generateUpdatePlan } from "./plan";
import { computeRecordChecksum } from "./diff";
import type { RecordSchemaConfig } from "./schema-validation";
import type { PreviousSnapshot, StagingDataset } from "./types";

const SCHEMA: RecordSchemaConfig = {
  idPattern: /^wc-\d+$/,
  requiredFields: ["nameEn", "ovrMax"],
  numericRanges: [{ field: "ovrMax", min: 40, max: 99 }],
  knownFields: ["nameEn", "ovrMax"],
};

const THRESHOLDS = { maxDecreaseRatio: 0.05, maxIncreaseRatio: 0.1, maxRemovedCount: 50 };

function buildPrevious(count: number): PreviousSnapshot {
  return {
    table: "world_player_cards",
    records: Array.from({ length: count }, (_, i) => ({
      id: `wc-${i + 1}`,
      checksum: computeRecordChecksum({ nameEn: `Player ${i + 1}`, ovrMax: 80 }),
    })),
  };
}

function buildStaging(count: number, overrides?: (i: number) => Record<string, unknown>): StagingDataset {
  return {
    table: "world_player_cards",
    sourceMeta: {
      source: "efootball-world.com",
      sourceUrl: "https://efootball-world.com/api/proxy/v1/api/players/search",
      fetchedAt: "2026-09-19T00:00:00.000Z",
      httpStatus: 200,
      contentType: "application/json",
      contentLength: 1234,
    },
    records: Array.from({ length: count }, (_, i) => ({
      id: `wc-${i + 1}`,
      fields: overrides ? overrides(i) : { nameEn: `Player ${i + 1}`, ovrMax: 80 },
    })),
  };
}

describe("generateUpdatePlan", () => {
  it("正常な小差分はapply-candidateになり、書込みは常に0件", () => {
    const previous = buildPrevious(1000);
    const staging = buildStaging(1000, (i) => ({ nameEn: `Player ${i + 1}`, ovrMax: i === 0 ? 81 : 80 }));
    const plan = generateUpdatePlan({ staging, previous, schemaConfig: SCHEMA, diffThresholds: THRESHOLDS });
    expect(plan.decision).toBe("apply-candidate");
    expect(plan.writesPerformed).toBe(0);
    expect(plan.diff.updatedCount).toBe(1);
  });

  it("schema異常があればreject", () => {
    const previous = buildPrevious(3);
    const staging = buildStaging(3, () => ({ nameEn: "X", ovrMax: 999 }));
    const plan = generateUpdatePlan({ staging, previous, schemaConfig: SCHEMA, diffThresholds: THRESHOLDS });
    expect(plan.decision).toBe("reject");
    expect(plan.reasons.length).toBeGreaterThan(0);
  });

  it("重複IDがあればreject", () => {
    const previous = buildPrevious(2);
    const staging: StagingDataset = {
      ...buildStaging(2),
      records: [
        { id: "wc-1", fields: { nameEn: "A", ovrMax: 80 } },
        { id: "wc-1", fields: { nameEn: "B", ovrMax: 80 } },
      ],
    };
    const plan = generateUpdatePlan({ staging, previous, schemaConfig: SCHEMA, diffThresholds: THRESHOLDS });
    expect(plan.decision).toBe("reject");
    expect(plan.duplicateIds).toEqual(["wc-1"]);
  });

  it("件数急減はreject(大量削除事故の防止)", () => {
    const previous = buildPrevious(1000);
    const staging = buildStaging(1); // 999件削除相当
    const plan = generateUpdatePlan({ staging, previous, schemaConfig: SCHEMA, diffThresholds: THRESHOLDS });
    expect(plan.decision).toBe("reject");
  });

  it("未知フィールドが検出されたらreject", () => {
    const previous = buildPrevious(2);
    const staging = buildStaging(2, (i) => ({ nameEn: `P${i}`, ovrMax: 80, mysteryNewColumn: "x" }));
    const plan = generateUpdatePlan({ staging, previous, schemaConfig: SCHEMA, diffThresholds: THRESHOLDS });
    expect(plan.decision).toBe("reject");
    expect(plan.unknownFields).toContain("mysteryNewColumn");
  });

  it("extraGatesで渡した失敗(ロック未取得等)もreject理由に反映される", () => {
    const previous = buildPrevious(2);
    const staging = buildStaging(2);
    const plan = generateUpdatePlan({
      staging,
      previous,
      schemaConfig: SCHEMA,
      diffThresholds: THRESHOLDS,
      extraGates: [{ ok: false, reason: "直前のジョブが実行中のため中止(二重実行防止)" }],
    });
    expect(plan.decision).toBe("reject");
    expect(plan.reasons.some((r) => r.includes("二重実行防止"))).toBe(true);
  });
});
