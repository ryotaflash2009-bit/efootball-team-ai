import { describe, it, expect } from "vitest";
import {
  analyzeSavedBuild,
  buildSiblingInputs,
  filterImprovementSuggestionsForIntent,
  type BuildAnalysisInput,
  type BuildAnalysisCardInput,
  type SiblingBuildInput,
  type ImprovementSuggestion,
} from "./build-analysis";
import type { SavedBuild } from "./types";
import { PROGRESSION_RULES_VERSION } from "./constants";
import type { AbilityCardInput } from "./build-ability-impact";
import { WORLD_STAT_KEYS } from "@/lib/world/stats";
import { emptyBuildIntent, type BuildIntentInput } from "./build-intent-analysis";

function makeAbilityBaseStats(overrides: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of WORLD_STAT_KEYS) out[k] = 50;
  return { ...out, ...overrides };
}

function makeAbilityCard(overrides: Partial<AbilityCardInput> = {}): AbilityCardInput {
  return {
    worldCardId: "111",
    baseStats: makeAbilityBaseStats(),
    maximumLevel: 45,
    registeredPosition: "CF",
    ...overrides,
  };
}

function makeBuild(overrides: Partial<SavedBuild> = {}): SavedBuild {
  return {
    buildId: "b1",
    worldCardId: "111",
    buildName: "Test Build",
    progressionAllocation: {},
    selectedPlayerBooster: null,
    conditionalBoosterSelections: [],
    calculatedStats: {},
    calculatedOvr: 90,
    calculationMode: "provisional",
    rulesVersion: PROGRESSION_RULES_VERSION,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    schemaVersion: 1,
    ...overrides,
  };
}

function makeCard(overrides: Partial<BuildAnalysisCardInput> = {}): BuildAnalysisCardInput {
  return {
    worldCardId: "111",
    nameJa: "テスト選手",
    nameEn: "Test Player",
    cardType: "Featured",
    registeredPosition: "CF",
    maximumLevel: 45,
    ovrBase: 85,
    ovrMax: 92,
    boost1: 101,
    boost2: 202,
    ...overrides,
  };
}

function makeInput(overrides: Partial<BuildAnalysisInput> = {}): BuildAnalysisInput {
  return {
    build: makeBuild(),
    card: makeCard(),
    ruleKind: "current",
    hasReferenceAnomaly: false,
    isUsed: false,
    siblings: [],
    ...overrides,
  };
}

