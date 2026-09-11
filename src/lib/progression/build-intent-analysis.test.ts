import { describe, it, expect } from "vitest";
import {
  analyzeBuildIntent,
  normalizeBuildIntent,
  hasMeaningfulIntent,
  emptyBuildIntent,
  resolveIntentOnCardChange,
  priorityGroupIds,
  secondaryPriorityGroupIds,
  lowerPriorityGroupIds,
  groupPriorityState,
  computeIntentReflectionStatus,
  MANY_PRIORITY_THRESHOLD,
  MOST_LOWER_PRIORITY_THRESHOLD,
  FREE_TEXT_MAX_LENGTH,
  type BuildIntentAnalysisInput,
  type BuildIntentInput,
  type IntentSiblingInput,
} from "./build-intent-analysis";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import { PROGRESSION_GROUPS } from "./stat-groups";
import type { GroupImpactEntry } from "./build-ability-impact";

function makeStats(overrides: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of WORLD_STAT_KEYS) out[k] = 50;
  return { ...out, ...overrides };
}

function makeGroupImpact(overrides: Partial<GroupImpactEntry>[] = []): GroupImpactEntry[] {
  return overrides.map((o) => ({ groupId: "shooting", allocatedLevel: 0, totalTrainedDelta: 0, reflectedInHighestFinal: false, ...o }));
}

function makeInput(overrides: Partial<BuildIntentAnalysisInput> = {}): BuildIntentAnalysisInput {
  return {
    intent: emptyBuildIntent(),
    allocation: {},
    groupImpact: [],
    abilityAvailable: true,
    baseAbilities: makeStats(),
    finalAbilities: makeStats(),
    abilityDeltas: {},
    remainingPoints: 10,
    totalPoints: 50,
    siblings: [],
    ...overrides,
  };
}

function intentWith(overrides: Partial<BuildIntentInput> = {}): BuildIntentInput {
  return { ...emptyBuildIntent(), ...overrides };
}

function sibling(overrides: Partial<IntentSiblingInput> = {}): IntentSiblingInput {
  return {
    buildId: "sib1",
    buildName: "Sibling",
    calculatedStats: makeStats(),
    conditionDifference: null,
    usedPointsDiff: null,
    calculatedOvrDiff: null,
    topAbilityDifferences: [],
    ...overrides,
  };
}

