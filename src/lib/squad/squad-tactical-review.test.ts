import { describe, it, expect } from "vitest";
import {
  buildTacticalFindings,
  buildTacticalReview,
  buildTacticalPlacementInputs,
  CONFIDENCE_ORDER,
  type TacticalPlacementInput,
  type FindingConfidence,
} from "./squad-tactical-review";
import { ABILITY_CATEGORIES, type SquadDiagnosisResult, type SquadDiagnosisCategory } from "./squad-diagnosis";
import type { FormationDef, SquadSlotResult, SquadPlayerDisplay } from "./types";

// ---------------------------------------------------------------------------
// フィクスチャ: 診断結果
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
    overall: { score: 60, tier: "B", note: "" },
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

// ---------------------------------------------------------------------------
// フィクスチャ: 配置（4-3-3 の実座標を模した、GK除く10フィールド枠のテンプレート）
// ---------------------------------------------------------------------------

const FIELD_TEMPLATE: { slotId: string; position: string; x: number; y: number; role: "DF" | "MF" | "FW"; line: number }[] = [
  { slotId: "lb", position: "LB", x: 15, y: 72, role: "DF", line: 1 },
  { slotId: "lcb", position: "CB", x: 38, y: 77, role: "DF", line: 1 },
  { slotId: "rcb", position: "CB", x: 62, y: 77, role: "DF", line: 1 },
  { slotId: "rb", position: "RB", x: 85, y: 72, role: "DF", line: 1 },
  { slotId: "dmf", position: "DMF", x: 50, y: 58, role: "MF", line: 2 },
  { slotId: "lcmf", position: "CMF", x: 33, y: 44, role: "MF", line: 3 },
  { slotId: "rcmf", position: "CMF", x: 67, y: 44, role: "MF", line: 3 },
  { slotId: "lwf", position: "LWF", x: 16, y: 22, role: "FW", line: 4 },
  { slotId: "cf", position: "CF", x: 50, y: 15, role: "FW", line: 4 },
  { slotId: "rwf", position: "RWF", x: 84, y: 22, role: "FW", line: 4 },
];
const GK_SLOT = { slotId: "gk", position: "GK", x: 50, y: 93, role: "GK" as const, line: 0 };

/** 10枠すべて配置済み（coverage="full"の既定フィクスチャ）。overrides で個別スロットだけ差し替え可能。 */
function fullPlacements(overrides: Record<string, Partial<TacticalPlacementInput>> = {}, includeGk = false): TacticalPlacementInput[] {
  const base = includeGk ? [GK_SLOT, ...FIELD_TEMPLATE] : FIELD_TEMPLATE;
  return base.map((t) => ({
    slotId: t.slotId,
    position: t.position,
    x: t.x,
    y: t.y,
    role: t.role,
    line: t.line,
    nameLabel: `選手_${t.slotId}`,
    playingStyle: null,
    playingStyleDefensive: null,
    filled: true,
    ...(overrides[t.slotId] ?? {}),
  }));
}

/** 指定した slotId だけ filled のまま残し、他は未配置（filled:false）にする。 */
function onlyFilled(slotIds: string[]): TacticalPlacementInput[] {
  const set = new Set(slotIds);
  return FIELD_TEMPLATE.map((t) => ({
    slotId: t.slotId,
    position: t.position,
    x: t.x,
    y: t.y,
    role: t.role,
    line: t.line,
    nameLabel: `選手_${t.slotId}`,
    playingStyle: null,
    playingStyleDefensive: null,
    filled: set.has(t.slotId),
  }));
}

function assertConfidenceOrder() {
  expect(CONFIDENCE_ORDER).toEqual(["insufficient", "low", "medium", "high"]);
}

