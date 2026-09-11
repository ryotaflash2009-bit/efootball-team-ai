import { describe, it, expect } from "vitest";
import { buildDiagnosisCardModel, type BuildDiagnosisCardInput } from "./build-diagnosis-card";
import { emptyBuildIntent, type BuildIntentInput, type BuildIntentAnalysis } from "./build-intent-analysis";
import type { SavedBuildAnalysis } from "./build-analysis";
import type { BuildAbilityImpactAnalysis } from "./build-ability-impact";
import { buildComparisonSummaries } from "./build-comparison-summary";

function makeAbilityImpact(overrides: Partial<BuildAbilityImpactAnalysis> = {}): BuildAbilityImpactAnalysis {
  return {
    available: true,
    baseAbilities: {},
    trainedAbilities: {},
    finalAbilities: {},
    abilityDeltas: {},
    largestGains: [],
    smallestGains: [],
    highestFinalAbilities: [],
    lowestFinalAbilities: [],
    groupImpact: [],
    overinvestmentFindings: [],
    underinvestmentFindings: [],
    comparisonDifferences: [],
    confidenceReasons: [],
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<SavedBuildAnalysis> = {}): SavedBuildAnalysis {
  return {
    worldCardId: "wc1",
    buildId: "b1",
    completionState: "in-progress",
    usedPoints: 22,
    totalPoints: 41,
    remainingPoints: 19,
    overAllocated: false,
    allocationSummary: [],
    trainingFocus: { kind: "dominant", isGoalkeeping: false, primaryGroupId: "shooting", primaryGroupNameEn: "Shooting", primaryLevel: 11, primaryShare: 0.5, secondaryGroupId: null, secondaryGroupNameEn: null, secondaryLevel: null },
    strongestGrowthAreas: [],
    underinvestedAreas: [],
    strengths: [],
    concerns: [],
    normalReviewPoints: [],
    harshReviewPoints: [],
    improvementSuggestions: [],
    comparisonSummary: [],
    confidence: { level: "high", reasons: [] },
    limitations: [],
    abilityImpact: makeAbilityImpact(),
    ...overrides,
  };
}

function makeIntentAnalysis(overrides: Partial<BuildIntentAnalysis> = {}): BuildIntentAnalysis {
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

function makeIntent(overrides: Partial<BuildIntentInput> = {}): BuildIntentInput {
  return { ...emptyBuildIntent(), ...overrides };
}

function makeInput(overrides: Partial<BuildDiagnosisCardInput> = {}): BuildDiagnosisCardInput {
  const analysis = overrides.analysis ?? makeAnalysis();
  const intentAnalysis = overrides.intentAnalysis ?? makeIntentAnalysis();
  const intent = overrides.intent ?? makeIntent({ primaryGoal: "dribbling", groupPriorities: { shooting: "priority" } });
  const comparisonSummaries = overrides.comparisonSummaries ?? buildComparisonSummaries(analysis.comparisonSummary, intentAnalysis.comparisonRecommendations, analysis.abilityImpact.comparisonDifferences, intent, intentAnalysis);
  return {
    analysis,
    intentAnalysis,
    intent,
    comparisonSummaries,
    mode: "normal",
    playerDisplayName: "Lionel Messi",
    cardDisplayName: null,
    buildDisplayName: "Fixture Build",
    confirmedPrimaryPresetId: "dribble-to-shot",
    confirmedSubPresetIds: ["ball-retention"],
    abilityLoading: false,
    hasPendingChanges: false,
    ...overrides,
  };
}

describe("buildDiagnosisCardModel: 決定性・非破壊", () => {
  it("同じ入力からは常に同じモデルを返す", () => {
    const input = makeInput();
    const a = buildDiagnosisCardModel(input);
    const b = buildDiagnosisCardModel(input);
    expect(a).toEqual(b);
  });

  it("入力(analysis/intentAnalysis/intent)を変更しない", () => {
    const input = makeInput();
    const before = JSON.stringify({ analysis: input.analysis, intentAnalysis: input.intentAnalysis, intent: input.intent });
    buildDiagnosisCardModel(input);
    expect(JSON.stringify({ analysis: input.analysis, intentAnalysis: input.intentAnalysis, intent: input.intent })).toBe(before);
  });

  it("完成した日本語文章をモデルへ直書きしない(コード・列挙値・数値のみ)", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          topIssue: { kind: "not-reflected", groupId: "shooting" },
          improvementPriorities: [{ code: "intent-priority-not-reflected", groupId: "shooting", params: {} }],
        }),
      }),
    );
    const serialized = JSON.stringify(model);
    expect(serialized).not.toMatch(/です。|ください。|再確認する余地/);
  });
});

