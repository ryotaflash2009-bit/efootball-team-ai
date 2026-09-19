import { describe, it, expect } from "vitest";
import { validateStagingRecords, findDuplicateIds, type RecordSchemaConfig } from "./schema-validation";
import type { StagingRecord } from "./types";

const CONFIG: RecordSchemaConfig = {
  idPattern: /^wc-\d+$/,
  requiredFields: ["nameEn", "ovrMax"],
  numericRanges: [{ field: "ovrMax", min: 40, max: 99 }],
  knownFields: ["nameEn", "ovrMax", "team"],
};

function rec(id: string, fields: Record<string, unknown>): StagingRecord {
  return { id, fields };
}

describe("validateStagingRecords", () => {
  it("正常なレコードはok:trueになる", () => {
    const result = validateStagingRecords([rec("wc-1", { nameEn: "A", ovrMax: 90, team: "X" })], CONFIG);
    expect(result.ok).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
  });

  it("ID形式不正を検出する", () => {
    const result = validateStagingRecords([rec("invalid-id", { nameEn: "A", ovrMax: 90 })], CONFIG);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.reason.includes("ID形式"))).toBe(true);
  });

  it("必須フィールド欠損を検出する(undefined/null/空文字)", () => {
    expect(validateStagingRecords([rec("wc-1", { ovrMax: 90 })], CONFIG).ok).toBe(false);
    expect(validateStagingRecords([rec("wc-1", { nameEn: null, ovrMax: 90 })], CONFIG).ok).toBe(false);
    expect(validateStagingRecords([rec("wc-1", { nameEn: "", ovrMax: 90 })], CONFIG).ok).toBe(false);
  });

  it("数値範囲外を検出する(OVR異常)", () => {
    const result = validateStagingRecords([rec("wc-1", { nameEn: "A", ovrMax: 150 })], CONFIG);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.reason.includes("範囲外"))).toBe(true);
  });

  it("未知フィールドを検出するが、それ自体ではok:falseにしない(呼び出し側のゲートで判断)", () => {
    const result = validateStagingRecords([rec("wc-1", { nameEn: "A", ovrMax: 90, newMysteryField: 1 })], CONFIG);
    expect(result.unknownFields).toEqual(["newMysteryField"]);
    expect(result.ok).toBe(true);
  });

  it("複数レコードのvalidCount/invalidCountを正しく集計する", () => {
    const result = validateStagingRecords(
      [rec("wc-1", { nameEn: "A", ovrMax: 90 }), rec("bad-id", { nameEn: "B", ovrMax: 90 })],
      CONFIG,
    );
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
  });
});

describe("findDuplicateIds", () => {
  it("重複がなければ空配列", () => {
    expect(findDuplicateIds([rec("wc-1", {}), rec("wc-2", {})])).toEqual([]);
  });

  it("重複IDを検出する", () => {
    expect(findDuplicateIds([rec("wc-1", {}), rec("wc-1", {}), rec("wc-2", {})])).toEqual(["wc-1"]);
  });
});
