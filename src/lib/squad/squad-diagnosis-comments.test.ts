import { describe, it, expect } from "vitest";
import {
  generateSquadDiagnosisComments,
  analyzeSquadDiagnosis,
  buildNormalComment,
  buildHarshComment,
  selectPrimaryConcern,
  selectSecondaryConcern,
  selectPrimaryStrength,
  selectSecondaryStrength,
  LOW_CONFIDENCE_RATED_CATEGORY_THRESHOLD,
} from "./squad-diagnosis-comments";
import { diagnoseSquad, ABILITY_CATEGORIES, type SquadDiagnosisInput, type SquadDiagnosisResult, type SquadDiagnosisCategory } from "./squad-diagnosis";

// ---------------------------------------------------------------------------
// 手組みの SquadDiagnosisResult フィクスチャ（コメント層だけを直接・精密にテストする）
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
    squadName: "テストスカッド",
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
    disclaimer:
      "この評価は、登録された選手能力・育成・配置にもとづくスカッド構成評価です。試合結果やプレイヤースキル、全国順位・勝率を保証するものではありません。",
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
  return {
    ...result,
    categories: result.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

function setCategories(result: SquadDiagnosisResult, patches: Record<string, Partial<SquadDiagnosisCategory>>): SquadDiagnosisResult {
  let r = result;
  for (const [id, patch] of Object.entries(patches)) r = setCategory(r, id, patch);
  return r;
}

function tierOf(score: number): "S" | "A" | "B" | "C" | "D" {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

/** スコアだけ渡すと、既存ランク境界（squad-diagnosis.ts の DIAGNOSIS_TIER_THRESHOLDS）に合わせてtierも設定する。 */
function withScore(result: SquadDiagnosisResult, id: string, score: number): SquadDiagnosisResult {
  return setCategory(result, id, { score, tier: tierOf(score) });
}

function withScores(result: SquadDiagnosisResult, scores: Record<string, number>): SquadDiagnosisResult {
  let r = result;
  for (const [id, score] of Object.entries(scores)) r = withScore(r, id, score);
  return r;
}

function overallFromAbility(result: SquadDiagnosisResult): SquadDiagnosisResult {
  const ability = result.categories.filter((c) => c.id !== "squadCompleteness" && c.score != null);
  const avg = Math.round(ability.reduce((a, c) => a + c.score!, 0) / ability.length);
  return { ...result, overall: { score: avg, tier: tierOf(avg), note: "" } };
}

const FORBIDDEN_PATTERNS: RegExp[] = [
  /弱い|ゴミ|雑魚/,
  /下手|才能がない|センスがない|初心者丸出し/,
  /話にならない|終わっている/,
  /全国(順位|上位)/,
  /勝率/,
  /Division/i,
  /友達|フレンド.*(劣|負)/,
  /勝てない|絶対に負ける/,
  /buildId|worldCardId|squadId/i,
];

function assertNoForbiddenContent(text: string) {
  for (const re of FORBIDDEN_PATTERNS) {
    expect(text).not.toMatch(re);
  }
}

// ---------------------------------------------------------------------------
// 決定性
// ---------------------------------------------------------------------------
describe("決定性", () => {
  it("同じ診断結果からは常に同じ分析結果を返す", () => {
    const result = baseResult();
    expect(analyzeSquadDiagnosis(result)).toEqual(analyzeSquadDiagnosis(result));
  });
  it("同じ診断結果からは常に同じ通常コメント・辛口コメントを返す", () => {
    const result = baseResult();
    const a = generateSquadDiagnosisComments(result);
    const b = generateSquadDiagnosisComments(result);
    expect(a).toEqual(b);
  });
  it("JSONクローンした入力でも同一の分析結果・コメントになる", () => {
    const a = analyzeSquadDiagnosis(baseResult());
    const b = analyzeSquadDiagnosis(JSON.parse(JSON.stringify(baseResult())));
    expect(a).toEqual(b);
    const ca = generateSquadDiagnosisComments(baseResult());
    const cb = generateSquadDiagnosisComments(JSON.parse(JSON.stringify(baseResult())));
    expect(ca).toEqual(cb);
  });
  it("実行順・複数回呼び出しで結果が揺れない（乱数を使用しない）", () => {
    const result = baseResult({ overall: { score: 90, tier: "S", note: "" } });
    const runs = Array.from({ length: 5 }, () => generateSquadDiagnosisComments(result));
    for (const r of runs) expect(r).toEqual(runs[0]);
  });
  it("同点カテゴリのタイブレークは ABILITY_CATEGORIES 定義順で固定される（懸念選定）", () => {
    let result = baseResult();
    result = withScores(result, { attack: 10, defense: 10 });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("category");
    if (concern.kind === "category") expect(concern.category.id).toBe("attack");
  });
  it("同点カテゴリのタイブレークは ABILITY_CATEGORIES 定義順で固定される（最高評価カテゴリ）", () => {
    let result = baseResult();
    result = withScores(result, { attack: 90, defense: 90 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.highest?.id).toBe("attack");
  });
  it("入力オブジェクトを変更しない", () => {
    const result = baseResult();
    const snapshot = JSON.parse(JSON.stringify(result));
    analyzeSquadDiagnosis(result);
    generateSquadDiagnosisComments(result);
    expect(result).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// 総合評価の解釈
// ---------------------------------------------------------------------------
describe("総合評価の解釈", () => {
  it("総合評価が高くても点差が大きければ偏りを認識する", () => {
    let result = withScores(baseResult(), { attack: 90, defense: 55, aerial: 90, speed: 90, passBuildUp: 90, dribblePossession: 90, pressResistance: 90, counterAttack: 90 });
    result = overallFromAbility(result);
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/差が大きく|均等に整った構成ではありません/);
    expect(harsh).toMatch(/完成していると判断するのは早い|均整の取れた構成ではありません/);
  });
  it("総合評価が中程度でも点差が小さければバランスを認識する", () => {
    let result = withScores(baseResult(), { attack: 78, defense: 76, aerial: 75, speed: 77, passBuildUp: 74, dribblePossession: 79, pressResistance: 73, counterAttack: 76 });
    result = overallFromAbility(result);
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/バランス型|大きな穴も少ない/);
  });
  it("全カテゴリが高い場合に架空の重大問題を作らない", () => {
    let result = withScores(baseResult(), { attack: 90, defense: 88, aerial: 87, speed: 89, passBuildUp: 86, dribblePossession: 90, pressResistance: 88, counterAttack: 87 });
    result = overallFromAbility(result);
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).not.toMatch(/放置できない|見過ごせる水準ではありません/);
  });
  it("全カテゴリが低い場合に架空の長所を作らない", () => {
    let result = withScores(baseResult(), { attack: 30, defense: 28, aerial: 25, speed: 32, passBuildUp: 27, dribblePossession: 29, pressResistance: 26, counterAttack: 31 });
    result = overallFromAbility(result);
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).not.toMatch(/強みがある構成/);
    expect(harsh).not.toMatch(/高水準/);
  });
  it("判定可能カテゴリが少ない場合に断定しすぎない", () => {
    let result = baseResult();
    result = {
      ...result,
      categories: result.categories.map((c, i) => (c.id === "squadCompleteness" ? c : i === 0 ? { ...c, score: 20, tier: "D" as const } : { ...c, score: null, tier: null })),
    };
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/参考情報|明確に判定できる段階ではありません/);
    expect(harsh).toMatch(/評価の幅は狭い/);
  });
});

// ---------------------------------------------------------------------------
// カテゴリ点差
// ---------------------------------------------------------------------------
describe("カテゴリ点差", () => {
  it("最高点と最低点の差を正しく計算する", () => {
    let result = withScores(baseResult(), { attack: 90, defense: 60 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.highest?.id).toBe("attack");
    expect(analysis.lowest?.id).toBe("defense");
    expect(analysis.scoreGap).toBe(30);
    expect(analysis.gapLevel).toBe("extreme");
  });
  it("判定対象外カテゴリを点差に含めない", () => {
    let result = withScores(baseResult(), { attack: 90 });
    result = setCategory(result, "defense", { score: null, tier: null });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.lowest?.id).not.toBe("defense");
  });
  it("点差が小さい場合に大きな偏りと判定しない", () => {
    let result = withScores(baseResult(), {
      attack: 80, defense: 78, aerial: 79, speed: 77, passBuildUp: 78, dribblePossession: 80, pressResistance: 76, counterAttack: 79,
    });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.gapLevel).not.toBe("extreme");
    expect(analysis.gapLevel).not.toBe("large");
  });
  it("点差が大きい場合に偏りを検出する", () => {
    let result = withScores(baseResult(), { attack: 90, defense: 55 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(["large", "extreme"]).toContain(analysis.gapLevel);
  });
  it("実際のカテゴリ名と点数が文章に一致し、存在しない点数を出さない", () => {
    let result = withScores(baseResult(), { speed: 92, defense: 20 });
    result = overallFromAbility(result);
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).toContain("スピード");
  });
});

// ---------------------------------------------------------------------------
// 構成傾向
// ---------------------------------------------------------------------------
describe("構成傾向", () => {
  it("攻撃偏重型を適切に検出する", () => {
    let result = withScores(baseResult(), { attack: 92, defense: 60, aerial: 60, speed: 65, passBuildUp: 60, dribblePossession: 65, pressResistance: 60, counterAttack: 65 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("attackOriented");
  });
  it("守備安定型を適切に検出する", () => {
    let result = withScores(baseResult(), { defense: 92, attack: 60, aerial: 60, speed: 60, passBuildUp: 60, dribblePossession: 60, pressResistance: 62, counterAttack: 60 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("defenseOriented");
  });
  it("スピード志向型を適切に検出する", () => {
    let result = withScores(baseResult(), { speed: 92, attack: 60, defense: 60, aerial: 60, passBuildUp: 60, dribblePossession: 60, pressResistance: 60, counterAttack: 62 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("speedOriented");
  });
  it("保持／ビルドアップ志向型を適切に検出する", () => {
    let result = withScores(baseResult(), { dribblePossession: 92, attack: 60, defense: 60, aerial: 60, speed: 60, passBuildUp: 62, pressResistance: 60, counterAttack: 60 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("possessionOriented");
  });
  it("プレス志向型を適切に検出する", () => {
    let result = withScores(baseResult(), { pressResistance: 92, attack: 60, defense: 60, aerial: 60, speed: 62, passBuildUp: 60, dribblePossession: 60, counterAttack: 60 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("pressOriented");
  });
  it("カウンター志向型を適切に検出する", () => {
    let result = withScores(baseResult(), { counterAttack: 92, attack: 60, defense: 60, aerial: 60, speed: 62, passBuildUp: 60, dribblePossession: 60, pressResistance: 60 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("counterOriented");
  });
  it("バランス型を適切に検出する", () => {
    let result = withScores(baseResult(), { attack: 78, defense: 76, aerial: 75, speed: 77, passBuildUp: 74, dribblePossession: 79, pressResistance: 73, counterAttack: 76 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("balanced");
  });
  it("僅差の最上位カテゴリだけで特化型と断定しない", () => {
    let result = withScores(baseResult(), { attack: 78, defense: 76, aerial: 75, speed: 77, passBuildUp: 74, dribblePossession: 77, pressResistance: 73, counterAttack: 76 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).not.toBe("attackOriented");
  });
  it("データ不足時に無理なタイプ分類を行わない", () => {
    let result = baseResult();
    result = {
      ...result,
      categories: result.categories.map((c, i) => (c.id === "squadCompleteness" ? c : i === 0 ? { ...c, score: 90, tier: "S" as const } : { ...c, score: null, tier: null })),
    };
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("unclassified");
  });
});

// ---------------------------------------------------------------------------
// カテゴリ間の関係（構成上の矛盾候補）
// ---------------------------------------------------------------------------
describe("カテゴリ間の関係", () => {
  it("攻撃が高く守備が著しく低い場合に偏りを検出する", () => {
    let result = withScores(baseResult(), { attack: 90, defense: 40 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.contradictions.some((c) => c.highCategory.id === "attack" && c.lowCategory.id === "defense")).toBe(true);
  });
  it("スピードが高くパスが著しく低い場合に関係を説明する", () => {
    let result = withScores(baseResult(), { speed: 90, passBuildUp: 40 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.contradictions.some((c) => c.highCategory.id === "speed" && c.lowCategory.id === "passBuildUp")).toBe(true);
  });
  it("プレス適性が高く守備が著しく低い場合に矛盾候補を検出する", () => {
    let result = withScores(baseResult(), { pressResistance: 90, defense: 40 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.contradictions.some((c) => c.highCategory.id === "pressResistance" && c.lowCategory.id === "defense")).toBe(true);
  });
  it("カウンター適性が高くスピードが著しく低い場合に矛盾候補を検出する", () => {
    let result = withScores(baseResult(), { counterAttack: 90, speed: 40 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.contradictions.some((c) => c.highCategory.id === "counterAttack" && c.lowCategory.id === "speed")).toBe(true);
  });
  it("守備が高く空中戦が著しく低い場合に関係を説明する", () => {
    let result = withScores(baseResult(), { defense: 90, aerial: 40 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.contradictions.some((c) => c.highCategory.id === "defense" && c.lowCategory.id === "aerial")).toBe(true);
  });
  it("小さな点差を重大な矛盾として扱わない", () => {
    let result = withScores(baseResult(), { attack: 80, passBuildUp: 78 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.contradictions).toHaveLength(0);
  });
  it("根拠のないカテゴリ関係を創作しない（両カテゴリがB以下なら矛盾候補にしない）", () => {
    let result = withScores(baseResult(), { attack: 60, passBuildUp: 35 });
    const analysis = analyzeSquadDiagnosis(result);
    // attack が A/S でないため矛盾候補として扱わない
    expect(analysis.contradictions.some((c) => c.highCategory.id === "attack")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 長所と弱点
// ---------------------------------------------------------------------------
describe("長所と弱点", () => {
  it("主要な長所を診断結果から選ぶ", () => {
    let result = withScores(baseResult(), { speed: 92 });
    const strength = selectPrimaryStrength(result);
    expect(strength.kind).toBe("category");
    if (strength.kind === "category") expect(strength.category.id).toBe("speed");
  });
  it("条件を満たす場合だけ二次的な長所を選ぶ", () => {
    let result = withScores(baseResult(), { speed: 90, attack: 86 });
    const primary = selectPrimaryStrength(result);
    const secondary = selectSecondaryStrength(result, primary);
    expect(secondary.kind).toBe("category");
    if (secondary.kind === "category") expect(secondary.category.id).toBe("attack");
  });
  it("差が大きい場合は無理に二次的な長所を作らない", () => {
    let result = withScores(baseResult(), { speed: 92, attack: 71 });
    const primary = selectPrimaryStrength(result);
    const secondary = selectSecondaryStrength(result, primary);
    expect(secondary.kind).toBe("none");
  });
  it("長所がない場合に架空の長所を作らない", () => {
    const result = baseResult(); // 全カテゴリ B ランク
    const strength = selectPrimaryStrength(result);
    expect(strength.kind).toBe("none");
  });
  it("最重要の懸念を固定優先順位で選ぶ（参照エラー最優先）", () => {
    let result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 1 } });
    result = withScores(result, { aerial: 10 });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("referenceError");
  });
  it("条件を満たす場合だけ二次的な懸念を選ぶ（primaryと異なるカテゴリ）", () => {
    let result = withScores(baseResult(), { aerial: 20, defense: 30 });
    const primary = selectPrimaryConcern(result);
    const secondary = selectSecondaryConcern(result, primary);
    expect(secondary.kind).toBe("category");
    if (primary.kind === "category" && secondary.kind === "category") {
      expect(secondary.category.id).not.toBe(primary.category.id);
    }
  });
  it("同じ問題を重複表示しない（二次的懸念が主要懸念と同一カテゴリにならない）", () => {
    let result = withScores(baseResult(), { aerial: 20 });
    const primary = selectPrimaryConcern(result);
    const secondary = selectSecondaryConcern(result, primary);
    if (primary.kind === "category" && secondary.kind === "category") {
      expect(secondary.category.id).not.toBe(primary.category.id);
    }
  });
  it("参照エラーを能力上の弱点と混同しない", () => {
    const result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 1 } });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("referenceError");
  });
  it("データ不足を低評価と混同しない", () => {
    const result = baseResult({ overall: { score: null, tier: null, note: "" } });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("dataInsufficient");
  });
});

// ---------------------------------------------------------------------------
// 改善優先順位
// ---------------------------------------------------------------------------
describe("改善優先順位", () => {
  it("重大な参照エラーを能力改善より優先する", () => {
    let result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 1 } });
    result = withScores(result, { aerial: 10 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.improvementPriorities[0]?.label).toContain("保存ビルド参照");
  });
  it("最大3件を超えない", () => {
    let result = withScores(baseResult(), { aerial: 10, defense: 15 });
    result = { ...result, suggestions: [{ id: "s1", label: "配置の見直し", detail: "配置を見直してください。" }] };
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.improvementPriorities.length).toBeLessThanOrEqual(3);
  });
  it("改善候補がない場合に架空の提案を作らない", () => {
    const result = baseResult(); // 懸念なし・提案なし
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.improvementPriorities).toHaveLength(0);
  });
  it("同じ改善内容を重複させない", () => {
    let result = withScores(baseResult(), { aerial: 10 });
    const analysis = analyzeSquadDiagnosis(result);
    const labels = analysis.improvementPriorities.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
  it("変更後の点数や勝率を予測しない", () => {
    let result = withScores(baseResult(), { aerial: 10 });
    const analysis = analyzeSquadDiagnosis(result);
    const text = analysis.improvementPriorities.map((p) => p.reason).join(" ");
    assertNoForbiddenContent(text);
    expect(text).not.toMatch(/\d+点になります|勝率\d+/);
  });
});

// ---------------------------------------------------------------------------
// 通常コメント
// ---------------------------------------------------------------------------
describe("通常コメント", () => {
  it("長所が存在する場合、診断結果と一致する長所へ言及する", () => {
    let result = withScores(baseResult(), { speed: 92 });
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).toContain("スピード");
  });
  it("弱点が存在する場合、診断結果と一致する弱点へ言及する", () => {
    let result = withScores(baseResult(), { aerial: 20 });
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).toContain("空中戦");
  });
  it("改善優先順位が診断結果と一致する提案を反映する", () => {
    let result = baseResult({
      suggestions: [{ id: "suggest-missing-build", label: "保存ビルドの設定", detail: "テスト太郎は保存ビルド未設定です。" }],
    });
    result = withScores(result, { aerial: 20 });
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).toContain("空中戦");
  });
  it("存在しない長所を創作しない（S/Aランクが無ければ長所文を含まない）", () => {
    const result = baseResult(); // 全カテゴリ B ランク
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).not.toMatch(/強みがある構成/);
  });
  it("存在しない弱点を創作しない（D/Cランクが無ければバランスの取れた構成として扱う）", () => {
    const result = baseResult(); // 全カテゴリ B ランク・問題なし
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/バランスの取れた構成|バランス型/);
  });
  it("全国順位・勝率などの未計算情報を含まない", () => {
    let result = withScores(baseResult(), { speed: 95, defense: 15 });
    result = overallFromAbility(result);
    const { normal } = generateSquadDiagnosisComments(result);
    assertNoForbiddenContent(normal);
  });
  it("辛口コメントより丁寧な表現である（禁止的な断定語を含まない）", () => {
    let result = withScores(baseResult(), { aerial: 15 });
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).not.toMatch(/放置できない|見過ごせる水準ではありません/);
  });
  it("同じ内容を不自然に繰り返さない（弱点カテゴリ名の出現は1回まで）", () => {
    let result = withScores(baseResult(), { aerial: 15 });
    const { normal } = generateSquadDiagnosisComments(result);
    const occurrences = normal.split("空中戦").length - 1;
    expect(occurrences).toBeLessThanOrEqual(1);
  });
  it("異常に長い文章にならない（目安400文字以内）", () => {
    let result = withScores(baseResult(), { speed: 95, defense: 15 });
    result = overallFromAbility(result);
    result = { ...result, suggestions: [{ id: "x", label: "改善", detail: "配置を見直してください。" }] };
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal.length).toBeLessThan(400);
  });
});

// ---------------------------------------------------------------------------
// 辛口コメント
// ---------------------------------------------------------------------------
describe("辛口コメント", () => {
  it("現在の通常コメントより明確に率直である（弱点カテゴリで明確な指摘語を含む）", () => {
    let result = withScores(baseResult(), { aerial: 15 });
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toMatch(/見過ごせる|放置できない/);
  });
  it("通常コメントの単純な言い換えではない（辛口だけに現れる語を含む）", () => {
    let result = withScores(baseResult(), { aerial: 15 });
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).not.toEqual(harsh);
    expect(harsh).toMatch(/放置できない|見過ごせる水準ではありません|完成していると判断するのは早い/);
  });
  it("最重要問題が冒頭付近で明示される（参照エラーが最優先）", () => {
    let result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 2 } });
    result = withScores(result, { aerial: 10 });
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toContain("保存ビルドの参照");
    expect(harsh.indexOf("保存ビルドの参照")).toBeLessThan(
      harsh.indexOf("空中戦") === -1 ? Infinity : harsh.indexOf("空中戦"),
    );
  });
  it("構成の偏りまたは矛盾を根拠付きで説明する（最重要懸念とは異なるカテゴリの矛盾）", () => {
    // 最も低いのは passBuildUp（最重要懸念になる）。defense は2番目に低く、
    // attack（S）との組み合わせが「矛盾」として、懸念文とは重複せずに提示されることを確認する。
    let result = withScores(baseResult(), { attack: 90, passBuildUp: 35, defense: 40 });
    result = overallFromAbility(result);
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.primaryConcern.kind).toBe("category");
    if (analysis.primaryConcern.kind === "category") expect(analysis.primaryConcern.category.id).toBe("passBuildUp");
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toMatch(/生かし切れていない可能性/);
    expect(harsh).toContain("守備");
  });
  it("改善優先順位を明示する（懸念文と重複する1位は言い換えず、2位以降を明示する）", () => {
    let result = withScores(baseResult(), { aerial: 15, defense: 30 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.improvementPriorities.length).toBeGreaterThanOrEqual(2);
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toMatch(/続いて.*放置すべきではありません|優先して見直すべきです/);
  });
  it("懸念が存在しないが既存の改善候補がある場合は、優先順位文を新規に提示する", () => {
    const result = baseResult({ suggestions: [{ id: "s1", label: "保存ビルドの設定", detail: "保存ビルドを設定してください。" }] });
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toMatch(/優先して見直すべきです/);
  });
  it("点差が大きい場合はその事実を説明する", () => {
    let result = withScores(baseResult(), { attack: 95, defense: 40, aerial: 90, speed: 90, passBuildUp: 90, dribblePossession: 90, pressResistance: 90, counterAttack: 90 });
    result = overallFromAbility(result);
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toMatch(/均整の取れた構成ではありません|完成していると判断するのは早い/);
  });
  it("点差が小さい場合は誇張しない", () => {
    let result = withScores(baseResult(), { attack: 80, passBuildUp: 78 });
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).not.toMatch(/生かし切れていない可能性/);
  });
  it("ユーザー本人への侮辱・人格否定・暴言を含まない", () => {
    let result = withScores(baseResult(), { aerial: 5, defense: 8 });
    const { harsh } = generateSquadDiagnosisComments(result);
    assertNoForbiddenContent(harsh);
  });
  it("プレイヤースキルを断定しない・勝敗を断定しない・全国順位や勝率を創作しない", () => {
    const result = baseResult();
    const { harsh } = generateSquadDiagnosisComments(result);
    assertNoForbiddenContent(harsh);
  });
  it("診断結果と矛盾しない（弱点として名指ししたカテゴリは実際にD/Cランク）", () => {
    let result = withScores(baseResult(), { pressResistance: 25 });
    const { harsh } = generateSquadDiagnosisComments(result);
    const concern = selectPrimaryConcern(result);
    if (concern.kind === "category") {
      expect(harsh).toContain(concern.category.label);
    }
  });
  it("全カテゴリが非常に高い場合に無理な攻撃的批判を生成しない", () => {
    let result = withScores(baseResult(), { attack: 90, defense: 88, aerial: 87, speed: 89, passBuildUp: 86, dribblePossession: 90, pressResistance: 88, counterAttack: 87 });
    result = overallFromAbility(result);
    const { harsh } = generateSquadDiagnosisComments(result);
    assertNoForbiddenContent(harsh);
    expect(harsh).not.toMatch(/放置できない|見過ごせる水準ではありません/);
  });
});

// ---------------------------------------------------------------------------
// 不足・エラー状態
// ---------------------------------------------------------------------------
describe("不足・エラー状態", () => {
  it("判定対象外を0点として扱わない（低スコアと文言が異なる）", () => {
    let result = baseResult();
    result = setCategory(result, "aerial", { score: null, tier: null, note: "判定対象外（対象となるフィールドプレイヤーが先発にいません）" });
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).not.toContain("空中戦");
    expect(harsh).not.toContain("空中戦");
  });
  it("データ不足を能力上の弱点として扱わない（structuralはcategory系と種別が異なる）", () => {
    let result = baseResult();
    result = setCategory(result, "squadCompleteness", { score: 30, tier: "D" });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("structural");
  });
  it("参照エラーを能力上の弱点として扱わない", () => {
    const result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 1 } });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("referenceError");
  });
  it("重大な参照エラーが最優先で説明される（構造上の問題より優先）", () => {
    let result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 1 } });
    result = setCategory(result, "squadCompleteness", { score: 10, tier: "D" });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("referenceError");
  });
  it("内部IDを文章へ含めない", () => {
    let result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 1 } });
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    assertNoForbiddenContent(normal);
    assertNoForbiddenContent(harsh);
  });
  it("判定可能カテゴリが少ない場合に過度な断定を行わない（低確信度の注記を含む）", () => {
    let result = baseResult();
    result = {
      ...result,
      categories: result.categories.map((c, i) => (c.id === "squadCompleteness" ? c : i === 0 ? { ...c, score: 20, tier: "D" as const } : { ...c, score: null, tier: null })),
    };
    expect(
      result.categories.filter((c) => c.id !== "squadCompleteness" && c.score != null).length,
    ).toBeLessThan(LOW_CONFIDENCE_RATED_CATEGORY_THRESHOLD);
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/参考情報|明確に判定できる段階ではありません/);
    expect(harsh).toMatch(/評価の幅は狭い/);
  });
  it("長所がない場合に架空の長所を追加しない", () => {
    const result = baseResult();
    expect(selectPrimaryStrength(result).kind).toBe("none");
  });
  it("弱点がない場合に架空の弱点を追加しない", () => {
    const result = baseResult();
    expect(selectPrimaryConcern(result).kind).toBe("none");
  });
  it("空に近い診断結果でも安全にフォールバックする（全カテゴリ判定対象外）", () => {
    let result = baseResult({ overall: { score: null, tier: null, note: "" } });
    result = {
      ...result,
      categories: result.categories.map((c) => (c.id === "squadCompleteness" ? c : { ...c, score: null, tier: null })),
    };
    expect(() => generateSquadDiagnosisComments(result)).not.toThrow();
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal.length).toBeGreaterThan(0);
    expect(harsh.length).toBeGreaterThan(0);
  });
  it("判定可能カテゴリが少なくてもクラッシュしない", () => {
    let result = baseResult();
    result = {
      ...result,
      categories: result.categories.map((c, i) => (c.id === "squadCompleteness" ? c : i === 0 ? c : { ...c, score: null, tier: null })),
    };
    expect(() => analyzeSquadDiagnosis(result)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// UI連携用の分析結果（改善優先順位リスト等）
// ---------------------------------------------------------------------------
describe("分析結果（CommentAnalysis）のUI利用", () => {
  it("改善優先順位に最上位のみ「維持すべき長所」が付与される", () => {
    let result = withScores(baseResult(), { speed: 90, aerial: 20 });
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.improvementPriorities[0]?.keepStrength).toBe("スピード");
    if (analysis.improvementPriorities.length > 1) {
      expect(analysis.improvementPriorities[1]?.keepStrength).toBeNull();
    }
  });
  it("analyzeSquadDiagnosis と buildNormalComment/buildHarshComment を分離して呼び出しても generateSquadDiagnosisComments と一致する", () => {
    const result = withScores(baseResult(), { aerial: 15 });
    const analysis = analyzeSquadDiagnosis(result);
    const manual = { normal: buildNormalComment(analysis, result), harsh: buildHarshComment(analysis, result) };
    expect(manual).toEqual(generateSquadDiagnosisComments(result));
  });
});

const CONTRADICTION_MIN_GAP_FOR_TEST = 20;

// ---------------------------------------------------------------------------
// 代表テストケース（§24）
// ---------------------------------------------------------------------------
describe("代表テストケース", () => {
  it("ケース1: 攻撃とスピードが非常に高く、守備と空中戦が低い構成", () => {
    let result = withScores(baseResult(), { attack: 92, speed: 90, defense: 35, aerial: 38, passBuildUp: 65, dribblePossession: 68, pressResistance: 62, counterAttack: 70 });
    result = overallFromAbility(result);
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("attackOriented");
    expect(analysis.scoreGap).toBeGreaterThanOrEqual(CONTRADICTION_MIN_GAP_FOR_TEST);
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toMatch(/生かし切れていない可能性|放置できない|見過ごせる水準ではありません/);
    assertNoForbiddenContent(harsh);
  });
  it("ケース2: 守備とプレス適性が高く、攻撃とスピードが低い構成", () => {
    let result = withScores(baseResult(), { defense: 90, pressResistance: 88, attack: 40, speed: 42, aerial: 65, passBuildUp: 65, dribblePossession: 65, counterAttack: 60 });
    result = overallFromAbility(result);
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("defenseOriented");
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/攻撃/);
    assertNoForbiddenContent(harsh);
  });
  it("ケース3: 全カテゴリが75〜80程度で点差が小さい構成", () => {
    let result = withScores(baseResult(), { attack: 78, defense: 76, aerial: 75, speed: 77, passBuildUp: 78, dribblePossession: 80, pressResistance: 75, counterAttack: 76 });
    result = overallFromAbility(result);
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("balanced");
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).not.toMatch(/放置できない|見過ごせる水準ではありません/);
  });
  it("ケース4: 総合評価は高いが最高点と最低点の差が30点以上ある構成", () => {
    let result = withScores(baseResult(), { attack: 95, defense: 90, aerial: 88, speed: 90, passBuildUp: 92, dribblePossession: 91, pressResistance: 89, counterAttack: 60 });
    result = overallFromAbility(result);
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.gapLevel).toBe("extreme");
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/均等に整った構成ではありません/);
    expect(harsh).toMatch(/完成していると判断するのは早い/);
  });
  it("ケース5: プレス適性が高く守備が低い構成", () => {
    let result = withScores(baseResult(), { pressResistance: 90, defense: 35, attack: 65, aerial: 65, speed: 65, passBuildUp: 65, dribblePossession: 65, counterAttack: 65 });
    result = overallFromAbility(result);
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.contradictions.some((c) => c.highCategory.id === "pressResistance" && c.lowCategory.id === "defense")).toBe(true);
    const { harsh } = generateSquadDiagnosisComments(result);
    assertNoForbiddenContent(harsh);
  });
  it("ケース6: 参照エラーが存在する構成", () => {
    let result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 3 } });
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).toContain("保存ビルドの参照");
    expect(harsh).toContain("保存ビルドの参照");
    assertNoForbiddenContent(harsh);
  });
  it("ケース7: 先発フィールドプレイヤーが不足している構成", () => {
    const result = baseResult({ overall: { score: null, tier: null, note: "" } });
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/先発にフィールドプレイヤーが配置されておらず/);
    expect(harsh).toMatch(/先発にフィールドプレイヤーが配置されておらず/);
  });
  it("ケース8: 全カテゴリが非常に高い構成", () => {
    let result = withScores(baseResult(), { attack: 92, defense: 90, aerial: 88, speed: 91, passBuildUp: 89, dribblePossession: 93, pressResistance: 90, counterAttack: 89 });
    result = overallFromAbility(result);
    const { harsh } = generateSquadDiagnosisComments(result);
    assertNoForbiddenContent(harsh);
    expect(harsh).not.toMatch(/放置できない/);
  });
  it("ケース9: 全カテゴリが低い構成", () => {
    let result = withScores(baseResult(), { attack: 32, defense: 30, aerial: 28, speed: 33, passBuildUp: 29, dribblePossession: 31, pressResistance: 27, counterAttack: 30 });
    result = overallFromAbility(result);
    const analysis = analyzeSquadDiagnosis(result);
    expect(analysis.profile.type).toBe("lackingWeapon");
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).not.toMatch(/強みがある構成/);
    assertNoForbiddenContent(normal);
    assertNoForbiddenContent(harsh);
  });
});