describe("buildDiagnosisCardModel: 目的確定状態", () => {
  it("目的が確定済みならcardVariant=intent", () => {
    const model = buildDiagnosisCardModel(makeInput());
    expect(model.cardVariant).toBe("intent");
  });

  it("目的が未確定(hasIntent=false)ならcardVariant=no-intent、目的別フィールドを生成しない", () => {
    const model = buildDiagnosisCardModel(makeInput({ intentAnalysis: makeIntentAnalysis({ hasIntent: false, alignment: "insufficient-information", effectivePriorityGroups: [] }) }));
    expect(model.cardVariant).toBe("no-intent");
    expect(model.selectedPrimaryPresetId).toBeNull();
    expect(model.selectedSubPresetIds).toEqual([]);
    expect(model.achievementItems).toEqual([]);
    expect(model.topImprovement).toBeNull();
    expect(model.preserveHighlight).toBeNull();
    expect(model.primaryConcern.sourceKind).toBe("none");
  });

  it("未確定のプリセット(draft)は使用しない: confirmedPrimaryPresetIdのみを反映する", () => {
    const model = buildDiagnosisCardModel(makeInput({ confirmedPrimaryPresetId: "dribble-to-shot", confirmedSubPresetIds: [] }));
    expect(model.selectedPrimaryPresetId).toBe("dribble-to-shot");
    expect(model.selectedSubPresetIds).toEqual([]);
  });
});

describe("buildDiagnosisCardModel: 基本情報", () => {
  it("選手名・ビルド名・使用予定ポジションを保持する", () => {
    const model = buildDiagnosisCardModel(makeInput({ intent: makeIntent({ intendedPositions: ["CF"], primaryGoal: "dribbling", groupPriorities: { shooting: "priority" } }) }));
    expect(model.playerDisplayName).toBe("Lionel Messi");
    expect(model.buildDisplayName).toBe("Fixture Build");
    expect(model.intendedPositions).toEqual(["CF"]);
  });

  it("カード識別用の公開情報がなければcardDisplayNameはnull(内部IDを代入しない)", () => {
    const model = buildDiagnosisCardModel(makeInput({ cardDisplayName: null }));
    expect(model.cardDisplayName).toBeNull();
  });

  it("サブ目的は渡された確定済み配列をそのまま保持する(呼び出し側で既に最大2件に制限済み)", () => {
    const model = buildDiagnosisCardModel(makeInput({ confirmedSubPresetIds: ["a", "b"] }));
    expect(model.selectedSubPresetIds).toEqual(["a", "b"]);
  });

  it("内部worldCardId/buildIdを表示用モデルの直接フィールドへ持たない", () => {
    const model = buildDiagnosisCardModel(makeInput());
    expect((model as unknown as Record<string, unknown>).worldCardId).toBeUndefined();
    expect((model as unknown as Record<string, unknown>).buildId).toBeUndefined();
  });
});

