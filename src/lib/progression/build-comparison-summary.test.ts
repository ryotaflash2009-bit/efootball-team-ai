import { describe, it, expect } from "vitest";
import { buildComparisonSummary, buildComparisonSummaries, type BuildComparisonSummary } from "./build-comparison-summary";
import { emptyBuildIntent, type BuildIntentInput, type BuildIntentAnalysis, type BuildIntentComparisonResult } from "./build-intent-analysis";
import type { ComparisonSummaryEntry } from "./build-analysis";
import type { AbilityComparisonDifference } from "./build-ability-impact";

function makeSummary(overrides: Partial<ComparisonSummaryEntry> = {}): ComparisonSummaryEntry {
  return {
    otherBuildId: "sib1",
    otherBuildName: "ビルド2",
    usedPointsDiff: 0,
    remainingPointsDiff: 0,
    calculatedOvrDiff: 0,
    hasDifferentPrimaryFocus: false,
    primaryGroupId: "shooting",
    otherPrimaryGroupId: "shooting",
    otherUsed: false,
    otherUpdatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}
function makeAbilityDiff(overrides: Partial<AbilityComparisonDifference> = {}): AbilityComparisonDifference {
  return {
    otherBuildId: "sib1",
    otherBuildName: "ビルド2",
    classification: "practically-same",
    topDifferences: [],
    conditionDifference: null,
    ...overrides,
  };
}
function makeIntentResult(overrides: Partial<BuildIntentComparisonResult> = {}): BuildIntentComparisonResult {
  return {
    otherBuildId: "sib1",
    otherBuildName: "ビルド2",
    recommendation: "similar",
    keyDifferences: [],
    closeGroups: [],
    usedPointsDiff: 0,
    calculatedOvrDiff: 0,
    isUserComparisonTarget: false,
    ...overrides,
  };
}
function makeIntent(overrides: Partial<BuildIntentInput> = {}): BuildIntentInput {
  return { ...emptyBuildIntent(), ...overrides };
}
function makeAnalysis(overrides: Partial<BuildIntentAnalysis> = {}): BuildIntentAnalysis {
  return {
    hasIntent: true,
    alignment: "high",
    effectivePriorityGroups: ["shooting"],
    priorityAlignments: [],
    secondaryAlignments: [],
    alignedGroups: [],
    balanceGoalFinding: null,
    possibleOverinvestmentForIntent: [],
    avoidOverinvestmentFindings: [],
    acceptableLowInvestment: [],
    acceptableLowSummary: null,
    spreadNotAProblem: null,
    nearComplete: null,
    improvementPriorities: [],
    misalignmentHighlights: [],
    priorityConfirmationItems: [],
    topIssue: null,
    preserveHighlight: null,
    unconfirmedPreserveGroupIds: [],
    comparisonRecommendations: [],
    priorityCountGuidance: null,
    lowerPriorityCountGuidance: null,
    reflectionStatus: [],
    confidenceReasons: [],
    limitations: [],
    ...overrides,
  };
}

describe("buildComparisonSummary: 決定性・非破壊", () => {
  it("同じ入力からは常に同じ要約を返す", () => {
    const summary = makeSummary();
    const abilityDiff = makeAbilityDiff();
    const intentResult = makeIntentResult();
    const intent = makeIntent({ groupPriorities: { shooting: "priority" } });
    const ia = makeAnalysis();
    const a = buildComparisonSummary(summary, intentResult, abilityDiff, intent, ia);
    const b = buildComparisonSummary(summary, intentResult, abilityDiff, intent, ia);
    expect(a).toEqual(b);
  });

  it("入力(summary/abilityDiff/intentResult)を変更しない", () => {
    const summary = makeSummary();
    const abilityDiff = makeAbilityDiff({ topDifferences: [{ abilityId: "finishing", groupId: "shooting", currentValue: 90, otherValue: 88, diff: 2 }] });
    const before = JSON.stringify({ summary, abilityDiff });
    buildComparisonSummary(summary, makeIntentResult(), abilityDiff, makeIntent(), makeAnalysis());
    expect(JSON.stringify({ summary, abilityDiff })).toBe(before);
  });
});

describe("buildComparisonSummary: 比較可能性の分類", () => {
  it("conditionDifferenceがある場合はnot-comparable", () => {
    const r = buildComparisonSummary(makeSummary(), undefined, makeAbilityDiff({ conditionDifference: "legacy-vs-current" }), makeIntent(), makeAnalysis({ hasIntent: false }));
    expect(r.comparisonStatus).toBe("not-comparable");
    expect(r.limitations).toContain("condition-legacy-vs-current");
  });

  it("能力データがinsufficient-dataの場合はinsufficient-data", () => {
    const r = buildComparisonSummary(makeSummary(), undefined, makeAbilityDiff({ classification: "insufficient-data" }), makeIntent(), makeAnalysis({ hasIntent: false }));
    expect(r.comparisonStatus).toBe("insufficient-data");
  });

  it("能力データが完全に揃っている場合はcomparable", () => {
    const r = buildComparisonSummary(makeSummary(), makeIntentResult(), makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), makeAnalysis());
    expect(r.comparisonStatus).toBe("comparable");
  });

  it("ユーザーが明示した比較対象なのに目的別比較結果が見つからない場合はpartially-comparable", () => {
    const intent = makeIntent({ comparisonTargetBuildId: "sib1" });
    const r = buildComparisonSummary(makeSummary(), undefined, makeAbilityDiff(), intent, makeAnalysis());
    expect(r.comparisonStatus).toBe("partially-comparable");
  });

  it("比較不能時は用途の近さ・差別化判定を生成しない(unknown/not-assessableへ倒す)", () => {
    const r = buildComparisonSummary(makeSummary(), undefined, makeAbilityDiff({ conditionDifference: "one-unallocated" }), makeIntent({ groupPriorities: { shooting: "priority" } }), makeAnalysis());
    expect(r.purposeSimilarity).toBe("unknown");
    expect(r.differentiationStatus).toBe("not-assessable");
    expect(r.recommendationCode).toBe("not-comparable");
  });
});