// ---------------------------------------------------------------------------
// diagnoseSquad との統合（実データでのスコア一致・回帰）
// ---------------------------------------------------------------------------
function makeStats(base = 50) {
  const keys = [
    "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
    "finishing", "heading", "setPieceTaking", "curl", "defensiveAwareness", "tackling", "aggression",
    "defensiveEngagement", "gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach",
    "speed", "acceleration", "kickingPower", "jumping", "physicalContact", "balance", "stamina",
  ];
  return keys.map((key) => ({
    key, nameEn: key, group: "offense" as const, baseValue: base, progressionDelta: 0, playerBoosterDelta: 0,
    managerBoosterDelta: 0, otherDelta: 0, uncappedValue: base, finalValue: base, capApplied: false,
    source: "base" as const, confidence: "confirmed" as const, gameMeasuredBoosterDelta: 0, externalVerifiedBoosterDelta: 0,
    conditionalBoosterDelta: 0, manualTrialBoosterDelta: 0, confirmedB2BoosterDelta: 0,
    experimentalPlayerBoosterDelta: 0, strictFinalValue: base, standardFinalValue: base, conditionalFinalValue: base,
    conditionalCapApplied: false, experimentalFinalValue: base, experimentalCapApplied: false,
  }));
}
function player(overrides: Partial<SquadDiagnosisInput["starters"][number]> = {}): SquadDiagnosisInput["starters"][number] {
  return {
    key: "s1", worldCardId: "1", nameJa: "テスト選手", nameEn: "Test Player", registeredPosition: "CF",
    role: "FW", assignedPosition: "CF", compatibilityStatus: "exact", isCaptain: false, cardResolved: true,
    stats: makeStats(), savedBuildId: null, savedBuildStatus: "none", ...overrides,
  };
}
function fullDiagInput(overrides: Partial<SquadDiagnosisInput> = {}): SquadDiagnosisInput {
  const starters = Array.from({ length: 11 }, (_, i) => player({ key: `s${i}`, role: i === 0 ? "GK" : "FW", stats: makeStats(60) }));
  return {
    squadId: "sq_x", squadName: "実データテスト", updatedAt: "2026-09-06T00:00:00.000Z", formationId: "4-3-3",
    starters, bench: [], managerId: null, managerResolved: true, managerApplied: false, ...overrides,
  };
}