describe("analyzeSavedBuild: 決定性", () => {
  it("同じ入力から同じ結果を返す", () => {
    const input = makeInput({ build: makeBuild({ progressionAllocation: { shooting: 5, passing: 1 } }) });
    const a = analyzeSavedBuild(input);
    const b = analyzeSavedBuild(input);
    expect(a).toEqual(b);
  });

  it("JSON クローンした入力でも同じ結果になる", () => {
    const input = makeInput({ build: makeBuild({ progressionAllocation: { shooting: 5, passing: 1 } }) });
    const cloned = JSON.parse(JSON.stringify(input)) as BuildAnalysisInput;
    expect(analyzeSavedBuild(input)).toEqual(analyzeSavedBuild(cloned));
  });

  it("入力オブジェクト（build・card・siblings）を変更しない", () => {
    const build = makeBuild({ progressionAllocation: { shooting: 5, passing: 1 } });
    const card = makeCard();
    const siblings = [
      { buildId: "b2", buildName: "Sibling", progressionAllocation: { passing: 3 }, calculatedOvr: 88, rulesVersion: PROGRESSION_RULES_VERSION, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-03T00:00:00.000Z", used: true },
    ];
    const input = makeInput({ build, card, siblings });
    const beforeBuild = JSON.stringify(build);
    const beforeCard = JSON.stringify(card);
    const beforeSiblings = JSON.stringify(siblings);
    analyzeSavedBuild(input);
    expect(JSON.stringify(build)).toBe(beforeBuild);
    expect(JSON.stringify(card)).toBe(beforeCard);
    expect(JSON.stringify(siblings)).toBe(beforeSiblings);
  });

  it("同点配分でもタイブレークが固定される（複数回実行しても同じ主要カテゴリ）", () => {
    // shooting と passing が同レベル→ PROGRESSION_GROUPS の並び順（shooting が先）でタイブレーク
    const input = makeInput({ build: makeBuild({ progressionAllocation: { passing: 4, shooting: 4 } }) });
    const results = Array.from({ length: 5 }, () => analyzeSavedBuild(input));
    for (const r of results) {
      expect(r.trainingFocus.primaryGroupId).toBe(results[0].trainingFocus.primaryGroupId);
    }
    expect(results[0].trainingFocus.primaryGroupId).toBe("shooting");
  });
});

describe("analyzeSavedBuild: 配分傾向", () => {
  it("配分なしを正しく判定する", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: {} }) }));
    expect(r.trainingFocus.kind).toBe("none");
    expect(r.concerns.some((c) => c.code === "no-allocation")).toBe(true);
  });

  it("特定カテゴリ重視（1カテゴリだけ）を正しく判定する", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 8 } }) }));
    expect(r.trainingFocus.kind).toBe("single");
    expect(r.trainingFocus.primaryGroupId).toBe("shooting");
  });

  it("明確な特化型（差が大きい）を dominant と判定する", () => {
    const r = analyzeSavedBuild(
      makeInput({ build: makeBuild({ progressionAllocation: { shooting: 10, passing: 1, dribbling: 1 } }) }),
    );
    expect(r.trainingFocus.kind).toBe("dominant");
    expect(r.trainingFocus.primaryGroupId).toBe("shooting");
  });

  it("均等配分をバランス型として判定する", () => {
    const r = analyzeSavedBuild(
      makeInput({
        build: makeBuild({ progressionAllocation: { shooting: 4, passing: 4, dribbling: 4, defending: 3 } }),
      }),
    );
    expect(r.trainingFocus.kind).toBe("balanced");
  });

  it("僅差（2番目が僅かに低いだけ）を過度な特化型としない", () => {
    const r = analyzeSavedBuild(
      makeInput({ build: makeBuild({ progressionAllocation: { shooting: 5, passing: 4 } }) }),
    );
    expect(r.trainingFocus.kind).toBe("balanced");
  });

  it("GK カテゴリとフィールドカテゴリを混同しない（underinvested は同系統のみ）", () => {
    const r = analyzeSavedBuild(
      makeInput({ build: makeBuild({ progressionAllocation: { goalkeeping1: 6 } }) }),
    );
    expect(r.trainingFocus.isGoalkeeping).toBe(true);
    expect(r.underinvestedAreas.every((a) => ["goalkeeping2", "goalkeeping3"].includes(a.groupId))).toBe(true);
    expect(r.underinvestedAreas.some((a) => a.groupId === "shooting")).toBe(false);
  });
});

describe("analyzeSavedBuild: ポイント", () => {
  it("使用ポイント・合計ポイント・残りポイントが既存値と一致する", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 2 } }) }));
    expect(r.usedPoints).toBeGreaterThan(0);
    expect(r.totalPoints).not.toBeNull();
    expect(r.remainingPoints).toBe((r.totalPoints ?? 0) - r.usedPoints);
  });

  it("残りポイントが多い場合に注意点/改善候補を出す", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 1 } }) }));
    expect(r.concerns.some((c) => c.code === "many-remaining-points")).toBe(true);
  });

  it("残り0でも架空の問題を作らない（over-allocated を誤って出さない）", () => {
    // 十分に使い切れる程度の配分（over ではない）で、near-complete でも overAllocated=false を維持
    const r = analyzeSavedBuild(makeInput({ card: makeCard({ maximumLevel: 1 }), build: makeBuild({ progressionAllocation: {} }) }));
    expect(r.overAllocated).toBe(false);
  });

  it("maximumLevel 不明（totalPoints null）でも安全に扱う", () => {
    const r = analyzeSavedBuild(makeInput({ card: makeCard({ maximumLevel: null }) }));
    expect(r.totalPoints).toBeNull();
    expect(r.completionState).toBe("unknown");
    expect(r.confidence.level).not.toBe("high");
  });

  it("ポイントを再計算して既存値を書き換えない（buildPointSummary の値をそのまま使う）", () => {
    const build = makeBuild({ progressionAllocation: { shooting: 3 } });
    const r = analyzeSavedBuild(makeInput({ build }));
    // 元の build オブジェクトの育成配分は変化しない
    expect(build.progressionAllocation).toEqual({ shooting: 3 });
    expect(r.usedPoints).toBeGreaterThan(0);
  });
});