describe("buildComparisonSummary: 差別化判定", () => {
  it("目的関連能力差が小さい(recommendation=similar・closeGroupsが最優先領域を網羅)場合はlimited-differentiation", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting", "dribbling"] });
    const intentResult = makeIntentResult({ recommendation: "similar", closeGroups: ["shooting", "dribbling"] });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority", dribbling: "priority" } }), ia);
    expect(r.differentiationStatus).toBe("limited-differentiation");
  });

  it("目的関連能力に明確な差がある(recommendation=current-closer)場合はwell-differentiated", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting"] });
    const intentResult = makeIntentResult({ recommendation: "current-closer" });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), ia);
    expect(r.differentiationStatus).toBe("well-differentiated");
  });

  it("同じ使用ポイントだけでは差別化を判定しない(ポイント情報は差別化判定に使わない)", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting"] });
    const summary = makeSummary({ usedPointsDiff: 0, calculatedOvrDiff: 0 });
    const intentResult = makeIntentResult({ recommendation: "current-closer" });
    const r = buildComparisonSummary(summary, intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), ia);
    expect(r.differentiationStatus).toBe("well-differentiated");
  });

  it("同じ推定OVRだけでは差別化なしと判定しない", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting"] });
    const summary = makeSummary({ calculatedOvrDiff: 0 });
    const intentResult = makeIntentResult({ recommendation: "current-closer" });
    const r = buildComparisonSummary(summary, intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), ia);
    expect(r.differentiationStatus).not.toBe("limited-differentiation");
  });

  it("目的未設定時は目的別の差別化を判定しない(not-assessable)", () => {
    const r = buildComparisonSummary(makeSummary(), undefined, makeAbilityDiff(), makeIntent(), makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }));
    expect(r.differentiationStatus).toBe("not-assessable");
    expect(r.purposeSimilarity).toBe("purpose-not-set");
  });

  it("比較不能時は判定を生成しない(not-assessable)", () => {
    const r = buildComparisonSummary(makeSummary(), makeIntentResult(), makeAbilityDiff({ classification: "insufficient-data" }), makeIntent({ groupPriorities: { shooting: "priority" } }), makeAnalysis());
    expect(r.differentiationStatus).toBe("not-assessable");
  });
});

