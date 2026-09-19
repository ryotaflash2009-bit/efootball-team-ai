import { describe, it, expect } from "vitest";
import { compareAppliedResult } from "./shadow-comparison";
import type { StagingRecord } from "./types";

describe("compareAppliedResult", () => {
  it("期待値と実際が完全一致すればok", () => {
    const expected: StagingRecord[] = [{ id: "wc-1", fields: { ovrMax: 90 } }];
    const actual: StagingRecord[] = [{ id: "wc-1", fields: { ovrMax: 90 } }];
    const result = compareAppliedResult(expected, actual);
    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it("期待した行が実際に存在しなければ不一致", () => {
    const expected: StagingRecord[] = [{ id: "wc-1", fields: { ovrMax: 90 } }];
    const actual: StagingRecord[] = [];
    const result = compareAppliedResult(expected, actual);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0].reason).toMatch(/存在しない/);
  });

  it("フィールド内容が異なれば不一致(差分1件でも成功扱いにしない)", () => {
    const expected: StagingRecord[] = [{ id: "wc-1", fields: { ovrMax: 90 } }];
    const actual: StagingRecord[] = [{ id: "wc-1", fields: { ovrMax: 91 } }];
    const result = compareAppliedResult(expected, actual);
    expect(result.ok).toBe(false);
  });

  it("期待していない余分な行があれば不一致", () => {
    const expected: StagingRecord[] = [{ id: "wc-1", fields: { ovrMax: 90 } }];
    const actual: StagingRecord[] = [
      { id: "wc-1", fields: { ovrMax: 90 } },
      { id: "wc-2", fields: { ovrMax: 80 } },
    ];
    const result = compareAppliedResult(expected, actual);
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.id === "wc-2")).toBe(true);
  });
});