describe("analyzeSavedBuild: 長所と注意点", () => {
  it("最大件数を超えない", () => {
    const r = analyzeSavedBuild(
      makeInput({
        ruleKind: "legacy",
        hasReferenceAnomaly: true,
        build: makeBuild({ progressionAllocation: { shooting: 1 } }),
        siblings: [
          { buildId: "s1", buildName: "S1", progressionAllocation: { shooting: 2 }, calculatedOvr: 80, rulesVersion: PROGRESSION_RULES_VERSION, createdAt: "x", updatedAt: "2026-08-05T00:00:00.000Z", used: true },
        ],
      }),
    );
    expect(r.strengths.length).toBeLessThanOrEqual(3);
    expect(r.concerns.length).toBeLessThanOrEqual(3);
    expect(r.improvementSuggestions.length).toBeLessThanOrEqual(3);
  });

  it("同じ内容を重複させない（コードが重複しない）", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 10, passing: 1 } }) }));
    const codes = r.strengths.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("長所がない場合に架空の長所を作らない", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: {} }) }));
    expect(r.strengths.length).toBe(0);
  });

  it("参照異常を通常の注意点より優先する（先頭に来る）", () => {
    const r = analyzeSavedBuild(
      makeInput({ hasReferenceAnomaly: true, build: makeBuild({ progressionAllocation: {} }) }),
    );
    expect(r.concerns[0].code).toBe("reference-anomaly");
  });
});

describe("analyzeSavedBuild: 通常/辛口", () => {
  it("通常評価と辛口評価は同じ入力に対して異なる並び・重みになり得る", () => {
    const r = analyzeSavedBuild(
      makeInput({
        build: makeBuild({ progressionAllocation: { shooting: 3, passing: 3, dribbling: 3 } }),
        siblings: [
          { buildId: "s1", buildName: "S1", progressionAllocation: { shooting: 3, passing: 3, dribbling: 3 }, calculatedOvr: 88, rulesVersion: PROGRESSION_RULES_VERSION, createdAt: "x", updatedAt: "2026-08-05T00:00:00.000Z", used: false },
        ],
      }),
    );
    expect(r.harshReviewPoints.some((p) => p.code === "overlaps-with-sibling")).toBe(true);
    // 通常評価には overlaps-with-sibling を含めない設計
    expect(r.normalReviewPoints.some((p) => p.code === "overlaps-with-sibling")).toBe(false);
  });

  it("勝率・全国順位・試合結果に相当するコードを生成しない", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 5 } }) }));
    const allCodes = [...r.strengths, ...r.concerns, ...r.normalReviewPoints, ...r.harshReviewPoints].map((f) => f.code);
    for (const c of allCodes) {
      expect(c).not.toMatch(/win-rate|ranking|match-result/);
    }
  });

  it("ja/en で同じ分析要素（コード）を使う前提のデータ構造である（コードは locale 非依存）", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 5 } }) }));
    for (const f of [...r.strengths, ...r.concerns]) {
      expect(typeof f.code).toBe("string");
      expect(f.code).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
    }
  });
});

