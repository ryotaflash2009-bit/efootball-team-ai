import { describe, it, expect } from "vitest";
import { analyzeBuildAbilityImpact, type BuildAbilityImpactInput, type AbilityCardInput, type AbilitySiblingInput } from "./build-ability-impact";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";

function makeBaseStats(overrides: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of WORLD_STAT_KEYS) out[k] = 50;
  return { ...out, ...overrides };
}

function makeCard(overrides: Partial<AbilityCardInput> = {}): AbilityCardInput {
  return {
    worldCardId: "111",
    baseStats: makeBaseStats(),
    maximumLevel: 45,
    registeredPosition: "CF",
    ...overrides,
  };
}

function makeInput(overrides: Partial<BuildAbilityImpactInput> = {}): BuildAbilityImpactInput {
  return {
    progressionAllocation: {},
    calculatedStats: {},
    rulesVersionIsCurrent: true,
    card: makeCard(),
    siblings: [],
    ...overrides,
  };
}

describe("analyzeBuildAbilityImpact: 決定性・非破壊", () => {
  it("同じ入力から同じ結果を返す", () => {
    const input = makeInput({ progressionAllocation: { shooting: 5 } });
    expect(analyzeBuildAbilityImpact(input)).toEqual(analyzeBuildAbilityImpact(input));
  });

  it("JSON クローンしても同じ結果になる", () => {
    const input = makeInput({ progressionAllocation: { shooting: 5 }, calculatedStats: makeBaseStats({ finishing: 55 }) });
    const cloned = JSON.parse(JSON.stringify(input)) as BuildAbilityImpactInput;
    expect(analyzeBuildAbilityImpact(input)).toEqual(analyzeBuildAbilityImpact(cloned));
  });

  it("入力オブジェクトを変更しない", () => {
    const card = makeCard();
    const allocation = { shooting: 5 };
    const before = JSON.stringify(card);
    analyzeBuildAbilityImpact(makeInput({ card, progressionAllocation: allocation }));
    expect(JSON.stringify(card)).toBe(before);
    expect(allocation).toEqual({ shooting: 5 });
  });
});

describe("analyzeBuildAbilityImpact: 能力値データ", () => {
  it("カードが無い場合は available=false・取得不能を0や基礎値で代用しない", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ card: null }));
    expect(r.available).toBe(false);
    expect(r.baseAbilities).toBeNull();
    expect(r.trainedAbilities).toBeNull();
    expect(r.abilityDeltas).toBeNull();
    expect(r.confidenceReasons).toContain("ability-data-unavailable");
  });

  it("育成前能力値を正しく取得する", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ card: makeCard({ baseStats: makeBaseStats({ finishing: 70 }) }) }));
    expect(r.baseAbilities?.finishing).toBe(70);
  });

  it("育成配分に応じた育成後（trainedAbilities）が基礎値より高くなる", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ progressionAllocation: { shooting: 5 } }));
    expect(r.trainedAbilities?.finishing).toBeGreaterThan(r.baseAbilities?.finishing ?? 0);
  });

  it("保存時点の最終能力値（calculatedStats）と現在の再計算値を混同しない", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({ progressionAllocation: { shooting: 5 }, calculatedStats: makeBaseStats({ finishing: 999 % 100 }) }),
    );
    // finalAbilities は calculatedStats をそのまま使う（trainedAbilities とは別フィールド）
    expect(r.finalAbilities).not.toBe(r.trainedAbilities);
    expect(r.finalAbilities?.finishing).toBe(makeBaseStats({ finishing: 999 % 100 }).finishing);
  });

  it("配分が空でも取得不能を0として扱わない（calculatedStats が空なら finalAbilities は null）", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ calculatedStats: {} }));
    expect(r.finalAbilities).toBeNull();
    expect(r.confidenceReasons).toContain("ability-data-unavailable");
  });
});