describe("buildDiagnosisCardModel: 目的適合状態", () => {
  it("既存alignmentをそのまま保持する(独自判定を作らない)", () => {
    const model = buildDiagnosisCardModel(makeInput({ intentAnalysis: makeIntentAnalysis({ alignment: "partially-aligned" }) }));
    expect(model.alignmentStatus).toBe("partially-aligned");
  });

  for (const alignment of ["high", "mostly-aligned", "partially-aligned", "poorly-aligned", "insufficient-information"] as const) {
    it(`alignment=${alignment} を正しく反映する`, () => {
      const model = buildDiagnosisCardModel(makeInput({ intentAnalysis: makeIntentAnalysis({ alignment }) }));
      expect(model.alignmentStatus).toBe(alignment);
    });
  }
});

describe("buildDiagnosisCardModel: 主な成果", () => {
  it("最優先領域の十分な一致を優先して選ぶ", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          priorityAlignments: [
            { groupId: "shooting", state: "strongly-aligned", level: 11, delta: 20, representativeAbilities: [{ abilityId: "finishing", delta: 10 }], priorityLevel: "top", priorityInversion: false, priorityInversionSeverity: "none" },
          ],
        }),
      }),
    );
    expect(model.achievementItems).toEqual([{ abilityId: "finishing", delta: 10 }]);
  });

  it("最大3件までしか選ばない", () => {
    const abilities = [
      { abilityId: "finishing", delta: 10 },
      { abilityId: "curl", delta: 9 },
      { abilityId: "setPieceTaking", delta: 8 },
    ];
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          priorityAlignments: [{ groupId: "shooting", state: "strongly-aligned", level: 11, delta: 27, representativeAbilities: abilities, priorityLevel: "top", priorityInversion: false, priorityInversionSeverity: "none" }],
          secondaryAlignments: [{ groupId: "dribbling", state: "strongly-aligned", level: 8, delta: 15, representativeAbilities: [{ abilityId: "dribbling", delta: 12 }], priorityLevel: "secondary", priorityInversion: false, priorityInversionSeverity: "none" }],
        }),
      }),
    );
    expect(model.achievementItems.length).toBe(3);
  });

  it("差0の能力は成果として選ばない", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          priorityAlignments: [{ groupId: "shooting", state: "strongly-aligned", level: 11, delta: 0, representativeAbilities: [{ abilityId: "finishing", delta: 0 }], priorityLevel: "top", priorityInversion: false, priorityInversionSeverity: "none" }],
        }),
      }),
    );
    expect(model.achievementItems).toEqual([]);
  });

  it("同じ能力を重複して選ばない", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          priorityAlignments: [{ groupId: "shooting", state: "strongly-aligned", level: 11, delta: 10, representativeAbilities: [{ abilityId: "finishing", delta: 10 }], priorityLevel: "top", priorityInversion: false, priorityInversionSeverity: "none" }],
          secondaryAlignments: [{ groupId: "dribbling", state: "strongly-aligned", level: 8, delta: 10, representativeAbilities: [{ abilityId: "finishing", delta: 10 }], priorityLevel: "secondary", priorityInversion: false, priorityInversionSeverity: "none" }],
        }),
      }),
    );
    expect(model.achievementItems).toEqual([{ abilityId: "finishing", delta: 10 }]);
  });
});