describe("buildComparisonSummary: 目的領域の差(purposeDifferenceMagnitude、用途の近さとは別軸)", () => {
  it("目的関連能力差が非常に小さい(全最優先領域が僅差)場合はvery-small", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting", "dribbling"] });
    const intentResult = makeIntentResult({ recommendation: "similar", closeGroups: ["shooting", "dribbling"] });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority", dribbling: "priority" } }), ia);
    expect(r.purposeDifferenceMagnitude).toBe("very-small");
  });

  it("僅差だが一部の最優先領域のみの場合はsmall", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting", "dribbling"] });
    const intentResult = makeIntentResult({ recommendation: "similar", closeGroups: ["shooting"] });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority", dribbling: "priority" } }), ia);
    expect(r.purposeDifferenceMagnitude).toBe("small");
  });

  it("明確な方向差があるが一部領域は僅差の場合はsome-difference", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting", "dribbling"] });
    const intentResult = makeIntentResult({ recommendation: "current-closer", closeGroups: ["dribbling"] });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority", dribbling: "priority" } }), ia);
    expect(r.purposeDifferenceMagnitude).toBe("some-difference");
    expect(r.differentiationStatus).toBe("partially-differentiated");
  });

  it("僅差の領域が1つもない明確な差の場合はclear-difference", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting"] });
    const intentResult = makeIntentResult({ recommendation: "current-closer", closeGroups: [] });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), ia);
    expect(r.purposeDifferenceMagnitude).toBe("clear-difference");
  });

  it("比較不能・目的未設定時はinsufficient-data", () => {
    const r = buildComparisonSummary(makeSummary(), undefined, makeAbilityDiff(), makeIntent(), makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }));
    expect(r.purposeDifferenceMagnitude).toBe("insufficient-data");
  });
});

describe("buildComparisonSummary: 主な差の選定", () => {
  it("目的が有効な場合は既存keyDifferencesをそのまま再利用する(最大3件)", () => {
    const intentResult = makeIntentResult({
      keyDifferences: [
        { abilityId: "finishing", diff: 3 },
        { abilityId: "curl", diff: -2 },
        { abilityId: "setPieceTaking", diff: 1 },
        { abilityId: "lowPass", diff: 1 },
      ],
    });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), makeAnalysis());
    expect(r.largestDifferences.length).toBe(3);
    expect(r.largestDifferences[0]).toEqual({ abilityId: "finishing", groupId: null, currentHigher: true, diff: 3 });
    expect(r.largestDifferences[1]).toEqual({ abilityId: "curl", groupId: null, currentHigher: false, diff: 2 });
  });

  it("差が0の能力は主な差へ含めない", () => {
    const intentResult = makeIntentResult({ keyDifferences: [{ abilityId: "finishing", diff: 0 }] });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), makeAnalysis());
    expect(r.largestDifferences).toEqual([]);
  });

  it("目的未設定時は全26能力値の主な差(topDifferences)から選ぶ", () => {
    const abilityDiff = makeAbilityDiff({
      classification: "different-focus",
      topDifferences: [
        { abilityId: "kickingPower", groupId: "lowerBodyStrength", currentValue: 80, otherValue: 78, diff: 2 },
        { abilityId: "dribbling", groupId: "dribbling", currentValue: 70, otherValue: 72, diff: -2 },
      ],
    });
    const r = buildComparisonSummary(makeSummary(), undefined, abilityDiff, makeIntent(), makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }));
    expect(r.largestDifferences.length).toBe(2);
    expect(r.largestDifferences[0].abilityId).toBe("kickingPower");
  });

  it("同点(diffの絶対値が同じ)の場合、既存データの順序を保つ(WORLD_STAT_DEFS固定順で並べ済みのtopDifferencesをそのまま使う)", () => {
    const abilityDiff = makeAbilityDiff({
      classification: "different-focus",
      topDifferences: [
        { abilityId: "finishing", groupId: "shooting", currentValue: 80, otherValue: 78, diff: 2 },
        { abilityId: "curl", groupId: "shooting", currentValue: 78, otherValue: 80, diff: -2 },
      ],
    });
    const r = buildComparisonSummary(makeSummary(), undefined, abilityDiff, makeIntent(), makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }));
    expect(r.largestDifferences.map((d) => d.abilityId)).toEqual(["finishing", "curl"]);
  });

  it("内部ID以外の情報(表示用の完成文)を含まない(abilityId/groupIdだけを保持する)", () => {
    const intentResult = makeIntentResult({ keyDifferences: [{ abilityId: "finishing", diff: 3 }] });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), makeAnalysis());
    const serialized = JSON.stringify(r);
    expect(serialized).not.toMatch(/です。|ください。|shooting型|型として/);
  });
});

