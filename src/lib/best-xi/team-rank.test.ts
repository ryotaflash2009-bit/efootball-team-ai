import { describe, it, expect } from "vitest";
import { compareTeamTuples } from "./team-rank";
import type { TeamSelectionRankTuple } from "./types";

function tuple(overrides: Partial<TeamSelectionRankTuple> = {}): TeamSelectionRankTuple {
  return {
    filledRequiredSlotCount: 11,
    exactSelectionCount: 11,
    relatedSelectionCount: 0,
    positionRatingsAscending: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
    completeAbilityDataCount: 11,
    intentPositionMatchCount: 0,
    stableTieBreakKey: "z",
    ...overrides,
  };
}

describe("compareTeamTuples", () => {
  it("優先度1: 埋まったスロット数が多い方を常に優先する(他の全指標が劣っていても)", () => {
    const moreFilled = tuple({ filledRequiredSlotCount: 10, exactSelectionCount: 0, positionRatingsAscending: [] });
    const fewerFilled = tuple({ filledRequiredSlotCount: 9, exactSelectionCount: 11, positionRatingsAscending: Array(9).fill(99) });
    expect(compareTeamTuples(moreFilled, fewerFilled)).toBeLessThan(0);
  });

  it("優先度2: 埋まった数が同じなら本職(exact)配置数が多い方を優先する", () => {
    const a = tuple({ exactSelectionCount: 8, relatedSelectionCount: 3 });
    const b = tuple({ exactSelectionCount: 6, relatedSelectionCount: 5 });
    expect(compareTeamTuples(a, b)).toBeLessThan(0);
  });

  it("優先度3: 埋まった数・本職数が同じなら同系統(related)配置数が少ない方を優先する", () => {
    const a = tuple({ relatedSelectionCount: 1 });
    const b = tuple({ relatedSelectionCount: 3 });
    expect(compareTeamTuples(a, b)).toBeLessThan(0);
  });

  it("優先度4(leximin): 1人だけ極端に高い評価があっても、他の弱いスロットを隠さない(合計ではなく最弱スロットから比較する)", () => {
    // 合計だけを見れば b の方が高い(100+100+60=260 > 90+90+90=270 は逆に成立してしまうため、
    // 明確に合計でも a が勝つケースを避け、あえて「弱いスロットの底上げ」が合計より優先されることを検証する。
    const raisedFloor = tuple({ positionRatingsAscending: [70, 90, 90] }); // 合計250・最弱70
    const oneExtremeValue = tuple({ positionRatingsAscending: [60, 60, 100] }); // 合計220・最弱60
    expect(compareTeamTuples(raisedFloor, oneExtremeValue)).toBeLessThan(0);

    // 合計だけならoneExtremeValueの方が有利になるよう作っても、leximinは底上げを優先する。
    const higherSumButLowFloor = tuple({ positionRatingsAscending: [50, 95, 95] }); // 合計240・最弱50
    const lowerSumButHigherFloor = tuple({ positionRatingsAscending: [65, 65, 65] }); // 合計195・最弱65
    expect(compareTeamTuples(lowerSumButHigherFloor, higherSumButLowFloor)).toBeLessThan(0);
  });

  it("優先度4(leximin): 最弱スロットが同点なら次に弱いスロットで比較する", () => {
    const a = tuple({ positionRatingsAscending: [70, 85, 90] });
    const b = tuple({ positionRatingsAscending: [70, 80, 95] });
    expect(compareTeamTuples(a, b)).toBeLessThan(0);
  });

  it("優先度5: 能力データを確認できた人数が多い方を優先する", () => {
    const a = tuple({ completeAbilityDataCount: 10 });
    const b = tuple({ completeAbilityDataCount: 8 });
    expect(compareTeamTuples(a, b)).toBeLessThan(0);
  });

  it("優先度6(補助的): 保存済み育成目的との一致人数が多い方を、他が同点の場合だけ優先する", () => {
    const a = tuple({ intentPositionMatchCount: 3 });
    const b = tuple({ intentPositionMatchCount: 1 });
    expect(compareTeamTuples(a, b)).toBeLessThan(0);
  });

  it("優先度7: 全て同点ならstableTieBreakKeyで決定的に順序付ける", () => {
    const a = tuple({ stableTieBreakKey: "a" });
    const b = tuple({ stableTieBreakKey: "b" });
    expect(compareTeamTuples(a, b)).toBeLessThan(0);
    expect(compareTeamTuples(b, a)).toBeGreaterThan(0);
  });

  it("完全に同一のタプルは0を返す", () => {
    expect(compareTeamTuples(tuple(), tuple())).toBe(0);
  });
});