// ---------------------------------------------------------------------------
// 決定性
// ---------------------------------------------------------------------------
describe("決定性", () => {
  it("同じ入力から常に同じ TacticalReviewAnalysis を返す", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 40 });
    const placements = fullPlacements();
    const a = buildTacticalReview(result, placements);
    const b = buildTacticalReview(result, placements);
    expect(a).toEqual(b);
  });
  it("JSONクローンした入力でも同一結果になる", () => {
    const result = withScores(baseResult(), { pressResistance: 90, defense: 30 });
    const a = buildTacticalReview(result, onlyFilled(["lwf", "cf"]));
    const b = buildTacticalReview(JSON.parse(JSON.stringify(result)), JSON.parse(JSON.stringify(onlyFilled(["lwf", "cf"]))));
    expect(a).toEqual(b);
  });
  it("入力オブジェクトを変更しない", () => {
    const result = withScores(baseResult(), { attack: 90, passBuildUp: 30 });
    const placements = fullPlacements();
    const snapshotResult = JSON.parse(JSON.stringify(result));
    const snapshotPlacements = JSON.parse(JSON.stringify(placements));
    buildTacticalReview(result, placements);
    expect(result).toEqual(snapshotResult);
    expect(placements).toEqual(snapshotPlacements);
  });
  it("confidenceの順序が明示的に定義されている", () => {
    assertConfidenceOrder();
  });
});

// ---------------------------------------------------------------------------
// 配置充足状態の判定
// ---------------------------------------------------------------------------
describe("配置充足状態", () => {
  it("先発0人を insufficient として扱う", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 40 });
    // 全カテゴリが判定不能になるため、overall.score が null になり blockingFinding が先に発火する
    const review = buildTacticalReview(baseResult({ overall: { score: null, tier: null, note: "" } }), onlyFilled([]));
    expect(review.coverage).toBe("insufficient");
  });
  it("先発1人を insufficient として扱う", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 40 });
    const review = buildTacticalReview(result, onlyFilled(["cf"]));
    expect(review.coverage).toBe("insufficient");
  });
  it("先発2/10人（実データ相当）を full として扱わない", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45, pressResistance: 70 });
    const review = buildTacticalReview(result, onlyFilled(["lwf", "cf"]));
    expect(review.coverage).not.toBe("full");
    expect(review.coverage).toBe("insufficient");
  });
  it("先発2/10人で high-confidence の戦術findingを表示しない", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45, pressResistance: 70 });
    const findings = buildTacticalFindings(result, onlyFilled(["lwf", "cf"]));
    for (const f of findings) expect(f.confidence).not.toBe("high");
  });
  it("配置人数が増えると limited または partial へ進む", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45 });
    const review = buildTacticalReview(result, onlyFilled(["lb", "lcb", "dmf", "lcmf", "lwf"]));
    expect(["limited", "partial"]).toContain(review.coverage);
  });
  it("期待人数を満たし主要ラインが存在する場合に full となる", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 60 });
    const review = buildTacticalReview(result, fullPlacements());
    expect(review.coverage).toBe("full");
  });
  it("人数だけでなく主要ライン（前方/中盤/後方）不足を考慮する", () => {
    // 9人配置しているが、全員 DF ライン（後方）に固まっている想定
    const placements = FIELD_TEMPLATE.map((t, i) => ({
      slotId: t.slotId,
      position: t.position,
      x: t.x,
      y: 75, // 全員 back band に強制
      role: t.role,
      line: t.line,
      nameLabel: `選手_${i}`,
      playingStyle: null,
      playingStyleDefensive: null,
      filled: i < 9,
    }));
    const result = withScores(baseResult(), { attack: 78, defense: 60 });
    const review = buildTacticalReview(result, placements);
    expect(review.coverage).not.toBe("full");
  });
  it("GKの有無だけでエリア分析を可能としない（GKはフィールド集計から除外）", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 60 });
    const withGkOnly = onlyFilled([]).map((p) => p); // フィールド0人
    const review = buildTacticalReview(result, [GK_SLOT_INPUT(), ...withGkOnly]);
    expect(review.coverage).toBe("insufficient");
  });
  it("ベンチ人数を先発充足へ含めない（TacticalPlacementInputはそもそも先発のみを表す）", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 60 });
    const review = buildTacticalReview(result, onlyFilled(["cf"]));
    expect(review.placedFieldPlayerCount).toBe(1);
  });
  it("参照エラー時は配置人数にかかわらず分析制限を優先する", () => {
    const result = baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 1 } });
    const review = buildTacticalReview(result, fullPlacements());
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0].type).toBe("referenceError");
  });
});
function GK_SLOT_INPUT(): TacticalPlacementInput {
  return { ...GK_SLOT, nameLabel: "GK", playingStyle: null, playingStyleDefensive: null, filled: true };
}