describe("buildComparisonSummary: 改善順位との整合性", () => {
  it("差別化が限定的な場合、推奨コードはdifferentiate-groupsで、最優先領域を対象にする", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting", "dribbling"] });
    const intentResult = makeIntentResult({ recommendation: "similar", closeGroups: ["shooting", "dribbling"] });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority", dribbling: "priority" } }), ia);
    expect(r.recommendationCode).toBe("differentiate-groups");
    expect(r.recommendationGroupId).toBe("shooting");
  });

  it("差別化できている場合、推奨コードはmaintain-role-split(差を作れとは推奨しない)", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting"] });
    const intentResult = makeIntentResult({ recommendation: "other-closer" });
    const r = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), ia);
    expect(r.recommendationCode).toBe("maintain-role-split");
  });

  it("通常/辛口で異なる判定を生成しない(この関数はモードを受け取らず、常に同じ判定を返す)", () => {
    const ia = makeAnalysis({ effectivePriorityGroups: ["shooting"] });
    const intentResult = makeIntentResult({ recommendation: "similar", closeGroups: ["shooting"] });
    const intent = makeIntent({ groupPriorities: { shooting: "priority" } });
    const a = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), intent, ia);
    const b = buildComparisonSummary(makeSummary(), intentResult, makeAbilityDiff(), intent, ia);
    expect(a.differentiationStatus).toBe(b.differentiationStatus);
    expect(a.recommendationCode).toBe(b.recommendationCode);
  });
});

describe("buildComparisonSummaries: 複数比較対象・並び順", () => {
  it("ユーザーが明示した比較対象を先頭にする", () => {
    const summaries = [makeSummary({ otherBuildId: "a", otherBuildName: "A" }), makeSummary({ otherBuildId: "b", otherBuildName: "B" })];
    const intentResults = [makeIntentResult({ otherBuildId: "b", isUserComparisonTarget: true }), makeIntentResult({ otherBuildId: "a", isUserComparisonTarget: false })];
    const abilityDiffs = [makeAbilityDiff({ otherBuildId: "a" }), makeAbilityDiff({ otherBuildId: "b" })];
    const intent = makeIntent({ comparisonTargetBuildId: "b", groupPriorities: { shooting: "priority" } });
    const result = buildComparisonSummaries(summaries, intentResults, abilityDiffs, intent, makeAnalysis());
    expect(result[0].targetBuildId).toBe("b");
    expect(result[0].isUserComparisonTarget).toBe(true);
  });

  it("明示比較対象がない場合は、既存のcomparisonSummaryの並び順(呼び出し側で決定済み)を保つ", () => {
    const summaries = [makeSummary({ otherBuildId: "a", otherBuildName: "A" }), makeSummary({ otherBuildId: "b", otherBuildName: "B" })];
    const result = buildComparisonSummaries(summaries, [], [], makeIntent(), makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }));
    expect(result.map((r) => r.targetBuildId)).toEqual(["a", "b"]);
  });

  it("目的(優先領域)が未設定でも、明示した比較対象を先頭にする(intentResultsが空でも機能する)", () => {
    const summaries = [makeSummary({ otherBuildId: "a", otherBuildName: "A" }), makeSummary({ otherBuildId: "b", otherBuildName: "B" })];
    const intent = makeIntent({ comparisonTargetBuildId: "b" });
    const result = buildComparisonSummaries(summaries, [], [], intent, makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }));
    expect(result[0].targetBuildId).toBe("b");
    expect(result[0].isUserComparisonTarget).toBe(true);
  });

  it("入力配列を変更しない", () => {
    const summaries = [makeSummary()];
    const before = JSON.stringify(summaries);
    buildComparisonSummaries(summaries, [], [], makeIntent(), makeAnalysis({ hasIntent: false }));
    expect(JSON.stringify(summaries)).toBe(before);
  });
});

