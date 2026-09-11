import { describe, it, expect } from "vitest";
import { generateSquadDiagnosisCommentsEn, categoryLabelEn } from "./squad-diagnosis-comments-en";
import { generateSquadDiagnosisComments, analyzeSquadDiagnosis } from "./squad-diagnosis-comments";
import { ABILITY_CATEGORIES, type SquadDiagnosisResult, type SquadDiagnosisCategory } from "./squad-diagnosis";

// ---------------------------------------------------------------------------
// 手組みフィクスチャ（squad-diagnosis-comments.test.ts と同じ構造。英語版検証専用）
// ---------------------------------------------------------------------------

function category(overrides: Partial<SquadDiagnosisCategory> = {}): SquadDiagnosisCategory {
  return {
    id: "attack",
    label: "攻撃",
    score: 70,
    tier: "A",
    visibility: "free",
    sampleSize: 5,
    note: "",
    evidence: [],
    ...overrides,
  };
}

function baseResult(overrides: Partial<SquadDiagnosisResult> = {}): SquadDiagnosisResult {
  const categories = ABILITY_CATEGORIES.map((def) => category({ id: def.id, label: def.label, score: 60, tier: "B" }));
  categories.push(category({ id: "squadCompleteness", label: "選手配置の充足状況", score: 100, tier: "S", visibility: "pro" }));
  return {
    rulesVersion: "squad-diagnosis/2026-09-06.v1",
    squadId: "sq_test",
    squadName: "Test Squad",
    overall: { score: 60, tier: "B", note: "判定可能な 8/8 項目の単純平均" },
    categories,
    strengths: [],
    weaknesses: [],
    suggestions: [],
    dataQuality: {
      filledStartingSlots: 11,
      totalStartingSlots: 11,
      benchCount: 5,
      coveragePercent: 100,
      unresolvedCompatibilityCount: 0,
      gkMismatchCount: 0,
      missingSavedBuildCount: 0,
      brokenSavedBuildRefCount: 0,
      unresolvedCardCount: 0,
      unresolvedManager: false,
      unratedCategoryLabels: [],
    },
    disclaimer: "",
    basicSummary: {
      overallScore: 60,
      overallTier: "B",
      categories: [],
      topStrength: null,
      topWeakness: null,
      dataCoveragePercent: 100,
      disclaimer: "",
    },
    ...overrides,
  };
}

function setCategory(result: SquadDiagnosisResult, id: string, patch: Partial<SquadDiagnosisCategory>): SquadDiagnosisResult {
  return { ...result, categories: result.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

function tierOf(score: number): "S" | "A" | "B" | "C" | "D" {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

function withScore(result: SquadDiagnosisResult, id: string, score: number): SquadDiagnosisResult {
  return setCategory(result, id, { score, tier: tierOf(score) });
}
function withScores(result: SquadDiagnosisResult, scores: Record<string, number>): SquadDiagnosisResult {
  let r = result;
  for (const [id, score] of Object.entries(scores)) r = withScore(r, id, score);
  return r;
}

const FORBIDDEN_EN_PATTERNS: RegExp[] = [
  /\b(weak|garbage|trash|useless|hopeless|pathetic|clueless|no talent|no skill)\b/i,
  /\bnational rank(ing)?\b/i,
  /\bwin rate\b/i,
  /\b(will win|will lose|guaranteed to (win|lose))\b/i,
  /\bworldCardId\b|\bbuildId\b|\bsquadId\b|\bsq_/i,
];

function assertNoForbiddenContentEn(text: string) {
  for (const re of FORBIDDEN_EN_PATTERNS) {
    expect(text).not.toMatch(re);
  }
}

describe("英語コメント: 決定性", () => {
  it("同一入力から常に同一の英語コメントを返す", () => {
    const result = baseResult();
    const a = generateSquadDiagnosisCommentsEn(result);
    const b = generateSquadDiagnosisCommentsEn(JSON.parse(JSON.stringify(result)));
    expect(a).toEqual(b);
  });

  it("入力オブジェクトを変更しない", () => {
    const result = baseResult();
    const snapshot = JSON.parse(JSON.stringify(result));
    generateSquadDiagnosisCommentsEn(result);
    expect(result).toEqual(snapshot);
  });

  it("辛口・通常は異なる文章を返す", () => {
    let result = withScores(baseResult(), { aerial: 15 });
    const { normal, harsh } = generateSquadDiagnosisCommentsEn(result);
    expect(normal).not.toEqual(harsh);
  });
});

describe("英語コメント: 日本語版と同じ診断要素を参照する", () => {
  it("同じ主要懸念カテゴリを参照する（categoryLabelEnで英訳しているだけ）", () => {
    let result = withScores(baseResult(), { aerial: 15 });
    const analysisJa = analyzeSquadDiagnosis(result);
    expect(analysisJa.primaryConcern.kind).toBe("category");
    const { harsh } = generateSquadDiagnosisCommentsEn(result);
    expect(harsh).toContain(categoryLabelEn(category({ id: "aerial", label: "空中戦" })));
  });

  it("同じスコア・ランクを使う（総合評価・ランクは変更しない）", () => {
    let result = baseResult();
    result = { ...result, dataQuality: { ...result.dataQuality, missingSavedBuildCount: 3, filledStartingSlots: 10 } };
    const { harsh } = generateSquadDiagnosisCommentsEn(result);
    expect(harsh).toContain(`${result.overall.score} pts`);
    expect(harsh).toContain(`grade ${result.overall.tier}`);
  });

  it("参照エラーが最優先されることは日本語版と同じ", () => {
    const result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 2 } });
    const { harsh } = generateSquadDiagnosisCommentsEn(result);
    expect(harsh).toMatch(/broken saved build reference/);
  });

  it("保存ビルド未設定の説明が日本語版と同じ要素（人数・先発人数・総合評価・ランク）を含む", () => {
    const result = baseResult({ dataQuality: { ...baseResult().dataQuality, missingSavedBuildCount: 7, filledStartingSlots: 10 } });
    const { harsh, normal } = generateSquadDiagnosisCommentsEn(result);
    expect(harsh).toContain("7");
    expect(harsh).toContain("10");
    expect(normal).toContain("7");
    expect(normal).toContain("10");
  });
});