describe("analyzeSavedBuild: 比較", () => {
  it("同一カードだけを比較候補にする（buildSiblingInputs）", () => {
    const builds: SavedBuild[] = [
      makeBuild({ buildId: "b1", worldCardId: "111" }),
      makeBuild({ buildId: "b2", worldCardId: "111" }),
      makeBuild({ buildId: "b3", worldCardId: "999" }),
    ];
    const siblings = buildSiblingInputs(builds, "b1", "111", new Set());
    expect(siblings.map((s) => s.buildId)).toEqual(["b2"]);
  });

  it("他ビルドがない場合に比較を生成しない", () => {
    const r = analyzeSavedBuild(makeInput({ siblings: [] }));
    expect(r.comparisonSummary.length).toBe(0);
  });

  it("最大件数を超えない", () => {
    const siblings = Array.from({ length: 6 }, (_, i) => ({
      buildId: `s${i}`,
      buildName: `S${i}`,
      progressionAllocation: {},
      calculatedOvr: 80,
      rulesVersion: PROGRESSION_RULES_VERSION,
      createdAt: "x",
      updatedAt: `2026-08-0${(i % 9) + 1}T00:00:00.000Z`,
      used: false,
    }));
    const r = analyzeSavedBuild(makeInput({ siblings }));
    expect(r.comparisonSummary.length).toBeLessThanOrEqual(3);
  });

  it("能力値差（calculatedOvr）とポイント差が正しい", () => {
    const r = analyzeSavedBuild(
      makeInput({
        build: makeBuild({ calculatedOvr: 90, progressionAllocation: { shooting: 2 } }),
        siblings: [
          { buildId: "s1", buildName: "S1", progressionAllocation: { shooting: 5 }, calculatedOvr: 95, rulesVersion: PROGRESSION_RULES_VERSION, createdAt: "x", updatedAt: "2026-08-05T00:00:00.000Z", used: false },
        ],
      }),
    );
    expect(r.comparisonSummary[0].calculatedOvrDiff).toBe(5);
    expect(r.comparisonSummary[0].usedPointsDiff).toBeGreaterThan(0);
  });

  it("一方を根拠なく上位と断定しない（比較データに優劣フラグを持たない）", () => {
    const r = analyzeSavedBuild(
      makeInput({
        siblings: [
          { buildId: "s1", buildName: "S1", progressionAllocation: {}, calculatedOvr: 99, rulesVersion: PROGRESSION_RULES_VERSION, createdAt: "x", updatedAt: "2026-08-05T00:00:00.000Z", used: false },
        ],
      }),
    );
    expect(r.comparisonSummary[0]).not.toHaveProperty("isBetter");
    expect(r.comparisonSummary[0]).not.toHaveProperty("recommended");
  });
});

describe("analyzeSavedBuild: 回帰的な安全確認", () => {
  it("カード情報がない場合でも例外を投げず、confidence が unavailable になる", () => {
    const r = analyzeSavedBuild(makeInput({ card: null }));
    expect(r.confidence.level).toBe("unavailable");
  });

  it("参照異常があると confidence が limited 以下になる", () => {
    const r = analyzeSavedBuild(makeInput({ hasReferenceAnomaly: true }));
    expect(["limited", "unavailable"]).toContain(r.confidence.level);
  });

  it("旧規則/規則不明では confidence が medium 以下になる", () => {
    const r = analyzeSavedBuild(makeInput({ ruleKind: "legacy" }));
    expect(["medium", "limited", "unavailable"]).toContain(r.confidence.level);
  });

  it("現行規則・参照異常なし・maximumLevel ありなら high", () => {
    const r = analyzeSavedBuild(makeInput());
    expect(r.confidence.level).toBe("high");
  });
});

