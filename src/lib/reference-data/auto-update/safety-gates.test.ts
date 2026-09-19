import { describe, it, expect } from "vitest";
import {
  checkCountDelta,
  checkRemovedCount,
  checkNullRateIncrease,
  checkNoUnknownFields,
  checkAllTablesFetched,
  checkNoJobInProgress,
  checkLockAcquired,
  checkDatasetChecksumNotApplied,
  evaluateDiffGates,
} from "./safety-gates";
import type { DiffReport } from "./diff";

describe("checkCountDelta", () => {
  it("許容範囲内の増減はok", () => {
    expect(checkCountDelta(1000, 1000, 0.05, 0.1).ok).toBe(true);
    expect(checkCountDelta(1000, 960, 0.05, 0.1).ok).toBe(true);
    expect(checkCountDelta(1000, 1090, 0.05, 0.1).ok).toBe(true);
  });

  it("件数急減を拒否する", () => {
    const result = checkCountDelta(1000, 900, 0.05, 0.1);
    expect(result.ok).toBe(false);
  });

  it("件数急増を拒否する", () => {
    const result = checkCountDelta(1000, 1200, 0.05, 0.1);
    expect(result.ok).toBe(false);
  });

  it("前回0件・今回0件はok(変化なし)", () => {
    expect(checkCountDelta(0, 0, 0.05, 0.1).ok).toBe(true);
  });

  it("前回0件・今回件数ありは判定不能として拒否する(初回投入は別経路)", () => {
    expect(checkCountDelta(0, 10, 0.05, 0.1).ok).toBe(false);
  });
});

describe("checkRemovedCount", () => {
  it("上限以下はok", () => {
    expect(checkRemovedCount(5, 10).ok).toBe(true);
  });
  it("上限超過は拒否", () => {
    expect(checkRemovedCount(11, 10).ok).toBe(false);
  });
});

describe("checkNullRateIncrease", () => {
  it("増加が許容ポイント以内はok", () => {
    expect(checkNullRateIncrease(0.01, 0.02, 0.05).ok).toBe(true);
  });
  it("増加が許容ポイントを超えたら拒否", () => {
    expect(checkNullRateIncrease(0.01, 0.2, 0.05).ok).toBe(false);
  });
  it("NULL率が減少した場合もok", () => {
    expect(checkNullRateIncrease(0.2, 0.01, 0.05).ok).toBe(true);
  });
});

describe("checkNoUnknownFields", () => {
  it("空配列ならok", () => {
    expect(checkNoUnknownFields([]).ok).toBe(true);
  });
  it("未知フィールドがあれば拒否", () => {
    expect(checkNoUnknownFields(["mystery"]).ok).toBe(false);
  });
});

describe("checkAllTablesFetched", () => {
  it("全テーブル取得済みならok", () => {
    expect(checkAllTablesFetched(["a", "b"], ["a", "b"]).ok).toBe(true);
  });
  it("一部テーブルが未取得なら拒否(部分取得失敗)", () => {
    const result = checkAllTablesFetched(["a"], ["a", "b"]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("b");
  });
});

describe("checkNoJobInProgress", () => {
  it("実行中なら拒否", () => {
    expect(checkNoJobInProgress("running").ok).toBe(false);
  });
  it("idle/completed/failedは許可", () => {
    expect(checkNoJobInProgress("idle").ok).toBe(true);
    expect(checkNoJobInProgress("completed").ok).toBe(true);
    expect(checkNoJobInProgress("failed").ok).toBe(true);
  });
});

describe("checkLockAcquired", () => {
  it("ロック取得成功ならok", () => {
    expect(checkLockAcquired(true).ok).toBe(true);
  });
  it("ロック取得失敗なら拒否", () => {
    expect(checkLockAcquired(false).ok).toBe(false);
  });
});

describe("checkDatasetChecksumNotApplied", () => {
  it("未適用のchecksumはok", () => {
    expect(checkDatasetChecksumNotApplied("abc", new Set(["def"])).ok).toBe(true);
  });
  it("適用済みのchecksumは拒否(同一データの再適用防止)", () => {
    expect(checkDatasetChecksumNotApplied("abc", new Set(["abc"])).ok).toBe(false);
  });
});

describe("evaluateDiffGates", () => {
  const baseDiff: DiffReport = {
    table: "t",
    addedIds: [],
    removedIds: [],
    updatedIds: [],
    unchangedCount: 1000,
    addedCount: 0,
    removedCount: 0,
    updatedCount: 0,
    previousCount: 1000,
    candidateCount: 1000,
  };

  it("正常な差分は両ゲートともok", () => {
    const results = evaluateDiffGates(baseDiff, { maxDecreaseRatio: 0.05, maxIncreaseRatio: 0.1, maxRemovedCount: 50 });
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("大量削除は拒否される", () => {
    const diff: DiffReport = { ...baseDiff, removedCount: 999, candidateCount: 1, previousCount: 1000 };
    const results = evaluateDiffGates(diff, { maxDecreaseRatio: 0.05, maxIncreaseRatio: 0.1, maxRemovedCount: 50 });
    expect(results.some((r) => !r.ok)).toBe(true);
  });
});