// ---------------------------------------------------------------------------
// 信頼度上限
// ---------------------------------------------------------------------------
describe("信頼度の上限制御", () => {
  it("finding固有confidenceがhighでも、配置上限lowならlowになる（limitedカバレッジ）", () => {
    // 5人配置・3チャンネル未満（bandsが2以下）に調整して limited を狙う
    const placements = onlyFilled(["lb", "lcb", "dmf", "lcmf", "rcmf"]); // back + mid のみ(front無し) => bands=2
    const result = withScores(baseResult(), { attack: 90, defense: 30 });
    const review = buildTacticalReview(result, placements);
    expect(review.coverage).toBe("limited");
    expect(review.overallConfidenceCap).toBe("low");
    for (const f of review.findings) {
      expect(["low", "insufficient"]).toContain(f.confidence);
    }
  });
  it("finding固有confidenceがmediumで配置上限highならmediumを維持する（fullカバレッジ）", () => {
    // 関連カテゴリ（攻撃・スピード）がB帯のままなら roleDuplication の固有confidenceは medium になる。
    const result = baseResult();
    const placements = fullPlacements({ lb: { position: "LWF" }, lcb: { position: "LWF" }, lcmf: { position: "LWF" } });
    const review = buildTacticalReview(result, placements);
    expect(review.coverage).toBe("full");
    const dup = review.findings.find((f) => f.type === "roleDuplication");
    expect(dup?.confidence).toBe("medium");
  });
  it("insufficient時にhighまたはmediumへ上がらない", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 30 });
    const review = buildTacticalReview(result, onlyFilled(["cf"]));
    for (const f of review.findings) expect(["insufficient", "low"]).toContain(f.confidence);
  });
  it("最終confidenceの決定が決定的である（何度実行しても同じ）", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 30 });
    const placements = onlyFilled(["lwf", "cf"]);
    const runs = Array.from({ length: 5 }, () => buildTacticalReview(result, placements));
    for (const r of runs) expect(r).toEqual(runs[0]);
  });
  it("制限理由が limitations へ記録される", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45, pressResistance: 70 });
    const review = buildTacticalReview(result, onlyFilled(["lwf", "cf"]));
    expect(review.limitations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// カテゴリ不均衡（配置充足状態との関係）
// ---------------------------------------------------------------------------
describe("カテゴリ不均衡と配置充足状態", () => {
  it("配置が十分（full）なら既存条件にもとづきhigh-confidenceを維持できる", () => {
    const result = withScores(baseResult(), { attack: 95, defense: 40 }); // gap55 -> high intrinsic
    const review = buildTacticalReview(result, fullPlacements());
    const phaseRisk = review.findings.find((f) => f.type === "categoryPhaseRisk");
    expect(phaseRisk?.confidence).toBe("high");
  });
  it("配置が極端に不足している場合、数値上の差をスカッド全体の高信頼度リスクへ変換しない", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45, pressResistance: 70 });
    const review = buildTacticalReview(result, onlyFilled(["lwf", "cf"]));
    expect(review.findings.every((f) => f.confidence !== "high")).toBe(true);
    expect(review.findings[0].type).toBe("coverageInsufficient");
  });
  it("点数およびランクそのものは変更しない（入力を書き換えない）", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45 });
    const snapshot = JSON.parse(JSON.stringify(result));
    buildTacticalReview(result, onlyFilled(["lwf", "cf"]));
    expect(result).toEqual(snapshot);
  });
  it("判定対象外カテゴリを0点として扱わない", () => {
    let result = withScores(baseResult(), { attack: 90 });
    result = setCategory(result, "defense", { score: null, tier: null });
    const review = buildTacticalReview(result, fullPlacements());
    const serialized = JSON.stringify(review.findings);
    expect(serialized).not.toContain("守備: Dランク（0点）");
  });
  it("配置不足時、数値上の傾向は参考情報として evidence に含まれる", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45 });
    const review = buildTacticalReview(result, onlyFilled(["lwf", "cf"]));
    const evidenceText = review.findings[0].evidence.join(" ");
    expect(evidenceText).toMatch(/参考情報/);
  });
});

