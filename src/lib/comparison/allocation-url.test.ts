import { describe, it, expect } from "vitest";
import { serializeAllocations, parseAllocations, ALLOCATION_URL_MAX_LEN } from "./allocation-url";

describe("serializeAllocations", () => {
  it("全て空なら空文字（URL へ入れない）", () => {
    expect(serializeAllocations([null, null])).toBe("");
    expect(serializeAllocations([{}, undefined])).toBe("");
  });

  it("groupId~level を . 連結・区分は _ 連結・キー順で安定", () => {
    expect(serializeAllocations([{ passing: 3, shooting: 5 }, null, { defending: 2 }])).toBe(
      "passing~3.shooting~5__defending~2",
    );
  });

  it("末尾の空区分は落とす・中間の空区分は位置対応のため残す", () => {
    expect(serializeAllocations([{ shooting: 1 }, null, null])).toBe("shooting~1");
    expect(serializeAllocations([{ shooting: 1 }, null, { defending: 2 }])).toBe("shooting~1__defending~2");
  });

  it("未知 groupId / 0 / 負数 / 小数は落とす", () => {
    expect(serializeAllocations([{ shooting: 5, nope: 3, passing: 0, dribbling: -1, dexterity: 2.5 } as never])).toBe(
      "shooting~5",
    );
  });

  it("ALLOCATION_URL_MAX_LEN が正の整数（長さガードの定数）", () => {
    expect(Number.isInteger(ALLOCATION_URL_MAX_LEN)).toBe(true);
    expect(ALLOCATION_URL_MAX_LEN).toBeGreaterThan(100);
  });
});

describe("parseAllocations", () => {
  it("count 件返す・空区分は null", () => {
    expect(parseAllocations("shooting~5.passing~3__defending~2", 3)).toEqual([
      { shooting: 5, passing: 3 },
      null,
      { defending: 2 },
    ]);
  });

  it("不足区分は null 埋め", () => {
    expect(parseAllocations("shooting~5", 3)).toEqual([{ shooting: 5 }, null, null]);
  });

  it("未知 groupId / 非整数 / 0以下 / 範囲外を無視、有効値だけ残す", () => {
    expect(parseAllocations("nope~5.shooting~2.passing~0.dribbling~-3.dexterity~x.aerialStrength~999", 1)).toEqual([
      { shooting: 2 },
    ]);
  });

  it("全て無効な区分は null", () => {
    expect(parseAllocations("nope~5.bad~x", 1)).toEqual([null]);
  });

  it("空 / null 入力", () => {
    expect(parseAllocations("", 2)).toEqual([null, null]);
    expect(parseAllocations(null, 1)).toEqual([null]);
  });
});

describe("round-trip", () => {
  it("serialize → parse で一致", () => {
    const allocs: (Record<string, number> | null)[] = [
      { shooting: 5, dribbling: 2 },
      null,
      { defending: 3, goalkeeping1: 1 },
    ];
    const s = serializeAllocations(allocs)!;
    expect(parseAllocations(s, 3)).toEqual([
      { dribbling: 2, shooting: 5 },
      null,
      { defending: 3, goalkeeping1: 1 },
    ]);
  });
});