describe("normalizeBuildIntent", () => {
  it("空/未指定は安全な既定値になる", () => {
    const { intent, rejected } = normalizeBuildIntent(undefined);
    expect(intent).toEqual(emptyBuildIntent());
    expect(rejected).toEqual([]);
  });

  it("不正な primaryGoal は unspecified へ丸める", () => {
    const { intent } = normalizeBuildIntent({ primaryGoal: "not-a-real-goal" as never });
    expect(intent.primaryGoal).toBe("unspecified");
  });

  it("有効な groupId への priority/low 指定を保持する", () => {
    const { intent } = normalizeBuildIntent({ groupPriorities: { shooting: "priority", passing: "low" } });
    expect(intent.groupPriorities.shooting).toBe("priority");
    expect(intent.groupPriorities.passing).toBe("low");
  });

  it("無効な状態文字列は既定(通常)へ戻し、rejected に記録する", () => {
    const { intent, rejected } = normalizeBuildIntent({ groupPriorities: { shooting: "invalid" as never } });
    expect(intent.groupPriorities.shooting).toBeUndefined();
    expect(rejected.length).toBeGreaterThan(0);
  });

  it("未知の groupId は無視し、rejected に記録する", () => {
    const { intent, rejected } = normalizeBuildIntent({ groupPriorities: { notARealGroup: "priority" as never } });
    expect(Object.keys(intent.groupPriorities)).toEqual([]);
    expect(rejected.length).toBeGreaterThan(0);
  });

  it("全10領域を優先へ指定できる(最大件数の制限がない)", () => {
    const all: Record<string, string> = {};
    for (const g of PROGRESSION_GROUPS) all[g.groupId] = "priority";
    const { intent } = normalizeBuildIntent({ groupPriorities: all as never });
    expect(priorityGroupIds(intent).length).toBe(PROGRESSION_GROUPS.length);
  });

  it("同じ領域を優先と低優先へ同時登録できない(構造上、単一の値しか持てない)", () => {
    const intent = intentWith({ groupPriorities: { shooting: "priority" } });
    const overwritten: BuildIntentInput = { ...intent, groupPriorities: { ...intent.groupPriorities, shooting: "low" } };
    expect(priorityGroupIds(overwritten)).not.toContain("shooting");
    expect(lowerPriorityGroupIds(overwritten)).toContain("shooting");
  });

  it(`freeText は${FREE_TEXT_MAX_LENGTH}文字を超えると切り詰め、rejected に記録する`, () => {
    const long = "あ".repeat(FREE_TEXT_MAX_LENGTH + 10);
    const { intent, rejected } = normalizeBuildIntent({ freeText: long });
    expect(intent.freeText.length).toBe(FREE_TEXT_MAX_LENGTH);
    expect(rejected.some((r) => r.includes("freeText"))).toBe(true);
  });

  it("freeText の改行は保持される", () => {
    const { intent } = normalizeBuildIntent({ freeText: "1行目\n2行目" });
    expect(intent.freeText).toBe("1行目\n2行目");
  });

  it("非破壊: 元のオブジェクトを変更しない", () => {
    const raw = { groupPriorities: { shooting: "priority" as const } };
    const before = JSON.stringify(raw);
    normalizeBuildIntent(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });
});

describe("groupPriorityState / priorityGroupIds / lowerPriorityGroupIds", () => {
  it("未指定の領域は normal を返す", () => {
    expect(groupPriorityState(emptyBuildIntent(), "shooting")).toBe("normal");
  });

  it("priority/low を正しく振り分ける", () => {
    const intent = intentWith({ groupPriorities: { shooting: "priority", passing: "priority", aerialStrength: "low" } });
    expect(priorityGroupIds(intent)).toEqual(["shooting", "passing"]);
    expect(lowerPriorityGroupIds(intent)).toEqual(["aerialStrength"]);
  });
});

describe("computeIntentReflectionStatus", () => {
  it("未指定時はすべて not-specified", () => {
    const entries = computeIntentReflectionStatus(emptyBuildIntent());
    for (const e of entries) expect(e.status).toBe("not-specified");
  });

  it("主目的(固定マッピングあり)は used", () => {
    const entries = computeIntentReflectionStatus(intentWith({ primaryGoal: "dribbling" }));
    expect(entries.find((e) => e.field === "primaryGoal")?.status).toBe("used");
  });

  it("主目的が other の場合は display-only", () => {
    const entries = computeIntentReflectionStatus(intentWith({ primaryGoal: "other" }));
    expect(entries.find((e) => e.field === "primaryGoal")?.status).toBe("display-only");
  });

  it("主目的が press/counter の場合は limited-by-data", () => {
    const entries = computeIntentReflectionStatus(intentWith({ primaryGoal: "press" }));
    expect(entries.find((e) => e.field === "primaryGoal")?.status).toBe("limited-by-data");
  });

  it("使用予定ポジションは指定があっても常に reference-only", () => {
    const entries = computeIntentReflectionStatus(intentWith({ intendedPositions: ["RWF"] }));
    expect(entries.find((e) => e.field === "position")?.status).toBe("reference-only");
  });

  it("優先/低優先領域は1件以上あれば used", () => {
    const entries = computeIntentReflectionStatus(intentWith({ groupPriorities: { shooting: "priority", passing: "low" } }));
    expect(entries.find((e) => e.field === "priorityGroups")?.status).toBe("used");
    expect(entries.find((e) => e.field === "lowerPriorityGroups")?.status).toBe("used");
  });

  it("育成の狙い(自由記述)は入力があれば display-only、なければ not-specified(AI解析が未確定の場合)", () => {
    expect(computeIntentReflectionStatus(intentWith({ freeText: "test" })).find((e) => e.field === "freeText")?.status).toBe("display-only");
    expect(computeIntentReflectionStatus(emptyBuildIntent()).find((e) => e.field === "freeText")?.status).toBe("not-specified");
  });

  it("育成の狙いがAI解析で確定済み構造化意図へ反映されていれば used", () => {
    const status = computeIntentReflectionStatus(intentWith({ freeText: "test" }), { freeTextApplied: true });
    expect(status.find((e) => e.field === "freeText")?.status).toBe("used");
  });

  it("比較対象は実在する別ビルドとして解決できた場合のみ used", () => {
    const withTarget = intentWith({ comparisonTargetBuildId: "sib1" });
    expect(computeIntentReflectionStatus(withTarget).find((e) => e.field === "comparisonTarget")?.status).toBe("display-only");
    expect(computeIntentReflectionStatus(withTarget, { comparisonTargetResolved: true }).find((e) => e.field === "comparisonTarget")?.status).toBe("used");
    expect(computeIntentReflectionStatus(emptyBuildIntent()).find((e) => e.field === "comparisonTarget")?.status).toBe("not-specified");
  });

  it("avoidOverinvestmentGroupsは1件以上あればused", () => {
    const status = computeIntentReflectionStatus(intentWith({ avoidOverinvestmentGroups: ["lowerBodyStrength"] }));
    expect(status.find((e) => e.field === "avoidOverinvestmentGroups")?.status).toBe("used");
  });
});

describe("hasMeaningfulIntent", () => {
  it("空の入力は false", () => {
    expect(hasMeaningfulIntent(emptyBuildIntent())).toBe(false);
  });
  it("主目的のみでも true", () => {
    expect(hasMeaningfulIntent(intentWith({ primaryGoal: "scoring" }))).toBe(true);
  });
  it("優先領域のみでも true", () => {
    expect(hasMeaningfulIntent(intentWith({ groupPriorities: { shooting: "priority" } }))).toBe(true);
  });
});

describe("analyzeBuildIntent: 目的未指定", () => {
  it("目的が何も指定されていない場合は hasIntent=false・情報不足を返す", () => {
    const r = analyzeBuildIntent(makeInput());
    expect(r.hasIntent).toBe(false);
    expect(r.alignment).toBe("insufficient-information");
    expect(r.priorityAlignments).toEqual([]);
    expect(r.topIssue).toBeNull();
    expect(r.preserveHighlight).toBeNull();
  });

  it("決定的: 同一入力から同一出力", () => {
    const input = makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }), allocation: { shooting: 5 } });
    const r1 = analyzeBuildIntent(input);
    const r2 = analyzeBuildIntent(input);
    expect(r1).toEqual(r2);
  });

  it("非破壊: 入力オブジェクトを変更しない", () => {
    const input = makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }) });
    const before = JSON.stringify(input);
    analyzeBuildIntent(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("数値の架空スコア(score系プロパティ)は存在しない", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ primaryGoal: "scoring" }), allocation: { shooting: 5 } }));
    expect((r as unknown as Record<string, unknown>).score).toBeUndefined();
    expect((r as unknown as Record<string, unknown>).alignmentScore).toBeUndefined();
    expect((r as unknown as Record<string, unknown>).fitScore).toBeUndefined();
  });
});