describe("analyzeSavedBuild: 能力値インパクト統合（abilityCard）", () => {
  it("abilityCard 未指定（デフォルト）では abilityImpact.available が false のまま（後方互換）", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 5 } }) }));
    expect(r.abilityImpact.available).toBe(false);
  });

  it("abilityCard を渡すと abilityImpact.available が true になり、baseAbilities が取得できる", () => {
    const r = analyzeSavedBuild(
      makeInput({ build: makeBuild({ progressionAllocation: { shooting: 5 } }), abilityCard: makeAbilityCard() }),
    );
    expect(r.abilityImpact.available).toBe(true);
    expect(r.abilityImpact.baseAbilities?.finishing).toBe(50);
  });

  it("abilityCard が null（取得を試みたが失敗）だと confidence が limited 以下になる", () => {
    const r = analyzeSavedBuild(makeInput({ abilityCard: null }));
    expect(["limited", "unavailable"]).toContain(r.confidence.level);
    expect(r.confidence.reasons).toContain("ability-data-unavailable");
  });

  it("通常評価に最も伸びた能力（ability-gain-highlight）が含まれる", () => {
    const r = analyzeSavedBuild(
      makeInput({ build: makeBuild({ progressionAllocation: { shooting: 10 } }), abilityCard: makeAbilityCard() }),
    );
    expect(r.normalReviewPoints.some((f) => f.code === "ability-gain-highlight")).toBe(true);
  });

  it("辛口評価は通常評価の単純な言い換えではなく、能力値成果まで踏み込む", () => {
    const r = analyzeSavedBuild(
      makeInput({ build: makeBuild({ progressionAllocation: { shooting: 10 } }), abilityCard: makeAbilityCard() }),
    );
    expect(r.harshReviewPoints.some((f) => f.code === "ability-gain-highlight")).toBe(true);
    // 通常評価と辛口評価のコード列がそのまま一致しない（同じ言い換えではない）
    expect(r.normalReviewPoints.map((f) => f.code)).not.toEqual(r.harshReviewPoints.map((f) => f.code));
  });

  it("過剰投資候補が検出されると concerns・改善候補の先頭付近に反映される", () => {
    const r = analyzeSavedBuild(
      makeInput({
        build: makeBuild({ progressionAllocation: { shooting: 10 } }),
        abilityCard: makeAbilityCard({ baseStats: makeAbilityBaseStats({ finishing: 90, setPieceTaking: 90, curl: 90 }) }),
      }),
    );
    expect(r.concerns.some((f) => f.code === "overinvestment-candidate")).toBe(true);
    const suggestion = r.improvementSuggestions.find((s) => s.code === "overinvestment-candidate");
    expect(suggestion).toBeDefined();
    // タイトルテンプレート({category}への配分を再確認する)を埋めるための categoryId を含む
    // (含まれない場合、表示側で {category} が未置換のまま残る)。
    expect(suggestion?.params.categoryId).toBe("shooting");
  });

  it("配分が少ないが最終能力値が高い場合、架空の弱点を作らず underinvested-but-high-final を付与する", () => {
    // shooting/passing/dribbling/dexterity/lowerBodyStrength へ配分し、aerialStrength を
    // computeUnderinvestedAreas の先頭候補にする（PROGRESSION_GROUPS の固定順で defending より先）。
    const r = analyzeSavedBuild(
      makeInput({
        build: makeBuild({
          progressionAllocation: { shooting: 10, passing: 1, dribbling: 1, dexterity: 1, lowerBodyStrength: 1 },
          calculatedStats: makeAbilityBaseStats({ heading: 85, jumping: 85, physicalContact: 85 }),
        }),
        abilityCard: makeAbilityCard(),
      }),
    );
    expect(r.underinvestedAreas[0]?.groupId).toBe("aerialStrength");
    expect(r.concerns.some((f) => f.code === "underinvested-but-high-final")).toBe(true);
  });

  it("同一カードの別ビルドとの能力値差（comparisonDifferences）が渡った siblings に基づいて計算される", () => {
    const siblings: SiblingBuildInput[] = [
      {
        buildId: "s1",
        buildName: "Sibling",
        progressionAllocation: {},
        calculatedOvr: 80,
        calculatedStats: makeAbilityBaseStats(),
        rulesVersion: PROGRESSION_RULES_VERSION,
        createdAt: "x",
        updatedAt: "2026-08-05T00:00:00.000Z",
        used: false,
      },
    ];
    const r = analyzeSavedBuild(
      makeInput({
        build: makeBuild({ calculatedStats: makeAbilityBaseStats({ finishing: 90 }) }),
        abilityCard: makeAbilityCard(),
        siblings,
      }),
    );
    expect(r.abilityImpact.comparisonDifferences[0]?.classification).toBe("different-focus");
  });

  it("能力値データが無くてもクラッシュせず、既存の allocation ベースの分析は維持される", () => {
    const r = analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 10 } }), abilityCard: null }));
    expect(r.trainingFocus.kind).toBe("single");
    expect(r.abilityImpact.available).toBe(false);
  });

  it("入力（card・siblings）を変更しない", () => {
    const abilityCard = makeAbilityCard();
    const before = JSON.stringify(abilityCard);
    analyzeSavedBuild(makeInput({ build: makeBuild({ progressionAllocation: { shooting: 5 } }), abilityCard }));
    expect(JSON.stringify(abilityCard)).toBe(before);
  });
});