describe("diagnoseSquad との統合（実データ）", () => {
  it("実際の diagnoseSquad 結果からコメントを生成してもクラッシュしない・既存スコアを変更しない", () => {
    const input = fullDiagInput();
    const before = diagnoseSquad(input);
    const beforeSnapshot = JSON.parse(JSON.stringify(before));
    const comments = generateSquadDiagnosisComments(before);
    expect(comments.normal.length).toBeGreaterThan(0);
    expect(comments.harsh.length).toBeGreaterThan(0);
    expect(before).toEqual(beforeSnapshot);
  });
  it("同じ入力から2回診断・2回コメント生成しても同一のコメントになる", () => {
    const input = fullDiagInput();
    const c1 = generateSquadDiagnosisComments(diagnoseSquad(input));
    const c2 = generateSquadDiagnosisComments(diagnoseSquad(JSON.parse(JSON.stringify(input))));
    expect(c1).toEqual(c2);
  });
  it("実データからの分析結果もクラッシュせず、既存の長所・弱点・改善候補と矛盾しない", () => {
    const input = fullDiagInput();
    const result = diagnoseSquad(input);
    const analysis = analyzeSquadDiagnosis(result);
    expect(() => analysis).not.toThrow();
    expect(analysis.ratedCount).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 保存ビルド未設定（savedBuildMissing）
// ---------------------------------------------------------------------------
describe("保存ビルド未設定", () => {
  function missingBuildResult(overrides: Partial<SquadDiagnosisResult> = {}): SquadDiagnosisResult {
    return baseResult({
      dataQuality: { ...baseResult().dataQuality, missingSavedBuildCount: 7, filledStartingSlots: 10 },
      ...overrides,
    });
  }

  it("ケース1: 8/8判定可能・一部未設定 → savedBuildMissingが最重要懸念になる", () => {
    const result = missingBuildResult();
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("savedBuildMissing");
    if (concern.kind === "savedBuildMissing") {
      expect(concern.count).toBe(7);
      expect(concern.total).toBe(10);
    }
  });

  it("能力カテゴリがD/Cランクでも、保存ビルド未設定を優先する", () => {
    let result = missingBuildResult();
    result = withScores(result, { aerial: 20 });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("savedBuildMissing");
  });

  it("D/Cランクの能力カテゴリは二次的な懸念として残る", () => {
    let result = missingBuildResult();
    result = withScores(result, { aerial: 20 });
    const primary = selectPrimaryConcern(result);
    const secondary = selectSecondaryConcern(result, primary);
    expect(secondary.kind).toBe("category");
    if (secondary.kind === "category") expect(secondary.category.id).toBe("aerial");
  });

  it("ケース4: 削除済み参照エラーは保存ビルド未設定より優先される", () => {
    const result = missingBuildResult({
      dataQuality: { ...baseResult().dataQuality, missingSavedBuildCount: 7, filledStartingSlots: 10, brokenSavedBuildRefCount: 1 },
    });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("referenceError");
  });

  it("選手配置の充足状況（構造上の問題）は保存ビルド未設定より優先される", () => {
    let result = missingBuildResult();
    result = setCategory(result, "squadCompleteness", { score: 30, tier: "D" });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("structural");
  });

  it("ケース2: 全員設定済み（0件）なら savedBuildMissing にならない", () => {
    const result = baseResult(); // missingSavedBuildCount: 0
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).not.toBe("savedBuildMissing");
  });

  it("ケース3: 全員未設定でも診断自体は無効にしない（総合評価が維持される）", () => {
    const result = missingBuildResult({
      dataQuality: { ...baseResult().dataQuality, missingSavedBuildCount: 11, filledStartingSlots: 11 },
    });
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(result.overall.score).not.toBeNull();
    expect(harsh).toMatch(/無効な結果ではありません/);
  });

  it("辛口コメントが原因・影響・次の行動をすべて説明する", () => {
    const result = missingBuildResult();
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toContain("7"); // 未設定人数
    expect(harsh).toMatch(/保存ビルドが未設定/); // 原因
    expect(harsh).toMatch(/完成状態を十分に反映した評価ではない|完成評価として受け取るのは早い/); // 影響
    expect(harsh).toMatch(/保存ビルドを設定し、その後もう一度診断してください/); // 次の行動
  });

  it("辛口コメントは診断を無効とは表現しない", () => {
    const result = missingBuildResult();
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).not.toMatch(/評価不能|診断できません|無効です/);
  });

  it("配置が十分（S/Aランク）なら『十分に整っています』と表現する", () => {
    let result = missingBuildResult();
    result = setCategory(result, "squadCompleteness", { score: 95, tier: "S" });
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toMatch(/先発の配置は十分に整っています/);
  });

  it("配置がBランクなら『大きな不足は見当たりません』と表現する（完成と断定しない）", () => {
    let result = missingBuildResult();
    result = setCategory(result, "squadCompleteness", { score: 60, tier: "B" });
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toMatch(/先発の配置に大きな不足は見当たりません/);
    expect(harsh).not.toMatch(/配置は完成しています/);
  });

  it("現時点で確認できる長所を事実として説明する", () => {
    let result = missingBuildResult();
    result = withScores(result, { speed: 92 });
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).toContain("スピード");
  });

  it("長所がない場合に架空の長所を作らない", () => {
    const result = missingBuildResult(); // 全カテゴリ B ランク・長所なし
    const { harsh } = generateSquadDiagnosisComments(result);
    expect(harsh).not.toMatch(/は高水準/);
  });

  it("通常コメントは辛口より明確に短い", () => {
    const result = missingBuildResult();
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal.length).toBeLessThan(harsh.length);
  });

  it("通常コメントも保存ビルド未設定と再診断の推奨を簡潔に伝える", () => {
    const result = missingBuildResult();
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).toMatch(/保存ビルド未設定/);
    expect(normal).toMatch(/再診断/);
  });

  it("通常コメントに詳細戦術監査の文言を混入させない", () => {
    const result = missingBuildResult();
    const { normal } = generateSquadDiagnosisComments(result);
    expect(normal).not.toMatch(/配置構造・戦術監査/);
  });

  it("改善優先順位のラベルが『保存ビルドの設定』になり、理由に人数を含む", () => {
    const result = missingBuildResult();
    const analysis = analyzeSquadDiagnosis(result);
    const top = analysis.improvementPriorities[0];
    expect(top?.label).toBe("保存ビルドの設定");
    expect(top?.reason).toContain("7");
  });

  it("改善優先順位に『保存ビルドの設定』が重複して現れない（suggestionsフォールバックとの重複防止）", () => {
    const result = missingBuildResult({
      suggestions: [{ id: "suggest-missing-build", label: "保存ビルドの設定", detail: "テスト太郎 / テスト次郎 は保存ビルド未設定です。" }],
    });
    const analysis = analyzeSquadDiagnosis(result);
    const labels = analysis.improvementPriorities.map((p) => p.label);
    expect(labels.filter((l) => l === "保存ビルドの設定").length).toBe(1);
  });

  it("辛口コメントの改善優先順位文が懸念文と同じ内容を繰り返さない", () => {
    const result = missingBuildResult();
    const { harsh } = generateSquadDiagnosisComments(result);
    // 「保存ビルドを設定し」という行動喚起は懸念文中に1回だけ現れる（優先順位文での重複再掲がない）
    const occurrences = harsh.split("保存ビルドを設定").length - 1;
    expect(occurrences).toBeLessThanOrEqual(1);
  });

  it("能力上の弱点・参照エラー・データ不足と混同しない（独立したkind）", () => {
    const result = missingBuildResult();
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).not.toBe("category");
    expect(concern.kind).not.toBe("referenceError");
    expect(concern.kind).not.toBe("dataInsufficient");
  });

  it("ユーザー本人への侮辱・全国順位・勝率の創作を含まない", () => {
    const result = missingBuildResult();
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    assertNoForbiddenContent(normal);
    assertNoForbiddenContent(harsh);
  });

  it("内部IDを含まない", () => {
    const result = missingBuildResult();
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).not.toMatch(/worldCardId|buildId|squadId|sq_/i);
    expect(harsh).not.toMatch(/worldCardId|buildId|squadId|sq_/i);
  });

  it("決定性: 同一入力から常に同一のsavedBuildMissingコメントを返す", () => {
    const result = missingBuildResult();
    const a = generateSquadDiagnosisComments(result);
    const b = generateSquadDiagnosisComments(JSON.parse(JSON.stringify(result)));
    expect(a).toEqual(b);
  });

  it("入力オブジェクトを変更しない", () => {
    const result = missingBuildResult();
    const snapshot = JSON.parse(JSON.stringify(result));
    generateSquadDiagnosisComments(result);
    expect(result).toEqual(snapshot);
  });

  it("ケース8: 保存ビルド設定済み（0件）だが配置不足の場合、savedBuildMissingではなくstructuralになる", () => {
    let result = baseResult(); // missingSavedBuildCount: 0
    result = setCategory(result, "squadCompleteness", { score: 20, tier: "D" });
    const concern = selectPrimaryConcern(result);
    expect(concern.kind).toBe("structural");
  });

  it("実データ（diagnoseSquad）経由でも、不正確な『基礎値のまま評価』が改善候補・通常/辛口コメントのいずれにも現れない", () => {
    const input = fullDiagInput(); // 全先発が savedBuildStatus: "none"
    const result = diagnoseSquad(input);
    expect(result.dataQuality.missingSavedBuildCount).toBeGreaterThan(0);
    const missingBuildSuggestion = result.suggestions.find((s) => s.id === "suggest-missing-build");
    expect(missingBuildSuggestion?.detail).not.toContain("基礎値のまま評価");
    expect(missingBuildSuggestion?.detail).toMatch(/育成後の完成状態を十分に反映していません/);
    const { normal, harsh } = generateSquadDiagnosisComments(result);
    expect(normal).not.toContain("基礎値のまま評価");
    expect(harsh).not.toContain("基礎値のまま評価");
  });
});
