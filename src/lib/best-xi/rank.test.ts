import { describe, it, expect } from "vitest";
import { calculateBuild } from "@/lib/progression/engine";
import { emptyAllocation } from "@/lib/progression/engine";
import { MESSI_BIGTIME, CANNAVARO_EPIC, NEUER_GK } from "@/lib/progression/fixtures";
import type { ProgressionCard } from "@/lib/progression/types";
import { compareRankTuples, computeRankTuple } from "./rank";
import type { BestXiCandidate } from "./types";

function candidateFrom(card: ProgressionCard, worldCardId?: string, opts: Partial<BestXiCandidate> = {}): BestXiCandidate {
  const result = calculateBuild({ card, allocation: emptyAllocation(), selectedPlayerBoosters: [], selectedConditionalBoosters: [], manager: null });
  return {
    candidateKey: `${worldCardId ?? card.worldCardId}:base`,
    worldCardId: worldCardId ?? card.worldCardId,
    buildId: null,
    buildName: null,
    source: "base",
    nameJa: card.nameJa,
    nameEn: card.nameEn,
    registeredPosition: card.registeredPosition,
    ruleKind: "current",
    abilityStatus: "available",
    stats: result.stats,
    ownershipStatus: "owned",
    intendedPositions: null,
    ...opts,
  };
}

/** CB向けの重み表(defensiveAwareness/tacklingが同じ重み3)を利用した能力タイブレーク検証用カード。 */
function cbCard(worldCardId: string, overrides: Record<string, number>): ProgressionCard {
  return {
    worldCardId,
    nameEn: `CB ${worldCardId}`,
    nameJa: `CB ${worldCardId}`,
    registeredPosition: "CB",
    cardType: "BASE",
    ovrBase: 80,
    ovrMax: 90,
    maximumLevel: 20,
    boost1: 0,
    boost2: 0,
    baseStats: { ...MESSI_BIGTIME.baseStats, ...overrides },
  };
}

describe("computeRankTuple", () => {
  it("GK⇔フィールド不一致は eligible=false になる", () => {
    const { tuple } = computeRankTuple(candidateFrom(NEUER_GK), "CF");
    expect(tuple.eligible).toBe(false);
  });

  it("能力データ未取得の候補は eligible=false になる", () => {
    const c = candidateFrom(MESSI_BIGTIME);
    c.abilityStatus = "unavailable";
    c.stats = null;
    const { tuple } = computeRankTuple(c, "SS");
    expect(tuple.eligible).toBe(false);
  });

  it("positionRatingはスロットのポジションに応じて変わる(estimateOvrをそのまま利用)", () => {
    const messi = candidateFrom(MESSI_BIGTIME);
    const { tuple: asSS } = computeRankTuple(messi, "SS");
    const { tuple: asCB } = computeRankTuple(messi, "CB");
    expect(asSS.positionRating).not.toBeNull();
    expect(asCB.positionRating).not.toBeNull();
    // アタッカーの能力構成なのでSSの方がCBより評価が高いはず
    expect(asSS.positionRating!).toBeGreaterThan(asCB.positionRating!);
  });
});

describe("compareRankTuples", () => {
  it("eligibleな方が不適格より優先される", () => {
    const eligible = computeRankTuple(candidateFrom(CANNAVARO_EPIC), "CB").tuple;
    const ineligible = computeRankTuple(candidateFrom(NEUER_GK), "CB").tuple;
    expect(compareRankTuples(eligible, ineligible)).toBeLessThan(0);
  });

  it("同じ適格性ならexact(本職)がconditionalより優先される", () => {
    const exact = computeRankTuple(candidateFrom(CANNAVARO_EPIC), "CB").tuple; // 登録CB→スロットCB
    const conditional = computeRankTuple(candidateFrom(CANNAVARO_EPIC, "999"), "LB").tuple; // 登録CB→スロットLB
    expect(compareRankTuples(exact, conditional)).toBeLessThan(0);
  });

  it("同じ選手データからは常に同じ比較結果を返す(決定性)", () => {
    const a = computeRankTuple(candidateFrom(MESSI_BIGTIME), "SS").tuple;
    const b = computeRankTuple(candidateFrom(MESSI_BIGTIME), "SS").tuple;
    expect(compareRankTuples(a, b)).toBe(0);
  });

  it("完全に同点の場合はworldCardIdによる安定した並びになる(呼び出し順に依存しない)", () => {
    const low = computeRankTuple(candidateFrom(CANNAVARO_EPIC, "100"), "CB").tuple;
    const high = computeRankTuple(candidateFrom(CANNAVARO_EPIC, "200"), "CB").tuple;
    expect(compareRankTuples(low, high)).toBeLessThan(0);
    expect(compareRankTuples(high, low)).toBeGreaterThan(0);
  });

  it("positionRatingが完全に同点の場合、既存のPOSITION_WEIGHTSが最重視する能力値(CBならdefensiveAwareness)が高い方を優先する(新しい重みは作らない)", () => {
    // defensiveAwarenessとtacklingはCBの重み表で同じ重み(3)のため、2つの値を入れ替えても
    // 加重平均(positionRating)は変化しない。この場合だけ、重みが高い順に並べた実際の能力値を比較する。
    const higherDefAware = candidateFrom(cbCard("cb-a", { defensiveAwareness: 90, tackling: 80 }));
    const higherTackling = candidateFrom(cbCard("cb-b", { defensiveAwareness: 80, tackling: 90 }));
    const tupleA = computeRankTuple(higherDefAware, "CB").tuple;
    const tupleB = computeRankTuple(higherTackling, "CB").tuple;
    expect(tupleA.positionRating).toBe(tupleB.positionRating); // 前提: 加重平均は同点
    expect(compareRankTuples(tupleA, tupleB)).toBeLessThan(0); // defensiveAwarenessが高いAが優先される
  });

  it("能力タイブレークも同点なら、保存済み育成目的(intendedPositions)にスロットのポジションが含まれる方を補助的に優先する", () => {
    const withIntent = candidateFrom(CANNAVARO_EPIC, "300", { intendedPositions: ["CB"] });
    const withoutIntent = candidateFrom(CANNAVARO_EPIC, "301", { intendedPositions: null });
    const tupleWith = computeRankTuple(withIntent, "CB").tuple;
    const tupleWithout = computeRankTuple(withoutIntent, "CB").tuple;
    expect(compareRankTuples(tupleWith, tupleWithout)).toBeLessThan(0);
  });

  it("育成目的の一致は、実際のポジション別評価(positionRating)より優先されない(補助的根拠に留まる)", () => {
    // 評価が明確に低い方が育成目的一致でも、評価が高い方(育成目的なし)には勝てない。
    const lowRatingWithIntent = candidateFrom(cbCard("cb-low", { defensiveAwareness: 40, tackling: 40 }), undefined, {
      intendedPositions: ["CB"],
    });
    const highRatingNoIntent = candidateFrom(cbCard("cb-high", { defensiveAwareness: 95, tackling: 95 }));
    const tupleLow = computeRankTuple(lowRatingWithIntent, "CB").tuple;
    const tupleHigh = computeRankTuple(highRatingNoIntent, "CB").tuple;
    expect(compareRankTuples(tupleHigh, tupleLow)).toBeLessThan(0);
  });
});