describe("buildDiagnosisCardModel: 最大の注意点", () => {
  it("topIssueを最優先で選ぶ", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          topIssue: { kind: "not-reflected", groupId: "shooting" },
          improvementPriorities: [{ code: "intent-priority-not-reflected", groupId: "shooting", params: {} }],
        }),
      }),
    );
    expect(model.primaryConcern.sourceKind).toBe("top-issue");
    expect(model.primaryConcern.groupId).toBe("shooting");
  });

  it("topIssueとimprovementPriorities[0]が両方存在しても、1件(top-issue)へ統合する(二重表示しない)", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          topIssue: { kind: "underprioritized", groupId: "shooting" },
          improvementPriorities: [{ code: "intent-priority-underprioritized", groupId: "shooting", params: {} }],
        }),
      }),
    );
    expect(model.primaryConcern.sourceKind).toBe("top-issue");
  });

  it("topIssueがない場合はimprovementPriorities[0]を使う", () => {
    const model = buildDiagnosisCardModel(
      makeInput({ intentAnalysis: makeIntentAnalysis({ topIssue: null, improvementPriorities: [{ code: "intent-priority-underprioritized", groupId: "dribbling", params: {} }] }) }),
    );
    expect(model.primaryConcern.sourceKind).toBe("top-improvement");
    expect(model.primaryConcern.groupId).toBe("dribbling");
  });

  it("topIssue/improvementがなければpriorityConfirmationItemsを使う", () => {
    const model = buildDiagnosisCardModel(
      makeInput({ intentAnalysis: makeIntentAnalysis({ priorityConfirmationItems: [{ code: "intent-secondary-priority-inversion-review", groupId: "legLength", params: {} }] }) }),
    );
    expect(model.primaryConcern.sourceKind).toBe("confirmation");
    expect(model.primaryConcern.groupId).toBe("legLength");
  });

  it("何も問題がなければsourceKind=noneとなる(カード側で新しい問題を作らない)", () => {
    const model = buildDiagnosisCardModel(makeInput());
    expect(model.primaryConcern.sourceKind).toBe("none");
  });

  it("能力データ不足時はinsufficient-dataとなる(他に問題信号がない場合)", () => {
    const model = buildDiagnosisCardModel(makeInput({ analysis: makeAnalysis({ abilityImpact: makeAbilityImpact({ available: false }) }) }));
    expect(model.primaryConcern.sourceKind).toBe("insufficient-data");
  });
});

describe("buildDiagnosisCardModel: 改善候補1位", () => {
  it("intentAnalysis.improvementPriorities[0]と同一の内容を保持する", () => {
    const finding = { code: "intent-priority-underprioritized" as const, groupId: "shooting", params: { level: 3 } };
    const model = buildDiagnosisCardModel(makeInput({ intentAnalysis: makeIntentAnalysis({ improvementPriorities: [finding] }) }));
    expect(model.topImprovement?.finding).toEqual(finding);
  });

  it("改善候補がなければnullを返す(具体的な再配分値を生成しない)", () => {
    const model = buildDiagnosisCardModel(makeInput());
    expect(model.topImprovement).toBeNull();
  });

  it("維持すべき長所(preserveHighlight)がある場合、改善候補1位のpreserveGroupIdへ反映する", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          improvementPriorities: [{ code: "intent-priority-underprioritized", groupId: "shooting", params: {} }],
          preserveHighlight: { groupId: "dribbling", state: "strongly-aligned", level: 8, delta: 10, representativeAbilities: [{ abilityId: "dribbling", delta: 10 }], priorityLevel: "top", priorityInversion: false, priorityInversionSeverity: "none" },
        }),
      }),
    );
    expect(model.topImprovement?.preserveGroupId).toBe("dribbling");
  });
});

describe("buildDiagnosisCardModel: 維持すべき長所", () => {
  it("preserveHighlightがあれば confirmed:true として保持する", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intentAnalysis: makeIntentAnalysis({
          preserveHighlight: { groupId: "dribbling", state: "strongly-aligned", level: 8, delta: 10, representativeAbilities: [{ abilityId: "dribbling", delta: 10 }], priorityLevel: "top", priorityInversion: false, priorityInversionSeverity: "none" },
        }),
      }),
    );
    expect(model.preserveHighlight).toEqual({ groupId: "dribbling", confirmed: true, representativeAbilities: [{ abilityId: "dribbling", delta: 10 }] });
  });

  it("実データで確認できない場合はconfirmed:falseとして保持する(架空の長所を断定しない)", () => {
    const model = buildDiagnosisCardModel(makeInput({ intentAnalysis: makeIntentAnalysis({ preserveHighlight: null, unconfirmedPreserveGroupIds: ["passing"] }) }));
    expect(model.preserveHighlight).toEqual({ groupId: "passing", confirmed: false, representativeAbilities: [] });
  });

  it("長所がなければnullを返す(無理に長所を生成しない)", () => {
    const model = buildDiagnosisCardModel(makeInput({ intentAnalysis: makeIntentAnalysis({ preserveHighlight: null, unconfirmedPreserveGroupIds: [] }) }));
    expect(model.preserveHighlight).toBeNull();
  });
});