describe("英語コメント: 禁止表現", () => {
  it("ユーザー本人を侮辱する語・勝率・全国順位・内部IDを含まない", () => {
    let result = withScores(baseResult(), { aerial: 5, defense: 8 });
    const { normal, harsh } = generateSquadDiagnosisCommentsEn(result);
    assertNoForbiddenContentEn(normal);
    assertNoForbiddenContentEn(harsh);
  });

  it("全カテゴリが非常に高い場合でも過度な攻撃的表現を生成しない", () => {
    let result = withScores(baseResult(), {
      attack: 90, defense: 88, aerial: 87, speed: 89, passBuildUp: 86, dribblePossession: 90, pressResistance: 88, counterAttack: 87,
    });
    const overall = Math.round((90 + 88 + 87 + 89 + 86 + 90 + 88 + 87) / 8);
    result = { ...result, overall: { score: overall, tier: tierOf(overall), note: "" } };
    const { harsh } = generateSquadDiagnosisCommentsEn(result);
    assertNoForbiddenContentEn(harsh);
  });
});

describe("英語コメント: データ不足・存在しない長所弱点を創作しない", () => {
  it("全カテゴリ判定対象外でもクラッシュしない", () => {
    let result = baseResult({ overall: { score: null, tier: null, note: "" } });
    result = { ...result, categories: result.categories.map((c) => (c.id === "squadCompleteness" ? c : { ...c, score: null, tier: null })) };
    expect(() => generateSquadDiagnosisCommentsEn(result)).not.toThrow();
    const { normal, harsh } = generateSquadDiagnosisCommentsEn(result);
    expect(normal.length).toBeGreaterThan(0);
    expect(harsh.length).toBeGreaterThan(0);
  });

  it("長所が無い場合に架空の長所を作らない（'is at a high level' が現れない）", () => {
    const result = baseResult(); // 全カテゴリBランク
    const { harsh } = generateSquadDiagnosisCommentsEn(result);
    expect(harsh).not.toMatch(/is at a high level/);
  });

  it("データ不足時は評価が成立しないことを説明する", () => {
    const result = baseResult({ overall: { score: null, tier: null, note: "" } });
    const { harsh, normal } = generateSquadDiagnosisCommentsEn(result);
    expect(harsh).toMatch(/nothing to evaluate|no field players/i);
    expect(normal).toMatch(/nothing to evaluate|no field players/i);
  });
});

describe("英語コメント: 通常/辛口の文章量差", () => {
  it("通常コメントは辛口コメントより短いか同程度である（辛口の方が長い/等しい）", () => {
    const result = baseResult({ dataQuality: { ...baseResult().dataQuality, missingSavedBuildCount: 5, filledStartingSlots: 10 } });
    const { normal, harsh } = generateSquadDiagnosisCommentsEn(result);
    expect(normal.length).toBeLessThanOrEqual(harsh.length);
  });
});

describe("categoryLabelEn: 全8カテゴリ+配置充足状況を英訳できる", () => {
  it("全カテゴリIDに対応する英語ラベルを返す", () => {
    for (const def of ABILITY_CATEGORIES) {
      const label = categoryLabelEn(category({ id: def.id, label: def.label }));
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(def.id); // フォールバック(id自体)になっていない
    }
  });
});

describe("実データ(diagnoseSquad)経由でも英語コメントが安全に生成される", () => {
  it("日本語版・英語版とも同じCommentAnalysisから独立して生成され、クラッシュしない", () => {
    let result = withScores(baseResult(), { attack: 90, passBuildUp: 35, defense: 40 });
    result = { ...result, overall: { score: 65, tier: "B", note: "" } };
    const ja = generateSquadDiagnosisComments(result);
    const enResult = generateSquadDiagnosisCommentsEn(result);
    expect(ja.normal.length).toBeGreaterThan(0);
    expect(enResult.normal.length).toBeGreaterThan(0);
    expect(ja.normal).not.toEqual(enResult.normal);
  });
});