describe("analyzeBuildIntent: 優先領域の一致状態(排他的な5段階)", () => {
  it("配分が最大優先レベルと同等以上・能力上昇ありなら strongly-aligned", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", passing: "priority" } }),
        allocation: { shooting: 10, passing: 9 },
        groupImpact: makeGroupImpact([
          { groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 8 },
          { groupId: "passing", allocatedLevel: 9, totalTrainedDelta: 5 },
        ]),
        abilityDeltas: { finishing: 8, lowPass: 5 },
      }),
    );
    const shooting = r.priorityAlignments.find((a) => a.groupId === "shooting");
    expect(shooting?.state).toBe("strongly-aligned");
  });

  it("配分はあるが最大優先レベルの半分未満なら present-but-underprioritized(単に配分が1以上あるだけでは十分一致にしない)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", passing: "priority" } }),
        allocation: { shooting: 10, passing: 2 },
        groupImpact: makeGroupImpact([
          { groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 8 },
          { groupId: "passing", allocatedLevel: 2, totalTrainedDelta: 1 },
        ]),
      }),
    );
    const passing = r.priorityAlignments.find((a) => a.groupId === "passing");
    expect(passing?.state).toBe("present-but-underprioritized");
    expect(passing?.state).not.toBe("strongly-aligned");
  });

  it("比率が半分〜80%未満は mostly-aligned", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", passing: "priority" } }),
        allocation: { shooting: 10, passing: 6 },
        groupImpact: makeGroupImpact([
          { groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 8 },
          { groupId: "passing", allocatedLevel: 6, totalTrainedDelta: 3 },
        ]),
      }),
    );
    const passing = r.priorityAlignments.find((a) => a.groupId === "passing");
    expect(passing?.state).toBe("mostly-aligned");
  });

  it("配分が0なら not-reflected", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }), allocation: {} }));
    expect(r.priorityAlignments[0].state).toBe("not-reflected");
  });

  it("能力データが不足していれば insufficient-data(配分があっても)", () => {
    const r = analyzeBuildIntent(
      makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }), allocation: { shooting: 10 }, abilityAvailable: false, abilityDeltas: null, baseAbilities: null, finalAbilities: null }),
    );
    expect(r.priorityAlignments[0].state).toBe("insufficient-data");
  });

  it("同一領域が一致状態と不足状態へ重複表示されない(1領域につき状態は1つだけ)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", passing: "priority" } }),
        allocation: { shooting: 10, passing: 2 },
      }),
    );
    const passingEntries = r.priorityAlignments.filter((a) => a.groupId === "passing");
    expect(passingEntries.length).toBe(1);
  });
});

describe("analyzeBuildIntent: 代表能力(能力値の具体例)", () => {
  it("上昇量が大きい能力を最大3件、同点はWORLD_STAT_DEFS固定順で選ぶ", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority" } }),
        allocation: { shooting: 10 },
        groupImpact: makeGroupImpact([{ groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 30 }]),
        abilityDeltas: { finishing: 11, setPieceTaking: 9, curl: 13 },
      }),
    );
    const shooting = r.priorityAlignments.find((a) => a.groupId === "shooting")!;
    expect(shooting.representativeAbilities.map((a) => a.abilityId)).toEqual(["curl", "finishing", "setPieceTaking"]);
    expect(shooting.representativeAbilities.length).toBeLessThanOrEqual(3);
  });

  it("上昇量0の能力は代表例に含めない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority" } }),
        allocation: { shooting: 10 },
        groupImpact: makeGroupImpact([{ groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 10 }]),
        abilityDeltas: { finishing: 10, setPieceTaking: 0, curl: 0 },
      }),
    );
    const shooting = r.priorityAlignments.find((a) => a.groupId === "shooting")!;
    expect(shooting.representativeAbilities).toEqual([{ abilityId: "finishing", delta: 10 }]);
  });

  it("配分が0の領域には代表能力を生成しない", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }), allocation: {} }));
    expect(r.priorityAlignments[0].representativeAbilities).toEqual([]);
  });
});

describe("analyzeBuildIntent: 一致している領域の統合表示", () => {
  it("同じ状態の複数優先領域を1つのグループへ統合する", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", dexterity: "priority" } }),
        allocation: { dribbling: 10, dexterity: 9 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 10, totalTrainedDelta: 8 },
          { groupId: "dexterity", allocatedLevel: 9, totalTrainedDelta: 6 },
        ]),
        abilityDeltas: { ballControl: 8, speed: 6 },
      }),
    );
    const strongGroup = r.alignedGroups.find((g) => g.state === "strongly-aligned");
    expect(strongGroup?.groupIds.sort()).toEqual(["dexterity", "dribbling"]);
  });
});

describe("analyzeBuildIntent: 目的に対する過剰配分", () => {
  it("優先外・高配分・育成前から高能力の3条件が揃った場合のみ発生する", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { passing: "priority" } }),
        allocation: { passing: 1, shooting: 12 },
        groupImpact: makeGroupImpact([
          { groupId: "passing", allocatedLevel: 1, totalTrainedDelta: 1 },
          { groupId: "shooting", allocatedLevel: 12, totalTrainedDelta: 12 },
        ]),
        baseAbilities: makeStats({ finishing: 90, setPieceTaking: 88, curl: 85 }),
      }),
    );
    const f = r.possibleOverinvestmentForIntent.find((x) => x.groupId === "shooting");
    expect(f).toBeTruthy();
    expect(typeof f?.params.abilityId).toBe("string");
    expect(f?.params.baseAverage).toBeGreaterThanOrEqual(70);
  });

  it("高配分だけ(育成前能力が低い)では過剰配分候補にならない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { passing: "priority" } }),
        allocation: { passing: 1, shooting: 12 },
        baseAbilities: makeStats({ finishing: 40, setPieceTaking: 40, curl: 40 }),
      }),
    );
    expect(r.possibleOverinvestmentForIntent.some((f) => f.groupId === "shooting")).toBe(false);
  });

  it("ユーザーが対象領域を優先指定している場合は過剰配分候補を生成しない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { passing: "priority", shooting: "priority" } }),
        allocation: { passing: 1, shooting: 12 },
        baseAbilities: makeStats({ finishing: 90 }),
      }),
    );
    expect(r.possibleOverinvestmentForIntent.some((f) => f.groupId === "shooting")).toBe(false);
  });

  it("禁止表現に相当するコード名(waste/useless 等)を含まない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { passing: "priority" } }),
        allocation: { passing: 1, shooting: 12 },
        baseAbilities: makeStats({ finishing: 90 }),
      }),
    );
    for (const f of r.possibleOverinvestmentForIntent) expect(f.code).not.toMatch(/waste|useless/);
  });
});