describe("filterImprovementSuggestionsForIntent: 一般改善候補と目的別改善候補の分離", () => {
  function suggestion(overrides: Partial<ImprovementSuggestion> = {}): ImprovementSuggestion {
    return { priority: 1, code: "no-allocation", targetGroupId: "aerialStrength", targetGroupNameEn: "Aerial Strength", preserveGroupId: null, params: {}, ...overrides };
  }
  function intentWith(overrides: Partial<BuildIntentInput> = {}): BuildIntentInput {
    return { ...emptyBuildIntent(), ...overrides };
  }

  it("目的が未指定の場合はそのまま全件を返す(除外領域がないため)", () => {
    const suggestions = [suggestion({ targetGroupId: "aerialStrength" })];
    expect(filterImprovementSuggestionsForIntent(suggestions, emptyBuildIntent())).toEqual(suggestions);
  });

  it("低優先に指定した領域を対象とする一般改善候補を除外する", () => {
    const suggestions = [suggestion({ targetGroupId: "aerialStrength" }), suggestion({ targetGroupId: "defending", priority: 2 })];
    const intent = intentWith({ groupPriorities: { aerialStrength: "low" } });
    const result = filterImprovementSuggestionsForIntent(suggestions, intent);
    expect(result.some((s) => s.targetGroupId === "aerialStrength")).toBe(false);
    expect(result.some((s) => s.targetGroupId === "defending")).toBe(true);
  });

  it("今回は評価対象外(intentionallyIgnoredGroups)に指定した領域を対象とする一般改善候補を除外する", () => {
    const suggestions = [suggestion({ targetGroupId: "defending" })];
    const intent = intentWith({ intentionallyIgnoredGroups: ["defending"] });
    expect(filterImprovementSuggestionsForIntent(suggestions, intent)).toEqual([]);
  });

  it("実画面の再現: エアバトルが低優先の場合、エアバトルを対象とする改善候補が一般的な観点からも出てこない", () => {
    const suggestions = [suggestion({ targetGroupId: "aerialStrength", priority: 1 })];
    const intent = intentWith({ groupPriorities: { shooting: "priority", dribbling: "priority", aerialStrength: "low" } });
    expect(filterImprovementSuggestionsForIntent(suggestions, intent)).toEqual([]);
  });

  it("対象領域がnull(全般的な所見)の改善候補は除外しない", () => {
    const suggestions = [suggestion({ targetGroupId: null })];
    const intent = intentWith({ groupPriorities: { aerialStrength: "low" } });
    expect(filterImprovementSuggestionsForIntent(suggestions, intent)).toEqual(suggestions);
  });

  it("除外対象でない領域を対象とする改善候補はそのまま残す", () => {
    const suggestions = [suggestion({ targetGroupId: "shooting" })];
    const intent = intentWith({ groupPriorities: { aerialStrength: "low" } });
    expect(filterImprovementSuggestionsForIntent(suggestions, intent)).toEqual(suggestions);
  });
});