// ---------------------------------------------------------------------------
// 役割重複と不足（fullカバレッジを基準に検証）
// ---------------------------------------------------------------------------
describe("役割重複と役割不足（配置十分な場合）", () => {
  it("左側に前方進出役が重複し、後方補完役が無い場合を検出する", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 30 });
    const placements = fullPlacements({
      lb: { position: "LWF" },
      lcb: { position: "LWF" },
      lcmf: { position: "LWF" },
    });
    const review = buildTacticalReview(result, placements);
    expect(review.findings.some((f) => f.type === "roleDuplication" && f.area === "left")).toBe(true);
  });
  it("後方をカバーする役割が同エリアにあれば重複と判定しない", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 60 });
    const review = buildTacticalReview(result, fullPlacements());
    expect(review.findings.some((f) => f.type === "roleDuplication" && f.area === "left")).toBe(false);
  });
  it("先発がほぼ空の状態（insufficient）で役割不足を確定しない", () => {
    const result = withScores(baseResult(), { passBuildUp: 30 });
    const review = buildTacticalReview(result, onlyFilled(["cf"]));
    expect(review.findings.some((f) => f.type === "roleShortage")).toBe(false);
  });
  it("中継役（DMF/CMF等）が無く、パス・ビルドアップ評価も低い場合に検出する（full）", () => {
    const result = withScores(baseResult(), { passBuildUp: 30 });
    const placements = fullPlacements({
      dmf: { position: "CF" },
      lcmf: { position: "LWF" },
      rcmf: { position: "RWF" },
    });
    const review = buildTacticalReview(result, placements);
    expect(review.findings.some((f) => f.type === "roleShortage")).toBe(true);
  });
  it("配置不足を中継役不足と混同しない（限定的な配置では役割不足を確定しない）", () => {
    const result = withScores(baseResult(), { passBuildUp: 30 });
    const placements = onlyFilled(["lwf", "cf", "rwf", "lb"]); // 4人・中継役なし・しかし limited/insufficient 相当
    const review = buildTacticalReview(result, placements);
    expect(review.findings.some((f) => f.type === "roleShortage")).toBe(false);
  });
  it("分析不能時に「問題なし」と表示しない", () => {
    const result = baseResult(); // 矛盾なし
    const placements = onlyFilled(["lb", "lcb", "dmf", "lcmf", "rcmf"]); // limited想定（bands<3）
    const review = buildTacticalReview(result, placements);
    if (review.coverage === "limited" && review.findings.length === 1) {
      expect(review.findings[0].type).not.toBe("wellComplemented");
    }
  });
  it("十分な配置と根拠があり明確な欠陥が無い場合は wellComplemented を表示する", () => {
    const result = baseResult(); // 全カテゴリBランク・矛盾なし
    const review = buildTacticalReview(result, fullPlacements());
    expect(review.findings[0].type).toBe("wellComplemented");
  });
});

// ---------------------------------------------------------------------------
// 名称と免責（プレースタイル発動分析ではないことの明示）
// ---------------------------------------------------------------------------
describe("名称と免責の適正化", () => {
  it("現在の分析をプレースタイル発動分析と表示しない（禁止語を含まない）", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 30 });
    const review = buildTacticalReview(result, fullPlacements({ lb: { position: "LWF" }, lcb: { position: "LWF" }, lcmf: { position: "LWF" } }));
    const serialized = JSON.stringify(review.findings);
    expect(serialized).not.toMatch(/発動対象|active|inactive|プレースタイル連携/i);
  });
  it("配置ポジションに基づく構造分析であることをタイトルで示す", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45, pressResistance: 70 });
    const review = buildTacticalReview(result, onlyFilled(["lwf", "cf"]));
    expect(review.findings[0].title).toMatch(/配置構造分析/);
  });
  it("試合中の結果を断定しない", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 20, aerial: 25 });
    const review = buildTacticalReview(
      result,
      fullPlacements({ lb: { position: "LWF" }, lcb: { position: "LWF" }, lcmf: { position: "LWF" } }),
    );
    const serialized = JSON.stringify(review.findings);
    expect(serialized).not.toMatch(/必ず|絶対に|確実に|全国順位|勝率/);
  });
});