describe("analyzeBuildIntent: 5領域への分散", () => {
  it("優先領域に沿って複数領域へ配分している場合は問題として扱わない", () => {
    const allocation: Record<string, number> = { shooting: 3, passing: 3, dribbling: 3, dexterity: 3, lowerBodyStrength: 3 };
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", passing: "priority", dribbling: "priority", dexterity: "priority", lowerBodyStrength: "priority" } }),
        allocation,
        groupImpact: makeGroupImpact(Object.keys(allocation).map((groupId) => ({ groupId, allocatedLevel: 3, totalTrainedDelta: 2 }))),
      }),
    );
    expect(r.spreadNotAProblem?.code).toBe("intent-spread-not-a-problem");
  });

  it("優先外への大配分を伴う分散は spreadNotAProblem を生成しない", () => {
    const allocation: Record<string, number> = { shooting: 1, passing: 1, dribbling: 1, dexterity: 1, aerialStrength: 12 };
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority" } }),
        allocation,
        groupImpact: makeGroupImpact(Object.keys(allocation).map((groupId) => ({ groupId, allocatedLevel: allocation[groupId], totalTrainedDelta: 1 }))),
        baseAbilities: makeStats({ heading: 90, jumping: 88, physicalContact: 85 }),
      }),
    );
    expect(r.spreadNotAProblem).toBeNull();
  });
});

describe("analyzeBuildIntent: 低優先領域の統合", () => {
  it("低優先かつ配分ゼロの領域を1つのサマリーへ統合する", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: { goalkeeping1: "low", goalkeeping2: "low", goalkeeping3: "low" } }), allocation: {} }));
    expect(r.acceptableLowSummary?.lowPriorityGroupIds.sort()).toEqual(["goalkeeping1", "goalkeeping2", "goalkeeping3"]);
    expect(r.acceptableLowSummary?.excludedGroupIds).toEqual([]);
  });

  it("実際に低優先指定した領域だけを含める(未指定領域を含めない)", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: { goalkeeping1: "low" } }), allocation: {} }));
    expect(r.acceptableLowSummary?.lowPriorityGroupIds).toEqual(["goalkeeping1"]);
    expect(r.acceptableLowSummary?.lowPriorityGroupIds).not.toContain("aerialStrength");
  });

  it("低優先かつ意図的に評価対象外の領域は、低優先ではなく評価対象外へ分類する(重複計上しない)", () => {
    const r = analyzeBuildIntent(
      makeInput({ intent: intentWith({ groupPriorities: { defending: "low" }, intentionallyIgnoredGroups: ["defending"] }), allocation: {} }),
    );
    expect(r.acceptableLowSummary?.excludedGroupIds).toEqual(["defending"]);
    expect(r.acceptableLowSummary?.lowPriorityGroupIds).not.toContain("defending");
  });

  it("低優先領域がない場合は null", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ primaryGoal: "scoring" }), allocation: { shooting: 5 } }));
    expect(r.acceptableLowSummary).toBeNull();
  });

  it("低優先領域は目的とのズレ(改善候補)へ含めない", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority", aerialStrength: "low" } }), allocation: { shooting: 5 } }));
    expect(r.improvementPriorities.some((f) => f.groupId === "aerialStrength")).toBe(false);
  });

  it("参照異常やデータ不足の一般的な信頼度低下は低優先指定と独立している(confidenceReasonsは能力データ有無のみで決まる)", () => {
    const r = analyzeBuildIntent(
      makeInput({ intent: intentWith({ groupPriorities: { goalkeeping1: "low" } }), allocation: {}, abilityAvailable: false, abilityDeltas: null, baseAbilities: null, finalAbilities: null }),
    );
    expect(r.confidenceReasons).toContain("intent-insufficient-ability-data");
  });
});

describe("analyzeBuildIntent: 選択数のソフトな案内", () => {
  it(`優先領域が${MANY_PRIORITY_THRESHOLD}件以上で intent-priority-count-many を返す`, () => {
    const priorities: Record<string, "priority"> = {};
    for (const g of PROGRESSION_GROUPS.slice(0, MANY_PRIORITY_THRESHOLD)) priorities[g.groupId] = "priority";
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: priorities }) }));
    expect(r.priorityCountGuidance?.code).toBe("intent-priority-count-many");
  });

  it("全10領域を優先にすると intent-priority-count-all を返し、情報不足として扱う", () => {
    const priorities: Record<string, "priority"> = {};
    for (const g of PROGRESSION_GROUPS) priorities[g.groupId] = "priority";
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: priorities }) }));
    expect(r.priorityCountGuidance?.code).toBe("intent-priority-count-all");
    expect(r.alignment).toBe("insufficient-information");
  });

  it("優先0件でも主目的の固定マッピングがあれば分析される", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ primaryGoal: "scoring" }), allocation: { shooting: 5 }, groupImpact: makeGroupImpact([{ groupId: "shooting", allocatedLevel: 5, totalTrainedDelta: 3 }]) }));
    expect(r.effectivePriorityGroups).toContain("shooting");
    expect(r.priorityAlignments.some((a) => a.groupId === "shooting")).toBe(true);
  });

  it(`低優先領域が${MOST_LOWER_PRIORITY_THRESHOLD}件以上で intent-lower-priority-count-most を返す`, () => {
    const priorities: Record<string, "low"> = {};
    for (const g of PROGRESSION_GROUPS.slice(0, MOST_LOWER_PRIORITY_THRESHOLD)) priorities[g.groupId] = "low";
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: priorities, primaryGoal: "scoring" }), allocation: { shooting: 5 } }));
    expect(r.lowerPriorityCountGuidance?.code).toBe("intent-lower-priority-count-most");
  });
});