describe("analyzeBuildAbilityImpact: 能力値差分", () => {
  it("最も伸びた能力を固定順で選ぶ（同点はWORLD_STAT_DEFS順）", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ progressionAllocation: { shooting: 5 } }));
    // shooting: finishing, setPieceTaking, curl が同じだけ伸びる（WORLD_STAT_DEFS順: finishing(7) < setPieceTaking(9) < curl(10)）
    const ids = r.largestGains.map((e) => e.abilityId);
    const idxFinishing = ids.indexOf("finishing");
    const idxCurl = ids.indexOf("curl");
    if (idxFinishing !== -1 && idxCurl !== -1) expect(idxFinishing).toBeLessThan(idxCurl);
  });

  it("最大件数を超えない", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ progressionAllocation: { shooting: 5, passing: 5, dribbling: 5, defending: 5 } }));
    expect(r.largestGains.length).toBeLessThanOrEqual(5);
    expect(r.smallestGains.length).toBeLessThanOrEqual(3);
    expect(r.highestFinalAbilities.length).toBeLessThanOrEqual(5);
    expect(r.lowestFinalAbilities.length).toBeLessThanOrEqual(5);
  });

  it("配分なしの場合、伸びた能力は0件（架空の伸びを作らない）", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ progressionAllocation: {} }));
    expect(r.largestGains.length).toBe(0);
    expect(r.smallestGains.length).toBe(0);
  });

  it("26能力値をすべて返すわけではない（本文への無制限列挙を避ける設計）", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ progressionAllocation: { shooting: 5 } }));
    expect(r.largestGains.length).toBeLessThan(26);
  });
});

describe("analyzeBuildAbilityImpact: 過剰投資候補", () => {
  it("単に最大配分というだけでは過剰投資としない（基礎値が低ければ候補にしない）", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({ progressionAllocation: { shooting: 10 }, card: makeCard({ baseStats: makeBaseStats({ finishing: 40, setPieceTaking: 40, curl: 40 }) }) }),
    );
    expect(r.overinvestmentFindings.length).toBe(0);
  });

  it("基礎値が高く・支配的な配分・他の選択肢がある場合に候補として検出する", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        progressionAllocation: { shooting: 10 },
        card: makeCard({ baseStats: makeBaseStats({ finishing: 90, setPieceTaking: 90, curl: 90 }) }),
      }),
    );
    expect(r.overinvestmentFindings.some((f) => f.code === "overinvestment-candidate" && f.groupId === "shooting")).toBe(true);
  });

  it("効率を公式値として表示するフィールドを持たない（内部評価は code ベースのみ）", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ progressionAllocation: { shooting: 10 } }));
    for (const f of r.overinvestmentFindings) {
      expect(typeof f.code).toBe("string");
      expect(f).not.toHaveProperty("efficiencyScore");
      expect(f).not.toHaveProperty("officialEfficiency");
    }
  });
});

describe("analyzeBuildAbilityImpact: 配分が少ない領域", () => {
  it("配分が少なくても最終能力値が高ければ弱点と断定しない", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        progressionAllocation: { shooting: 5 },
        calculatedStats: makeBaseStats({ heading: 85, jumping: 85, physicalContact: 85 }),
      }),
    );
    const aerial = r.underinvestmentFindings.find((f) => f.groupId === "aerialStrength");
    expect(aerial?.code).toBe("underinvested-but-high-final");
  });

  it("配分も最終能力値も低い場合は限定的な注意コードを出す", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        progressionAllocation: { shooting: 5 },
        calculatedStats: makeBaseStats({ heading: 40, jumping: 40, physicalContact: 40 }),
      }),
    );
    const aerial = r.underinvestmentFindings.find((f) => f.groupId === "aerialStrength");
    expect(aerial?.code).toBe("underinvested-and-low-final");
  });

  it("データ不足で判断できない場合は unknown コード", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ progressionAllocation: { shooting: 5 }, calculatedStats: {} }));
    const aerial = r.underinvestmentFindings.find((f) => f.groupId === "aerialStrength");
    expect(aerial?.code).toBe("underinvested-context-unknown");
  });

  it("配分が完全に無い場合は underinvestmentFindings を出さない（no-allocation は別の扱い）", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ progressionAllocation: {} }));
    expect(r.underinvestmentFindings.length).toBe(0);
  });
});