describe("buildDiagnosisCardModel: 比較要約", () => {
  it("比較対象がなければnull(空の比較枠を作らない)", () => {
    const model = buildDiagnosisCardModel(makeInput({ analysis: makeAnalysis({ comparisonSummary: [] }) }));
    expect(model.comparisonSummary).toBeNull();
  });

  it("ユーザーが明示した比較対象を優先して1件だけ表示する", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        intent: makeIntent({ primaryGoal: "dribbling", groupPriorities: { shooting: "priority" }, comparisonTargetBuildId: "b" }),
        analysis: makeAnalysis({
          comparisonSummary: [
            { otherBuildId: "a", otherBuildName: "A", usedPointsDiff: 0, remainingPointsDiff: 0, calculatedOvrDiff: 0, hasDifferentPrimaryFocus: false, primaryGroupId: "shooting", otherPrimaryGroupId: "shooting", otherUsed: false, otherUpdatedAt: "2026-08-01T00:00:00.000Z" },
            { otherBuildId: "b", otherBuildName: "B", usedPointsDiff: 0, remainingPointsDiff: 0, calculatedOvrDiff: 0, hasDifferentPrimaryFocus: false, primaryGroupId: "shooting", otherPrimaryGroupId: "shooting", otherUsed: false, otherUpdatedAt: "2026-07-01T00:00:00.000Z" },
          ],
          abilityImpact: makeAbilityImpact({ comparisonDifferences: [{ otherBuildId: "a", otherBuildName: "A", classification: "practically-same", topDifferences: [], conditionDifference: null }, { otherBuildId: "b", otherBuildName: "B", classification: "practically-same", topDifferences: [], conditionDifference: null }] }),
        }),
      }),
    );
    expect(model.comparisonSummary?.targetBuildId).toBe("b");
    expect(model.comparisonSummary?.isUserComparisonTarget).toBe(true);
  });

  it("比較不能理由(limitations)を保持する", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        analysis: makeAnalysis({
          comparisonSummary: [{ otherBuildId: "a", otherBuildName: "A", usedPointsDiff: 0, remainingPointsDiff: 0, calculatedOvrDiff: 0, hasDifferentPrimaryFocus: false, primaryGroupId: null, otherPrimaryGroupId: null, otherUsed: false, otherUpdatedAt: "2026-08-01T00:00:00.000Z" }],
          abilityImpact: makeAbilityImpact({ comparisonDifferences: [{ otherBuildId: "a", otherBuildName: "A", classification: "insufficient-data", topDifferences: [], conditionDifference: "legacy-vs-current" }] }),
        }),
      }),
    );
    expect(model.comparisonSummary?.comparisonStatus).toBe("not-comparable");
    expect(model.comparisonSummary?.limitations).toContain("condition-legacy-vs-current");
  });

  it("主な差は最大1件だけを保持する(比較詳細をカードへ複製しない)", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        analysis: makeAnalysis({
          comparisonSummary: [{ otherBuildId: "a", otherBuildName: "A", usedPointsDiff: 0, remainingPointsDiff: 0, calculatedOvrDiff: 0, hasDifferentPrimaryFocus: false, primaryGroupId: "shooting", otherPrimaryGroupId: "shooting", otherUsed: false, otherUpdatedAt: "2026-08-01T00:00:00.000Z" }],
          abilityImpact: makeAbilityImpact({
            comparisonDifferences: [
              {
                otherBuildId: "a",
                otherBuildName: "A",
                classification: "different-focus",
                topDifferences: [
                  { abilityId: "finishing", groupId: "shooting", currentValue: 90, otherValue: 80, diff: 10 },
                  { abilityId: "curl", groupId: "shooting", currentValue: 85, otherValue: 78, diff: 7 },
                ],
                conditionDifference: null,
              },
            ],
          }),
        }),
      }),
    );
    expect(model.comparisonSummary?.majorDifference?.abilityId).toBe("finishing");
  });
});