describe("analyzeBuildIntent: topIssue・改善優先順位・維持すべき長所", () => {
  it("topIssue は改善優先順位1位と同じ領域を指す(矛盾しない)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", passing: "priority" } }),
        allocation: { shooting: 10, passing: 1 },
      }),
    );
    expect(r.topIssue?.groupId).toBe(r.improvementPriorities[0]?.groupId);
  });

  it("問題がなければ topIssue は null", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority" } }),
        allocation: { shooting: 10 },
        groupImpact: makeGroupImpact([{ groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 5 }]),
        abilityDeltas: { finishing: 5 },
      }),
    );
    expect(r.topIssue).toBeNull();
  });

  it("維持すべき長所は最優先の改善対象と同じ領域にならない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", passing: "priority" } }),
        allocation: { shooting: 10, passing: 1 },
        groupImpact: makeGroupImpact([{ groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 5 }]),
        abilityDeltas: { finishing: 5 },
      }),
    );
    expect(r.preserveHighlight?.groupId).not.toBe(r.topIssue?.groupId);
    expect(r.preserveHighlight?.groupId).toBe("shooting");
  });
});

describe("analyzeBuildIntent: 別ビルド比較", () => {
  it("優先領域の能力が現在ビルドの方が高い場合は current-closer と具体的な差(最大3件)を返す", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority" } }),
        allocation: { shooting: 5 },
        finalAbilities: makeStats({ finishing: 80 }),
        siblings: [sibling({ calculatedStats: makeStats({ finishing: 50 }), topAbilityDifferences: [{ abilityId: "finishing", diff: 30 }] })],
      }),
    );
    expect(r.comparisonRecommendations[0].recommendation).toBe("current-closer");
    expect(r.comparisonRecommendations[0].keyDifferences.length).toBeGreaterThan(0);
    expect(r.comparisonRecommendations[0].keyDifferences[0].abilityId).toBe("finishing");
    expect(r.comparisonRecommendations[0].keyDifferences.length).toBeLessThanOrEqual(3);
  });

  it("差が小さい場合は similar とし、近い優先領域(closeGroups)を返す", () => {
    const r = analyzeBuildIntent(
      makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }), allocation: { shooting: 5 }, siblings: [sibling()] }),
    );
    expect(r.comparisonRecommendations[0].recommendation).toBe("similar");
    expect(r.comparisonRecommendations[0].closeGroups).toContain("shooting");
  });

  it("条件差がある場合は condition-differs とし、差分情報は空", () => {
    const r = analyzeBuildIntent(
      makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }), allocation: { shooting: 5 }, siblings: [sibling({ conditionDifference: "legacy-vs-current" })] }),
    );
    expect(r.comparisonRecommendations[0].recommendation).toBe("condition-differs");
    expect(r.comparisonRecommendations[0].keyDifferences).toEqual([]);
  });

  it("別ビルドがない場合に架空比較を生成しない", () => {
    const r = analyzeBuildIntent(makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }), siblings: [] }));
    expect(r.comparisonRecommendations).toEqual([]);
  });

  it("能力データ不足時は insufficient-data とする", () => {
    const r = analyzeBuildIntent(
      makeInput({ intent: intentWith({ groupPriorities: { shooting: "priority" } }), finalAbilities: makeStats(), siblings: [sibling({ calculatedStats: {} })] }),
    );
    expect(r.comparisonRecommendations[0].recommendation).toBe("insufficient-data");
  });
});

describe("resolveIntentOnCardChange", () => {
  it("パネルを閉じただけ(次カードが null)では現在の入力を変更しない", () => {
    const intent = intentWith({ primaryGoal: "scoring" });
    expect(resolveIntentOnCardChange(intent, "card-1", null)).toBe(intent);
  });

  it("同一カードの別ビルドへ切り替えたときは入力を引き継ぐ", () => {
    const intent = intentWith({ primaryGoal: "scoring", groupPriorities: { shooting: "priority" } });
    expect(resolveIntentOnCardChange(intent, "card-1", "card-1")).toBe(intent);
  });

  it("別カードへ切り替えたときは入力をリセットする", () => {
    const intent = intentWith({ primaryGoal: "scoring", groupPriorities: { shooting: "priority" } });
    expect(resolveIntentOnCardChange(intent, "card-1", "card-2")).toEqual(emptyBuildIntent());
  });

  it("初回分析開始(前カードが null)は空の状態から始まる", () => {
    expect(resolveIntentOnCardChange(emptyBuildIntent(), null, "card-1")).toEqual(emptyBuildIntent());
  });
});

describe("analyzeBuildIntent: 上げすぎたくない領域(avoidOverinvestmentGroups)", () => {
  it("配分実績+育成前の高さが揃えば、優先度の閾値に関わらずintent-avoid-overinvestment-triggeredを生成する", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority" }, avoidOverinvestmentGroups: ["lowerBodyStrength"] }),
        allocation: { dribbling: 3, lowerBodyStrength: 2 },
        baseAbilities: makeStats({ kickingPower: 85, balance: 80, stamina: 78 }),
      }),
    );
    expect(r.avoidOverinvestmentFindings.some((f) => f.groupId === "lowerBodyStrength")).toBe(true);
  });

  it("同じ領域を一般の過剰配分候補として重複指摘しない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority" }, avoidOverinvestmentGroups: ["lowerBodyStrength"] }),
        allocation: { dribbling: 3, lowerBodyStrength: 2 },
        baseAbilities: makeStats({ kickingPower: 85, balance: 80, stamina: 78 }),
      }),
    );
    expect(r.possibleOverinvestmentForIntent.some((f) => f.groupId === "lowerBodyStrength")).toBe(false);
  });

  it("育成前能力が低い場合は生成しない(配分があるだけでは指摘しない)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ avoidOverinvestmentGroups: ["lowerBodyStrength"] }),
        allocation: { lowerBodyStrength: 5 },
        baseAbilities: makeStats({ kickingPower: 40, balance: 40, stamina: 40 }),
      }),
    );
    expect(r.avoidOverinvestmentFindings).toEqual([]);
  });

  it("topIssue・改善優先順位へ反映される", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority" }, avoidOverinvestmentGroups: ["lowerBodyStrength"] }),
        allocation: { dribbling: 10, lowerBodyStrength: 2 },
        groupImpact: makeGroupImpact([{ groupId: "dribbling", allocatedLevel: 10, totalTrainedDelta: 5 }]),
        abilityDeltas: { ballControl: 5 },
        baseAbilities: makeStats({ kickingPower: 85, balance: 80, stamina: 78 }),
      }),
    );
    expect(r.topIssue?.kind).toBe("avoid-overinvestment");
    expect(r.topIssue?.groupId).toBe("lowerBodyStrength");
  });
});

