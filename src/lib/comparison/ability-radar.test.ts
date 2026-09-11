import { describe, it, expect } from "vitest";
import {
  buildAbilityRadarAxes,
  calculateAbilityCategoryAverage,
  buildComparisonRadarData,
  radarPointForAxis,
  statValueForMode,
  type RadarPlayerInput,
} from "./ability-radar";
import type { StatBreakdown } from "@/lib/progression/types";

function stat(key: string, over: Partial<StatBreakdown> = {}): StatBreakdown {
  const base = over.baseValue ?? 70;
  return {
    key,
    nameEn: key,
    group: "offense",
    baseValue: base,
    progressionDelta: 0,
    playerBoosterDelta: 0,
    managerBoosterDelta: 0,
    otherDelta: 0,
    uncappedValue: base,
    finalValue: base,
    capApplied: false,
    source: "base",
    confidence: "confirmed",
    gameMeasuredBoosterDelta: 0,
    externalVerifiedBoosterDelta: 0,
    conditionalBoosterDelta: 0,
    manualTrialBoosterDelta: 0,
    confirmedB2BoosterDelta: 0,
    experimentalPlayerBoosterDelta: 0,
    strictFinalValue: base,
    standardFinalValue: base,
    conditionalFinalValue: base,
    conditionalCapApplied: false,
    experimentalFinalValue: base,
    experimentalCapApplied: false,
    ...over,
  };
}

/** attack カテゴリ = offensiveAwareness / finishing / heading / setPieceTaking / curl */
const ATTACK_KEYS = ["offensiveAwareness", "finishing", "heading", "setPieceTaking", "curl"];

function attackStats(over: (k: string) => Partial<StatBreakdown> = () => ({})): StatBreakdown[] {
  return ATTACK_KEYS.map((k) => stat(k, over(k)));
}

describe("buildAbilityRadarAxes", () => {
  it("GK なしは 6 軸・GK ありは 7 軸", () => {
    expect(buildAbilityRadarAxes(false).map((a) => a.id)).not.toContain("gk");
    expect(buildAbilityRadarAxes(false)).toHaveLength(6);
    expect(buildAbilityRadarAxes(true).map((a) => a.id)).toContain("gk");
    expect(buildAbilityRadarAxes(true)).toHaveLength(7);
  });
  it("既存の COMPARE_CATEGORIES の statKeys をそのまま使う（独自重みなし）", () => {
    const attack = buildAbilityRadarAxes(false).find((a) => a.id === "attack")!;
    expect(attack.statKeys).toEqual(ATTACK_KEYS);
    expect(attack.shortLabel).toBe("SHT");
  });
});

describe("statValueForMode / calculateAbilityCategoryAverage", () => {
  it("モードごとに正しいレイヤーを選ぶ", () => {
    const s = stat("x", { baseValue: 70, progressionDelta: 10, standardFinalValue: 85, conditionalFinalValue: 87, experimentalFinalValue: 90 });
    expect(statValueForMode(s, "base")).toBe(70);
    expect(statValueForMode(s, "progressed")).toBe(80);
    expect(statValueForMode(s, "standard")).toBe(85);
    expect(statValueForMode(s, "conditional")).toBe(87);
    expect(statValueForMode(s, "experimental")).toBe(90);
  });
  it("カテゴリ単純平均（小数第1位・-0 正規化）", () => {
    const stats = attackStats(() => ({ baseValue: 80, standardFinalValue: 85 }));
    expect(calculateAbilityCategoryAverage(stats, ATTACK_KEYS, "base")).toBe(80);
    expect(calculateAbilityCategoryAverage(stats, ATTACK_KEYS, "standard")).toBe(85);
  });
  it("取得できない能力値は平均から除外・全滅なら null", () => {
    const partial = [stat("finishing", { baseValue: 90 })];
    expect(calculateAbilityCategoryAverage(partial, ATTACK_KEYS, "base")).toBe(90);
    expect(calculateAbilityCategoryAverage([], ATTACK_KEYS, "base")).toBeNull();
  });
});

describe("buildComparisonRadarData", () => {
  const players: RadarPlayerInput[] = [
    { index: 0, name: "A", cardType: "BIG TIME", worldCardId: "1", registeredPosition: "SS", stats: attackStats(() => ({ baseValue: 82, standardFinalValue: 88 })) },
    { index: 1, name: "B", cardType: "EPIC", worldCardId: "2", registeredPosition: "CB", stats: attackStats(() => ({ baseValue: 60, standardFinalValue: 62 })) },
  ];

  it("2 系列・GK なしなら 6 軸・mode 反映", () => {
    const d = buildComparisonRadarData(players, "standard");
    expect(d.series).toHaveLength(2);
    expect(d.axes).toHaveLength(6);
    const aAttack = d.series[0].points.find((p) => p.axisId === "attack")!;
    expect(aAttack.value).toBe(88);
    const aPre = d.series[0].prePoints.find((p) => p.axisId === "attack")!;
    expect(aPre.value).toBe(82); // 育成前 = 基礎
  });

  it("GK カードが含まれると GK 軸が出る", () => {
    const withGk = [...players, { index: 2, name: "GK", cardType: "POTW", worldCardId: "3", registeredPosition: "GK", stats: attackStats() }];
    expect(buildComparisonRadarData(withGk, "standard").axes.map((a) => a.id)).toContain("gk");
  });

  it("displayMax は既定 99・99 超過時に拡張し 99 で切り捨てて見せない", () => {
    const d0 = buildComparisonRadarData(players, "standard");
    expect(d0.displayMax).toBe(99);
    expect(d0.anyOver99).toBe(false);
    const over = [{ ...players[0], stats: attackStats(() => ({ baseValue: 82, standardFinalValue: 108 })) }];
    const d1 = buildComparisonRadarData(over, "standard");
    expect(d1.anyOver99).toBe(true);
    expect(d1.displayMax).toBeGreaterThanOrEqual(108);
    expect(d1.warnings.some((w) => w.includes("99"))).toBe(true);
  });

  it("注記に「ポジション別 OVR ではない」「26 能力値表で確認」を含む", () => {
    const d = buildComparisonRadarData(players, "standard");
    expect(d.notes.join(" ")).toContain("ポジション別 OVR");
    expect(d.notes.join(" ")).toContain("26 能力値表");
  });
});

describe("radarPointForAxis", () => {
  it("value=0 は中心・value=displayMax は半径いっぱい・12時方向から時計回り", () => {
    const c = radarPointForAxis(100, 100, 50, 0, 6, 0, 99);
    expect(c.x).toBeCloseTo(100);
    expect(c.y).toBeCloseTo(100);
    const top = radarPointForAxis(100, 100, 50, 0, 6, 99, 99);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50); // 真上
  });
  it("null / NaN / Infinity は中心（0 扱い）", () => {
    expect(radarPointForAxis(0, 0, 50, 1, 6, null, 99)).toEqual({ x: expect.closeTo(0, 5), y: expect.closeTo(0, 5) });
    expect(radarPointForAxis(0, 0, 50, 1, 6, Infinity, 99).x).toBeCloseTo(0);
  });
  it("displayMax を超える値はクランプ（グラフを突き抜けない）", () => {
    const p = radarPointForAxis(100, 100, 50, 0, 6, 200, 99);
    expect(p.y).toBeCloseTo(50); // 99 と同じ = 半径いっぱいで止まる
  });
});