describe("analyzeBuildAbilityImpact: 別ビルド比較", () => {
  function sibling(overrides: Partial<AbilitySiblingInput> = {}): AbilitySiblingInput {
    return {
      buildId: "s1",
      buildName: "Sibling",
      progressionAllocation: { shooting: 5 },
      calculatedStats: makeBaseStats(),
      rulesVersionIsCurrent: true,
      ...overrides,
    };
  }

  it("能力値差が正しい方向で計算される", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        calculatedStats: makeBaseStats({ finishing: 80 }),
        siblings: [sibling({ calculatedStats: makeBaseStats({ finishing: 60 }) })],
      }),
    );
    const diff = r.comparisonDifferences[0].topDifferences.find((d) => d.abilityId === "finishing");
    expect(diff?.diff).toBe(20);
    expect(diff?.currentValue).toBe(80);
    expect(diff?.otherValue).toBe(60);
  });

  it("実質的に同じ能力構成を検出できる", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        calculatedStats: makeBaseStats(),
        siblings: [sibling({ calculatedStats: makeBaseStats() })],
      }),
    );
    expect(r.comparisonDifferences[0].classification).toBe("practically-same");
  });

  it("明確に異なる能力構成を検出できる", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        calculatedStats: makeBaseStats({ finishing: 90 }),
        siblings: [sibling({ calculatedStats: makeBaseStats({ finishing: 40 }) })],
      }),
    );
    expect(r.comparisonDifferences[0].classification).toBe("different-focus");
  });

  it("一方が配分なしでもクラッシュせず、条件差として記録する", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        progressionAllocation: {},
        calculatedStats: makeBaseStats(),
        siblings: [sibling({ progressionAllocation: { shooting: 5 }, calculatedStats: makeBaseStats() })],
      }),
    );
    expect(r.comparisonDifferences[0].conditionDifference).toBe("one-unallocated");
  });

  it("旧規則と現行規則の比較は条件差として記録する", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        rulesVersionIsCurrent: true,
        calculatedStats: makeBaseStats(),
        siblings: [sibling({ rulesVersionIsCurrent: false, calculatedStats: makeBaseStats() })],
      }),
    );
    expect(r.comparisonDifferences[0].conditionDifference).toBe("legacy-vs-current");
  });

  it("片方の能力値データが無い場合は insufficient-data とし、根拠なく優劣を断定しない", () => {
    const r = analyzeBuildAbilityImpact(
      makeInput({
        calculatedStats: makeBaseStats(),
        siblings: [sibling({ calculatedStats: {} })],
      }),
    );
    expect(r.comparisonDifferences[0].classification).toBe("insufficient-data");
    expect(r.comparisonDifferences[0].topDifferences.length).toBe(0);
  });

  it("同一カードだけを比較対象にする前提は呼び出し側が保証する（siblings 配列をそのまま使う）", () => {
    const r = analyzeBuildAbilityImpact(makeInput({ siblings: [sibling(), sibling({ buildId: "s2" })] }));
    expect(r.comparisonDifferences.map((c) => c.otherBuildId)).toEqual(["s1", "s2"]);
  });

  it("最大件数を超えない", () => {
    const many = Array.from({ length: 8 }, (_, i) => sibling({ buildId: `s${i}` }));
    const r = analyzeBuildAbilityImpact(makeInput({ siblings: many }));
    expect(r.comparisonDifferences.length).toBeLessThanOrEqual(5);
  });
});