describe("analyzeBuildIntent: 意図的に捨てる領域(intentionallyIgnoredGroups)", () => {
  it("既存の低優先(low)指定と、今回は評価対象外(intentionallyIgnored)指定は、分類を分けたまま1つのサマリーへ含まれる", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { goalkeeping1: "low" }, intentionallyIgnoredGroups: ["aerialStrength", "defending"] }),
        allocation: {},
      }),
    );
    expect(r.acceptableLowSummary?.lowPriorityGroupIds).toEqual(["goalkeeping1"]);
    expect(r.acceptableLowSummary?.excludedGroupIds.sort()).toEqual(["aerialStrength", "defending"]);
  });

  it("同じ領域が両方に指定されても重複計上しない(評価対象外を優先し、低優先一覧には出さない)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { aerialStrength: "low" }, intentionallyIgnoredGroups: ["aerialStrength"] }),
        allocation: {},
      }),
    );
    expect(r.acceptableLowSummary?.excludedGroupIds).toEqual(["aerialStrength"]);
    expect(r.acceptableLowSummary?.lowPriorityGroupIds).not.toContain("aerialStrength");
  });

  it("意図的に捨てる領域は一般の過剰配分候補から除外される", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority" }, intentionallyIgnoredGroups: ["aerialStrength"] }),
        allocation: { dribbling: 1, aerialStrength: 10 },
        baseAbilities: makeStats({ heading: 90, jumping: 88, physicalContact: 85 }),
      }),
    );
    expect(r.possibleOverinvestmentForIntent.some((f) => f.groupId === "aerialStrength")).toBe(false);
  });
});

describe("analyzeBuildIntent: 維持したい長所(strengthsToPreserve)", () => {
  it("strengthsToPreserveに含まれる一致領域を優先してpreserveHighlightに選ぶ", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", dribbling: "priority" }, strengthsToPreserve: ["dribbling"] }),
        allocation: { shooting: 10, dribbling: 10 },
        groupImpact: makeGroupImpact([
          { groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 5 },
          { groupId: "dribbling", allocatedLevel: 10, totalTrainedDelta: 5 },
        ]),
        abilityDeltas: { finishing: 5, ballControl: 5 },
      }),
    );
    expect(r.preserveHighlight?.groupId).toBe("dribbling");
  });
});

describe("analyzeBuildIntent: 比較意図(comparisonTargetBuildId / comparisonFocusGroups)", () => {
  it("実在する比較対象を先頭へ並べ、isUserComparisonTargetを付与する", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority" }, comparisonTargetBuildId: "sib2" }),
        allocation: { shooting: 5 },
        siblings: [sibling({ buildId: "sib1", buildName: "S1" }), sibling({ buildId: "sib2", buildName: "S2" })],
      }),
    );
    expect(r.comparisonRecommendations[0].otherBuildId).toBe("sib2");
    expect(r.comparisonRecommendations[0].isUserComparisonTarget).toBe(true);
    expect(r.comparisonRecommendations[1].isUserComparisonTarget).toBe(false);
  });

  it("存在しない比較対象IDはlimitationsへ記録され、架空の比較を行わない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority" }, comparisonTargetBuildId: "does-not-exist" }),
        allocation: { shooting: 5 },
        siblings: [sibling({ buildId: "sib1", buildName: "S1" })],
      }),
    );
    expect(r.limitations).toContain("intent-comparison-target-not-found");
    expect(r.comparisonRecommendations.every((c) => !c.isUserComparisonTarget)).toBe(true);
  });

  it("comparisonFocusGroupsは比較対象ビルドのkeyDifferences選定にのみ影響する", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority" }, comparisonTargetBuildId: "sib1", comparisonFocusGroups: ["passing"] }),
        allocation: { shooting: 5 },
        finalAbilities: makeStats({ finishing: 80, lowPass: 80 }),
        siblings: [
          sibling({ buildId: "sib1", buildName: "S1", calculatedStats: makeStats({ finishing: 50, lowPass: 40 }), topAbilityDifferences: [{ abilityId: "lowPass", diff: 40 }] }),
        ],
      }),
    );
    expect(r.comparisonRecommendations[0].keyDifferences.some((d) => d.abilityId === "lowPass")).toBe(true);
  });
});

describe("優先度モデル(4段階: priority/secondary/normal/low)", () => {
  it("secondaryPriorityGroupIds: secondary指定領域のみを返す", () => {
    const intent = intentWith({ groupPriorities: { shooting: "priority", dribbling: "secondary", passing: "low" } });
    expect(secondaryPriorityGroupIds(intent)).toEqual(["dribbling"]);
  });

  it("normalizeBuildIntent: secondaryを保持する", () => {
    const { intent } = normalizeBuildIntent({ groupPriorities: { dribbling: "secondary" } });
    expect(intent.groupPriorities.dribbling).toBe("secondary");
  });

  it("hasMeaningfulIntent: secondary指定のみでもtrue", () => {
    expect(hasMeaningfulIntent(intentWith({ groupPriorities: { dribbling: "secondary" } }))).toBe(true);
  });

  it("同一領域は優先度を1つだけ持つ(groupPrioritiesは1キー1値の構造)", () => {
    const { intent } = normalizeBuildIntent({ groupPriorities: { dribbling: "secondary" } });
    // 型として groupId → 単一の GroupPriorityState しか保持できない(構造上、複数値を同時に持てない)。
    expect(Object.keys(intent.groupPriorities).filter((k) => k === "dribbling").length).toBe(1);
  });

  it("computeIntentReflectionStatus: secondaryPriorityGroupsは1件以上あればused", () => {
    const status = computeIntentReflectionStatus(intentWith({ groupPriorities: { dribbling: "secondary" } }));
    expect(status.find((e) => e.field === "secondaryPriorityGroups")?.status).toBe("used");
  });

  it("computeIntentReflectionStatus: strengthsToPreserveはpreserveConfirmedがtrueの場合のみused", () => {
    const withPreserve = intentWith({ strengthsToPreserve: ["shooting"] });
    expect(computeIntentReflectionStatus(withPreserve).find((e) => e.field === "strengthsToPreserve")?.status).toBe("display-only");
    expect(computeIntentReflectionStatus(withPreserve, { preserveConfirmed: true }).find((e) => e.field === "strengthsToPreserve")?.status).toBe("used");
    expect(computeIntentReflectionStatus(emptyBuildIntent()).find((e) => e.field === "strengthsToPreserve")?.status).toBe("not-specified");
  });
});