describe("buildDiagnosisCardModel: 通常・辛口", () => {
  it("modeが違っても、判定・順位・比較結果は完全に同一(表示文体だけが呼び出し側で変わる)", () => {
    const intentAnalysis = makeIntentAnalysis({ topIssue: { kind: "not-reflected", groupId: "shooting" }, improvementPriorities: [{ code: "intent-priority-not-reflected", groupId: "shooting", params: {} }] });
    const normal = buildDiagnosisCardModel(makeInput({ mode: "normal", intentAnalysis }));
    const harsh = buildDiagnosisCardModel(makeInput({ mode: "harsh", intentAnalysis }));
    expect(normal.alignmentStatus).toBe(harsh.alignmentStatus);
    expect(normal.primaryConcern).toEqual(harsh.primaryConcern);
    expect(normal.topImprovement).toEqual(harsh.topImprovement);
    expect(normal.achievementItems).toEqual(harsh.achievementItems);
    expect(normal.comparisonSummary).toEqual(harsh.comparisonSummary);
    expect(normal.analysisMode).toBe("normal");
    expect(harsh.analysisMode).toBe("harsh");
  });
});

describe("buildDiagnosisCardModel: 未確定変更", () => {
  it("hasPendingChangesをそのまま伝える(モデル自身は判定しない)", () => {
    const withPending = buildDiagnosisCardModel(makeInput({ hasPendingChanges: true }));
    const withoutPending = buildDiagnosisCardModel(makeInput({ hasPendingChanges: false }));
    expect(withPending.hasPendingChanges).toBe(true);
    expect(withoutPending.hasPendingChanges).toBe(false);
  });
});

describe("buildDiagnosisCardModel: データ不足の安全な扱い", () => {
  it("能力値データ取得中(loading)を安全に扱う", () => {
    const model = buildDiagnosisCardModel(makeInput({ abilityLoading: true, analysis: makeAnalysis({ abilityImpact: makeAbilityImpact({ available: false }) }) }));
    expect(model.dataAvailability.abilityDataStatus).toBe("loading");
  });

  it("能力値データ確認不能(unavailable)を安全に扱う", () => {
    const model = buildDiagnosisCardModel(makeInput({ abilityLoading: false, analysis: makeAnalysis({ abilityImpact: makeAbilityImpact({ available: false }) }) }));
    expect(model.dataAvailability.abilityDataStatus).toBe("unavailable");
  });

  it("能力データ不足時、成果や長所を捏造しない", () => {
    const model = buildDiagnosisCardModel(
      makeInput({
        analysis: makeAnalysis({ abilityImpact: makeAbilityImpact({ available: false }) }),
        intentAnalysis: makeIntentAnalysis({ priorityAlignments: [], preserveHighlight: null }),
      }),
    );
    expect(model.achievementItems).toEqual([]);
    expect(model.preserveHighlight).toBeNull();
  });
});

describe("BuildDiagnosisCardModel型の健全性", () => {
  it("基本フィールドが期待どおりの型で生成される", () => {
    const model = buildDiagnosisCardModel(makeInput());
    expect(typeof model.playerDisplayName).toBe("string");
    expect(typeof model.buildDisplayName).toBe("string");
    expect(["intent", "no-intent"]).toContain(model.cardVariant);
    expect(["normal", "harsh"]).toContain(model.analysisMode);
  });
});