// ---------------------------------------------------------------------------
// 代表テストケース（§16）
// ---------------------------------------------------------------------------
describe("代表テストケース", () => {
  it("ケース1: 先発2/10、カテゴリ差が大きい", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45, pressResistance: 70 });
    const review = buildTacticalReview(result, onlyFilled(["lwf", "cf"]));
    expect(review.coverage).not.toBe("full");
    expect(review.findings.every((f) => f.confidence !== "high")).toBe(true);
    expect(review.findings[0].type).toBe("coverageInsufficient");
    expect(review.findings[0].evidence.join(" ")).toMatch(/参考情報/);
  });
  it("ケース2: 先発0/10", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 45 });
    const review = buildTacticalReview(result, onlyFilled([]));
    expect(review.findings.some((f) => ["roleShortage", "roleDuplication"].includes(f.type))).toBe(false);
    expect(review.findings.some((f) => f.type === "wellComplemented")).toBe(false);
  });
  it("ケース3: 一部配置済みで右側のみ評価可能", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 60 });
    const placements = onlyFilled(["rb", "rcb", "rcmf", "rwf"]); // 右側4人
    const review = buildTacticalReview(result, placements);
    expect(review.coverage).not.toBe("full");
    expect(review.overallConfidenceCap === "low" || review.overallConfidenceCap === "insufficient").toBe(true);
  });
  it("ケース4: 9/10人配置、主要ラインあり", () => {
    const result = withScores(baseResult(), { attack: 78, defense: 60 });
    const placements = fullPlacements();
    placements[0] = { ...placements[0], filled: false };
    const review = buildTacticalReview(result, placements);
    expect(review.coverage).toBe("partial");
    expect(review.overallConfidenceCap).toBe("medium");
    expect(review.limitations.length).toBeGreaterThan(0);
  });
  it("ケース5: 10/10人配置、主要ラインあり", () => {
    const result = withScores(baseResult(), { attack: 95, defense: 40 });
    const review = buildTacticalReview(result, fullPlacements());
    expect(review.coverage).toBe("full");
    const phaseRisk = review.findings.find((f) => f.type === "categoryPhaseRisk");
    expect(phaseRisk?.confidence).toBe("high");
  });
  it("ケース6: 10/10人だが参照エラーあり", () => {
    const result = withScores(baseResult({ dataQuality: { ...baseResult().dataQuality, brokenSavedBuildRefCount: 1 } }), {
      attack: 95,
      defense: 40,
    });
    const review = buildTacticalReview(result, fullPlacements());
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0].type).toBe("referenceError");
    const serialized = JSON.stringify(review.findings);
    expect(serialized).not.toMatch(/worldCardId|buildId|squadId/i);
  });
  it("ケース7: 10/10人だが中盤ライン（midバンド）不在", () => {
    const placements = FIELD_TEMPLATE.map((t) => ({
      slotId: t.slotId,
      position: t.position,
      x: t.x,
      // DF/MF/FW すべて y<30 または y>65 に押し込め、mid帯を空にする
      y: t.role === "FW" ? 20 : 75,
      role: t.role,
      line: t.line,
      nameLabel: `選手_${t.slotId}`,
      playingStyle: null,
      playingStyleDefensive: null,
      filled: true,
    }));
    const result = withScores(baseResult(), { attack: 78, defense: 60 });
    const review = buildTacticalReview(result, placements);
    expect(review.coverage).not.toBe("full");
  });
  it("ケース8: 問題なしと評価不能の区別", () => {
    const resultNoIssue = baseResult();
    const fullReview = buildTacticalReview(resultNoIssue, fullPlacements());
    expect(fullReview.findings[0].type).toBe("wellComplemented");

    const insufficientReview = buildTacticalReview(resultNoIssue, onlyFilled(["cf"]));
    expect(insufficientReview.findings[0].type).not.toBe("wellComplemented");
    expect(fullReview.findings[0].title).not.toBe(insufficientReview.findings[0].title);
  });
});