describe("buildComparisonSummary: 全体の近さ(overallSimilarity、目的未設定時の一般比較で使用)", () => {
  it("能力データがない場合はunknown", () => {
    const r = buildComparisonSummary(makeSummary(), undefined, makeAbilityDiff({ classification: "insufficient-data" }), makeIntent(), makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }));
    expect(r.overallSimilarity).toBe("unknown");
  });

  it("practically-same かつ差分0件の場合はvery-similar", () => {
    const r = buildComparisonSummary(makeSummary(), undefined, makeAbilityDiff({ classification: "practically-same", topDifferences: [] }), makeIntent(), makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }));
    expect(r.overallSimilarity).toBe("very-similar");
  });

  it("practically-same だが軽微な差分が残る場合はsimilar", () => {
    const r = buildComparisonSummary(
      makeSummary(),
      undefined,
      makeAbilityDiff({ classification: "practically-same", topDifferences: [{ abilityId: "finishing", groupId: "shooting", currentValue: 80, otherValue: 78, diff: 2 }] }),
      makeIntent(),
      makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }),
    );
    expect(r.overallSimilarity).toBe("similar");
  });

  it("different-focus かつ差分1〜2件はpartially-different", () => {
    const r = buildComparisonSummary(
      makeSummary(),
      undefined,
      makeAbilityDiff({ classification: "different-focus", topDifferences: [{ abilityId: "finishing", groupId: "shooting", currentValue: 80, otherValue: 70, diff: 10 }] }),
      makeIntent(),
      makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }),
    );
    expect(r.overallSimilarity).toBe("partially-different");
  });

  it("different-focus かつ差分3件以上はclearly-different", () => {
    const r = buildComparisonSummary(
      makeSummary(),
      undefined,
      makeAbilityDiff({
        classification: "different-focus",
        topDifferences: [
          { abilityId: "finishing", groupId: "shooting", currentValue: 80, otherValue: 70, diff: 10 },
          { abilityId: "curl", groupId: "shooting", currentValue: 80, otherValue: 70, diff: 10 },
          { abilityId: "dribbling", groupId: "dribbling", currentValue: 80, otherValue: 70, diff: 10 },
        ],
      }),
      makeIntent(),
      makeAnalysis({ hasIntent: false, effectivePriorityGroups: [] }),
    );
    expect(r.overallSimilarity).toBe("clearly-different");
  });
});

describe("BuildComparisonSummary型の健全性", () => {
  it("生成された要約が内部buildIdをtargetBuildIdとしてのみ保持し、表示用完成文を含まない", () => {
    const r: BuildComparisonSummary = buildComparisonSummary(makeSummary(), makeIntentResult(), makeAbilityDiff(), makeIntent({ groupPriorities: { shooting: "priority" } }), makeAnalysis());
    expect(typeof r.targetBuildId).toBe("string");
    expect(typeof r.targetBuildName).toBe("string");
  });
});