describe("analyzeBuildIntent: 補助的に重視(Secondary Priority)", () => {
  it("AIのsecondaryGroups相当(groupPriorities='secondary')が分析へ反映され、secondaryAlignmentsに現れる", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 5, shooting: 3 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 5, totalTrainedDelta: 5 },
          { groupId: "shooting", allocatedLevel: 3, totalTrainedDelta: 5 },
        ]),
        abilityDeltas: { ballControl: 5, finishing: 5 },
      }),
    );
    expect(r.secondaryAlignments.some((a) => a.groupId === "shooting")).toBe(true);
    expect(r.priorityAlignments.some((a) => a.groupId === "shooting")).toBe(false);
  });

  it("最優先領域より配分が少なくても優先度不足(present-but-underprioritized)にはしない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 10, shooting: 1 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 10, totalTrainedDelta: 5 },
          { groupId: "shooting", allocatedLevel: 1, totalTrainedDelta: 3 },
        ]),
        abilityDeltas: { ballControl: 5, finishing: 3 },
      }),
    );
    const shootingEntry = r.secondaryAlignments.find((a) => a.groupId === "shooting");
    expect(shootingEntry?.state).not.toBe("present-but-underprioritized");
    expect(shootingEntry?.state).toBe("strongly-aligned");
  });

  it("配分ゼロは not-reflected(軽度の注意として扱う対象)になる", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 5 },
        groupImpact: makeGroupImpact([{ groupId: "dribbling", allocatedLevel: 5, totalTrainedDelta: 5 }]),
        abilityDeltas: { ballControl: 5 },
      }),
    );
    expect(r.secondaryAlignments.find((a) => a.groupId === "shooting")?.state).toBe("not-reflected");
  });

  it("能力値データ不足時はinsufficient-data", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 5, shooting: 3 },
        abilityAvailable: false,
      }),
    );
    expect(r.secondaryAlignments.find((a) => a.groupId === "shooting")?.state).toBe("insufficient-data");
  });

  it("補助的優先の配分が最優先の最大配分を上回る場合はpriorityInversion=trueになる", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 2, shooting: 10 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 2, totalTrainedDelta: 2 },
          { groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 8 },
        ]),
        abilityDeltas: { ballControl: 2, finishing: 8 },
      }),
    );
    const shootingEntry = r.secondaryAlignments.find((a) => a.groupId === "shooting");
    expect(shootingEntry?.priorityInversion).toBe(true);
  });

  it("補助的優先の配分が最優先を上回らない場合はpriorityInversion=false", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 10, shooting: 3 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 10, totalTrainedDelta: 5 },
          { groupId: "shooting", allocatedLevel: 3, totalTrainedDelta: 3 },
        ]),
        abilityDeltas: { ballControl: 5, finishing: 3 },
      }),
    );
    expect(r.secondaryAlignments.find((a) => a.groupId === "shooting")?.priorityInversion).toBe(false);
  });

  it("優先順位逆転(priority-inversion)はimprovementSeedsに含まれ、最優先の課題より後に扱われる", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", passing: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 0, passing: 5, shooting: 10 },
        groupImpact: makeGroupImpact([
          { groupId: "passing", allocatedLevel: 5, totalTrainedDelta: 3 },
          { groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 8 },
        ]),
        abilityDeltas: { lowPass: 3, finishing: 8 },
      }),
    );
    // 最優先(dribbling)が未反映(配分ゼロ)のため、そちらが最優先の課題として先に来る。
    expect(r.topIssue?.kind).toBe("not-reflected");
    expect(r.topIssue?.groupId).toBe("dribbling");
    const inversionIndex = r.improvementPriorities.findIndex((f) => f.code === "intent-secondary-priority-inversion");
    expect(inversionIndex).toBeGreaterThan(0);
  });

  it("最優先領域が反映済みの場合、優先順位逆転がtopIssueになり得る(補助的優先は最優先の後に扱われる、というのは同種課題間の順序であり、最優先に問題がなければ補助的優先の課題が最重要になる)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 10, shooting: 20 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 10, totalTrainedDelta: 5 },
          { groupId: "shooting", allocatedLevel: 20, totalTrainedDelta: 8 },
        ]),
        abilityDeltas: { ballControl: 5, finishing: 8 },
      }),
    );
    expect(r.topIssue?.kind).toBe("priority-inversion");
    expect(r.topIssue?.groupId).toBe("shooting");
  });

  it("差が小さく最優先領域が健全な場合、priorityInversionSeverityは'review-recommended'になり、改善候補・topIssueには含めない(実画面の脚力13対シュート/ドリブル11相当)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", dribbling: "priority", lowerBodyStrength: "secondary" } }),
        allocation: { shooting: 11, dribbling: 11, lowerBodyStrength: 13 },
        groupImpact: makeGroupImpact([
          { groupId: "shooting", allocatedLevel: 11, totalTrainedDelta: 8 },
          { groupId: "dribbling", allocatedLevel: 11, totalTrainedDelta: 8 },
          { groupId: "lowerBodyStrength", allocatedLevel: 13, totalTrainedDelta: 9 },
        ]),
        abilityDeltas: { finishing: 8, ballControl: 8, kickingPower: 9 },
      }),
    );
    const lbs = r.secondaryAlignments.find((a) => a.groupId === "lowerBodyStrength");
    expect(lbs?.priorityInversion).toBe(true); // 後方互換のフラグ自体は true のまま
    expect(lbs?.priorityInversionSeverity).toBe("review-recommended");
    // 明確な不一致(改善候補・topIssue)には昇格しない。
    expect(r.improvementPriorities.some((f) => f.code === "intent-secondary-priority-inversion")).toBe(false);
    expect(r.topIssue?.kind).not.toBe("priority-inversion");
    // 代わりに「確認事項」として保持する。
    expect(r.priorityConfirmationItems.some((f) => f.code === "intent-secondary-priority-inversion-review" && f.groupId === "lowerBodyStrength")).toBe(true);
  });

  it("差が大きい場合はclear-inversionのまま、改善候補・topIssueへ反映される(既存の重大な逆転挙動を維持)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 10, shooting: 20 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 10, totalTrainedDelta: 5 },
          { groupId: "shooting", allocatedLevel: 20, totalTrainedDelta: 8 },
        ]),
        abilityDeltas: { ballControl: 5, finishing: 8 },
      }),
    );
    const shootingEntry = r.secondaryAlignments.find((a) => a.groupId === "shooting");
    expect(shootingEntry?.priorityInversionSeverity).toBe("clear-inversion");
    expect(r.priorityConfirmationItems.length).toBe(0);
    expect(r.topIssue?.kind).toBe("priority-inversion");
  });

  it("差が小さくても、最優先領域自体に問題がある場合はclear-inversionのまま(最優先の未反映を優先して扱う)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", passing: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 10, passing: 0, shooting: 12 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 10, totalTrainedDelta: 5 },
          { groupId: "shooting", allocatedLevel: 12, totalTrainedDelta: 8 },
        ]),
        abilityDeltas: { ballControl: 5, finishing: 8 },
      }),
    );
    // passing が not-reflected(配分ゼロ)のため、最優先領域は健全ではない。
    expect(r.secondaryAlignments.find((a) => a.groupId === "shooting")?.priorityInversionSeverity).toBe("clear-inversion");
    expect(r.priorityConfirmationItems.length).toBe(0);
    // 最優先の未反映(passing)がより優先度の高い課題として先に扱われる。
    expect(r.topIssue?.kind).toBe("not-reflected");
    expect(r.topIssue?.groupId).toBe("passing");
  });

  it("確認事項(priorityConfirmationItems)は、目的との明確な不一致(misalignmentHighlights)へは含まれない", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { shooting: "priority", dribbling: "priority", lowerBodyStrength: "secondary" } }),
        allocation: { shooting: 11, dribbling: 11, lowerBodyStrength: 13 },
        groupImpact: makeGroupImpact([
          { groupId: "shooting", allocatedLevel: 11, totalTrainedDelta: 8 },
          { groupId: "dribbling", allocatedLevel: 11, totalTrainedDelta: 8 },
          { groupId: "lowerBodyStrength", allocatedLevel: 13, totalTrainedDelta: 9 },
        ]),
        abilityDeltas: { finishing: 8, ballControl: 8, kickingPower: 9 },
      }),
    );
    expect(r.misalignmentHighlights.some((f) => f.groupId === "lowerBodyStrength")).toBe(false);
    expect(r.priorityConfirmationItems.some((f) => f.groupId === "lowerBodyStrength")).toBe(true);
  });

  it("補助的優先領域は一般の過剰配分候補(possibleOverinvestmentForIntent)から除外される(高めの配分自体は目的に沿うため)", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 3, shooting: 10 },
        groupImpact: makeGroupImpact([
          { groupId: "dribbling", allocatedLevel: 3, totalTrainedDelta: 3 },
          { groupId: "shooting", allocatedLevel: 10, totalTrainedDelta: 8 },
        ]),
        baseAbilities: makeStats({ finishing: 90, kickingPower: 88 }),
        abilityDeltas: { ballControl: 3, finishing: 8 },
      }),
    );
    expect(r.possibleOverinvestmentForIntent.some((f) => f.groupId === "shooting")).toBe(false);
  });

  it("補助的優先と『上げすぎ注意』は矛盾せず併用できる", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", dexterity: "secondary" }, avoidOverinvestmentGroups: ["dexterity"] }),
        allocation: { dribbling: 5, dexterity: 4 },
        baseAbilities: makeStats({ speed: 85, acceleration: 82 }),
      }),
    );
    expect(r.avoidOverinvestmentFindings.some((f) => f.groupId === "dexterity")).toBe(true);
  });

  it("維持すべき長所は最優先の候補がなければ補助的優先の一致から選ぶ", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority", shooting: "secondary" } }),
        allocation: { dribbling: 0, shooting: 5 },
        groupImpact: makeGroupImpact([{ groupId: "shooting", allocatedLevel: 5, totalTrainedDelta: 5 }]),
        abilityDeltas: { finishing: 5 },
      }),
    );
    expect(r.preserveHighlight?.groupId).toBe("shooting");
    expect(r.preserveHighlight?.priorityLevel).toBe("secondary");
  });

  it("維持したい長所が実データで確認できない場合、preserveHighlightではなくunconfirmedPreserveGroupIdsへ入る", () => {
    const r = analyzeBuildIntent(
      makeInput({
        intent: intentWith({ groupPriorities: { dribbling: "priority" }, strengthsToPreserve: ["shooting"] }),
        allocation: { dribbling: 5 },
        groupImpact: makeGroupImpact([{ groupId: "dribbling", allocatedLevel: 5, totalTrainedDelta: 5 }]),
        abilityDeltas: { ballControl: 5 },
      }),
    );
    expect(r.unconfirmedPreserveGroupIds).toContain("shooting");
    expect(r.preserveHighlight?.groupId).not.toBe("shooting");
  });
});