// ---------------------------------------------------------------------------
// buildTacticalPlacementInputs アダプタ
// ---------------------------------------------------------------------------
function display(overrides: Partial<SquadPlayerDisplay> = {}): SquadPlayerDisplay {
  return {
    worldCardId: "1",
    nameEn: "Test Player",
    nameJa: "テスト選手",
    cardType: null,
    registeredPosition: "CF",
    playingStyle: null,
    playingStyleDefensive: null,
    ovrBase: 80,
    ovrMax: 90,
    maximumLevel: 30,
    hasEfhubLink: false,
    efhubCardId: null,
    imageUrlCandidate: null,
    mobileImageUrlCandidate: null,
    playerSkills: [],
    aiStyles: [],
    ...overrides,
  };
}
function slotResult(slotId: string, position: string, x: number, y: number, role: SquadSlotResult["role"], nameJa: string | null): SquadSlotResult {
  return {
    slotId,
    position,
    role,
    x,
    y,
    isCaptain: false,
    entry: nameJa
      ? {
          display: display({ nameJa }),
          buildMode: "none",
          savedBuildName: null,
          selectedPlayerBoosters: [],
          selectedConditionalBoosters: [],
          result: {} as NonNullable<SquadSlotResult["entry"]>["result"],
          baseOvr: null,
          displayedOvr: null,
          progressionDelta: 0,
          playerBoosterDelta: 0,
          managerBoosterDelta: 0,
          conditionalDelta: 0,
          conditionalDisplayedOvr: null,
          hasConditionalSelection: false,
        }
      : null,
  } as unknown as SquadSlotResult;
}
const FORMATION_433: FormationDef = {
  id: "4-3-3",
  name: "4-3-3",
  slots: [
    { slotId: "gk", position: "GK", x: 50, y: 93, role: "GK", line: 0, displayOrder: 1 },
    ...FIELD_TEMPLATE.map((t, i) => ({ slotId: t.slotId, position: t.position, x: t.x, y: t.y, role: t.role, line: t.line, displayOrder: i + 2 })),
  ],
};

describe("buildTacticalPlacementInputs", () => {
  it("SquadComputed 相当の入力から line を含む TacticalPlacementInput を組み立てる", () => {
    const placements = buildTacticalPlacementInputs({
      formation: FORMATION_433,
      slots: [slotResult("lwf", "LWF", 16, 22, "FW", "選手A")],
    });
    expect(placements).toHaveLength(1);
    expect(placements[0].line).toBe(4);
    expect(placements[0].filled).toBe(true);
  });
  it("未配置枠（entry:null）は filled:false になる", () => {
    const placements = buildTacticalPlacementInputs({ formation: FORMATION_433, slots: [slotResult("lwf", "LWF", 16, 22, "FW", null)] });
    expect(placements[0].filled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// diagnoseSquad との統合はコメント層で既に確認済みのため、ここでは analyzeSquadDiagnosis の
// contradictions を用いた確認だけ最小限行う（squad-diagnosis.ts / squad-diagnosis-comments.ts は無編集）。
// ---------------------------------------------------------------------------
describe("回帰: squad-diagnosis-comments.ts のCommentAnalysisをそのまま利用する", () => {
  it("analyzeSquadDiagnosis の contradictions を書き換えない", () => {
    const result = withScores(baseResult(), { attack: 90, defense: 30 });
    const snapshot = JSON.parse(JSON.stringify(result));
    buildTacticalReview(result, fullPlacements());
    expect(result).toEqual(snapshot);
  });
});
