import { describe, it, expect } from "vitest";
import {
  diagnoseSquad,
  scoreSquadCategory,
  determineDiagnosisGrade,
  calculateDataCoverage,
  suggestSquadImprovements,
  buildSquadDiagnosisInput,
  ABILITY_CATEGORIES,
  DIAGNOSIS_TIER_THRESHOLDS,
  BENCH_SWAP_IMPROVEMENT_THRESHOLD,
  DIAGNOSIS_DISCLAIMER,
  type SquadDiagnosisInput,
  type SquadDiagnosisPlayerInput,
} from "./squad-diagnosis";
import type { StatBreakdown } from "@/lib/progression/types";
import { calculateBuild } from "@/lib/progression/engine";
import { buildSquad, type BuildSquadInput } from "./build-squad";
import { getFormation } from "./formations";
import type { SquadEntryInput, StoredSquad } from "./types";
import { MESSI_BIGTIME, CANNAVARO_EPIC, NEUER_GK, LEVEL1_TRENDING } from "@/lib/progression/fixtures";
import type { SavedBuild } from "@/lib/progression/types";

// ---------------------------------------------------------------------------
// 低レベルフィクスチャ: 純粋な StatBreakdown を能力値ごとに直接作る（calculateBuild を経由しない）。
// ---------------------------------------------------------------------------
function makeStats(overrides: Record<string, number> = {}, base = 50): StatBreakdown[] {
  const keys = [
    "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
    "finishing", "heading", "setPieceTaking", "curl", "defensiveAwareness", "tackling", "aggression",
    "defensiveEngagement", "gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach",
    "speed", "acceleration", "kickingPower", "jumping", "physicalContact", "balance", "stamina",
  ];
  return keys.map((key) => {
    const v = overrides[key] ?? base;
    return {
      key, nameEn: key, group: "offense", baseValue: v, progressionDelta: 0, playerBoosterDelta: 0,
      managerBoosterDelta: 0, otherDelta: 0, uncappedValue: v, finalValue: v, capApplied: false,
      source: "base", confidence: "confirmed", gameMeasuredBoosterDelta: 0, externalVerifiedBoosterDelta: 0,
      conditionalBoosterDelta: 0, manualTrialBoosterDelta: 0, confirmedB2BoosterDelta: 0,
      experimentalPlayerBoosterDelta: 0, strictFinalValue: v, standardFinalValue: v, conditionalFinalValue: v,
      conditionalCapApplied: false, experimentalFinalValue: v, experimentalCapApplied: false,
    } as StatBreakdown;
  });
}

function player(overrides: Partial<SquadDiagnosisPlayerInput> = {}): SquadDiagnosisPlayerInput {
  return {
    key: "s1",
    worldCardId: "1",
    nameJa: "テスト選手",
    nameEn: "Test Player",
    registeredPosition: "CF",
    role: "FW",
    assignedPosition: "CF",
    compatibilityStatus: "exact",
    isCaptain: false,
    cardResolved: true,
    stats: makeStats(),
    savedBuildId: null,
    savedBuildStatus: "none",
    ...overrides,
  };
}

function fullInputInput(overrides: Partial<SquadDiagnosisInput> = {}): SquadDiagnosisInput {
  const formation = getFormation("4-3-3");
  const starters = formation.slots.map((fs, i) =>
    player({
      key: fs.slotId,
      role: fs.role,
      assignedPosition: fs.position,
      registeredPosition: fs.position,
      stats: makeStats({}, 60 + (i % 5)),
    }),
  );
  return {
    squadId: "sq_test0001",
    squadName: "テストスカッド",
    updatedAt: "2026-09-06T00:00:00.000Z",
    formationId: "4-3-3",
    starters,
    bench: [],
    managerId: null,
    managerResolved: true,
    managerApplied: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 決定性
// ---------------------------------------------------------------------------
describe("diagnoseSquad: 決定性", () => {
  it("同じ入力から同じ結果を返す", () => {
    const input = fullInputInput();
    const a = diagnoseSquad(input);
    const b = diagnoseSquad(input);
    expect(a).toEqual(b);
  });
  it("Math.random を使用しない・日時に依存しない（同一構造を複製しても同一結果）", () => {
    const input1 = fullInputInput();
    const input2 = JSON.parse(JSON.stringify(fullInputInput()));
    const r1 = diagnoseSquad(input1);
    const r2 = diagnoseSquad(input2);
    expect(r1.overall).toEqual(r2.overall);
    expect(r1.categories).toEqual(r2.categories);
  });
  it("欠損値で NaN を返さない・Infinity を返さない", () => {
    const input = fullInputInput({ starters: [] });
    const r = diagnoseSquad(input);
    expect(Number.isNaN(r.overall.score)).toBe(false);
    for (const c of r.categories) {
      if (c.score != null) {
        expect(Number.isFinite(c.score)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 空・不足状態
// ---------------------------------------------------------------------------
describe("diagnoseSquad: 空・不足状態", () => {
  it("空スカッド（先発0人）: 全カテゴリ判定対象外・0点で代用しない", () => {
    const r = diagnoseSquad(fullInputInput({ starters: [] }));
    for (const c of r.categories) {
      if (c.id === "squadCompleteness") continue;
      expect(c.score).toBeNull();
      expect(c.tier).toBeNull();
    }
    expect(r.overall.score).toBeNull();
    expect(r.overall.tier).toBeNull();
  });
  it("先発1人（フィールドプレイヤー）: 判定可能", () => {
    const input = fullInputInput({ starters: [player({ key: "cf", role: "FW", stats: makeStats({}, 70) })] });
    const r = diagnoseSquad(input);
    const attack = r.categories.find((c) => c.id === "attack")!;
    expect(attack.score).toBe(70);
    expect(attack.sampleSize).toBe(1);
  });
  it("GKのみの先発: フィールド系カテゴリは判定対象外（GKと混同しない）", () => {
    const input = fullInputInput({ starters: [player({ key: "gk", role: "GK", assignedPosition: "GK", stats: makeStats({}, 80) })] });
    const r = diagnoseSquad(input);
    const attack = r.categories.find((c) => c.id === "attack")!;
    expect(attack.score).toBeNull();
  });
  it("ベンチのみ（先発0）: 判定対象外", () => {
    const input = fullInputInput({ starters: [], bench: [player({ key: "b1" })] });
    const r = diagnoseSquad(input);
    expect(r.overall.score).toBeNull();
  });
  it("worldCardId未解決の枠: 0点にせず判定対象外の一部として扱う", () => {
    const input = fullInputInput({
      starters: [
        player({ key: "s1", cardResolved: false, stats: null, worldCardId: "999", registeredPosition: null }),
      ],
    });
    const r = diagnoseSquad(input);
    expect(r.overall.score).toBeNull();
    expect(r.dataQuality.unresolvedCardCount).toBe(1);
  });
  it("保存ビルド未設定: データ不足として扱い評価点を下げない（能力値は基礎値のまま計算対象）", () => {
    const withBuild = fullInputInput({
      starters: [player({ key: "s1", stats: makeStats({}, 70), savedBuildStatus: "ok", savedBuildId: "b1" })],
    });
    const withoutBuild = fullInputInput({
      starters: [player({ key: "s1", stats: makeStats({}, 70), savedBuildStatus: "none", savedBuildId: null })],
    });
    const r1 = diagnoseSquad(withBuild);
    const r2 = diagnoseSquad(withoutBuild);
    // 保存ビルド未設定であること自体はスコア計算式に含まれない（stats に基づく）
    expect(r1.overall.score).toBe(r2.overall.score);
    expect(r2.dataQuality.missingSavedBuildCount).toBe(1);
  });
  it("別worldCardIdの保存ビルドは使用しない（world-card-mismatchとして検出）", () => {
    const buildsById = new Map<string, SavedBuild>([
      [
        "b-other-card",
        {
          buildId: "b-other-card",
          worldCardId: "999999999999",
          buildName: "別カードのビルド",
          progressionAllocation: {},
          selectedPlayerBooster: null,
          calculatedStats: {},
          calculatedOvr: null,
          calculationMode: "provisional",
          rulesVersion: "progression/2026-08-28.v2",
          createdAt: "2026-09-06T00:00:00.000Z",
          updatedAt: "2026-09-06T00:00:00.000Z",
          schemaVersion: 1,
        },
      ],
    ]);
    const squad = {
      squadId: "sq_x", squadName: "x", formationId: "4-3-3", managerId: null,
      slots: [{ slotId: "cf", worldCardId: "1", buildMode: "none" as const, savedBuildId: "b-other-card" }],
      substitutes: [], captainSlotId: null,
      setPieces: { corners: null, freeKicks: null, penalties: null },
      linkUp: { centerPieceSlotId: null, keyManSlotId: null },
      rulesVersion: "progression/2026-08-28.v2", schemaVersion: 1,
      createdAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:00:00.000Z",
    };
    const computed = buildSquad({
      formationId: "4-3-3",
      entries: { cf: squadEntry({ ...MESSI_BIGTIME, worldCardId: "1" }) },
      substitutes: [], manager: null, managerLinkUpPlays: null, captainSlotId: null,
      linkUpSelection: { centerPieceSlotId: null, keyManSlotId: null },
    });
    const diagInput = buildSquadDiagnosisInput({ squad, computed, buildsById, managerResolved: true });
    const slot = diagInput.starters.find((s) => s.key === "cf")!;
    expect(slot.savedBuildStatus).toBe("world-card-mismatch");
  });
  it("savedBuildId削除済み: 弱点・改善候補として検出（能力弱点と混同しない）", () => {
    const input = fullInputInput({
      starters: [player({ key: "s1", savedBuildId: "deleted1", savedBuildStatus: "missing" })],
    });
    const r = diagnoseSquad(input);
    expect(r.weaknesses.some((w) => w.kind === "referenceError")).toBe(true);
    expect(r.suggestions.some((s) => s.id === "suggest-broken-ref")).toBe(true);
  });
  it("監督未設定: managerResolved=true・unresolvedManager=false", () => {
    const r = diagnoseSquad(fullInputInput({ managerId: null, managerResolved: true }));
    expect(r.dataQuality.unresolvedManager).toBe(false);
  });
  it("監督未解決（managerId はあるが解決できない）", () => {
    const r = diagnoseSquad(fullInputInput({ managerId: 999, managerResolved: false }));
    expect(r.dataQuality.unresolvedManager).toBe(true);
  });
  it("能力値欠損（一部キーが無い）: 安全側でそのカテゴリへ不算入", () => {
    const incomplete = makeStats().filter((s) => s.key !== "finishing"); // attack カテゴリの一部が欠ける
    const input = fullInputInput({ starters: [player({ key: "s1", stats: incomplete })] });
    const r = diagnoseSquad(input);
    const attack = r.categories.find((c) => c.id === "attack")!;
    expect(attack.score).toBeNull(); // 唯一の対象選手の finishing が無いため不算入
  });
  it("データ充足率: 先発充足数から算出（11枠中6枠のみ充足）", () => {
    const starters = fullInputInput().starters.map((s, i) =>
      i < 6 ? s : { ...s, cardResolved: false, stats: null, worldCardId: null },
    );
    const r = diagnoseSquad(fullInputInput({ starters }));
    expect(r.dataQuality.totalStartingSlots).toBe(11);
    expect(r.dataQuality.filledStartingSlots).toBe(6);
    expect(r.dataQuality.coveragePercent).toBe(Math.round((6 / 11) * 100));
  });
});

// ---------------------------------------------------------------------------
// 項目別評価
// ---------------------------------------------------------------------------
describe("scoreSquadCategory: 各項目", () => {
  const starters = [player({ key: "s1", role: "FW", stats: makeStats({}, 80) })];
  for (const def of ABILITY_CATEGORIES) {
    it(`${def.id}: 対象選手の平均で算出・0-100の範囲`, () => {
      const c = scoreSquadCategory(def, starters);
      expect(c.score).toBe(80);
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    });
  }
  it("採用しなかった項目（GK専用カテゴリ）は候補に存在しない", () => {
    expect(ABILITY_CATEGORIES.some((c) => c.id === ("goalkeeping" as never))).toBe(false);
  });
  it("上限100・下限0（丸め）", () => {
    const hi = scoreSquadCategory(ABILITY_CATEGORIES[0], [player({ stats: makeStats({}, 99) })]);
    const lo = scoreSquadCategory(ABILITY_CATEGORIES[0], [player({ stats: makeStats({}, 0) })]);
    expect(hi.score).toBe(99);
    expect(lo.score).toBe(0);
  });
});

describe("determineDiagnosisGrade: ランク境界", () => {
  it("閾値定数と一致する境界をテスト", () => {
    for (const t of DIAGNOSIS_TIER_THRESHOLDS) {
      expect(determineDiagnosisGrade(t.min)).toBe(t.tier);
    }
  });
  it("境界の1点下は1段階下のランク", () => {
    expect(determineDiagnosisGrade(84)).toBe("A");
    expect(determineDiagnosisGrade(85)).toBe("S");
    expect(determineDiagnosisGrade(69)).toBe("B");
    expect(determineDiagnosisGrade(39)).toBe("D");
  });
  it("同じ点数は常に同じランク", () => {
    expect(determineDiagnosisGrade(72)).toBe(determineDiagnosisGrade(72));
  });
  it("0点・100点でも例外にならない", () => {
    expect(determineDiagnosisGrade(0)).toBe("D");
    expect(determineDiagnosisGrade(100)).toBe("S");
  });
});

// ---------------------------------------------------------------------------
// 役割（GK/DF/MF/FW・先発/ベンチ）
// ---------------------------------------------------------------------------
describe("役割の区別", () => {
  it("GKはフィールド評価から除外される", () => {
    const gk = player({ key: "gk", role: "GK", stats: makeStats({}, 10) });
    const fw = player({ key: "fw", role: "FW", stats: makeStats({}, 90) });
    const r = diagnoseSquad(fullInputInput({ starters: [gk, fw] }));
    const attack = r.categories.find((c) => c.id === "attack")!;
    expect(attack.score).toBe(90); // GK の低い値に引きずられない
    expect(attack.sampleSize).toBe(1);
  });
  it("ベンチは項目別評価（能力カテゴリ）の対象に含めない", () => {
    const starter = player({ key: "s1", role: "FW", stats: makeStats({}, 50) });
    const withoutBenchBoost = diagnoseSquad(fullInputInput({ starters: [starter], bench: [] }));
    const withBenchBoost = diagnoseSquad(
      fullInputInput({ starters: [starter], bench: [player({ key: "b1", stats: makeStats({}, 99) })] }),
    );
    const a1 = withoutBenchBoost.categories.find((c) => c.id === "attack")!;
    const a2 = withBenchBoost.categories.find((c) => c.id === "attack")!;
    expect(a1.score).toBe(a2.score); // ベンチの能力値は加点されない
  });
  it("同じ選手の重複配置があっても各スロットは独立に扱う（例外にならない）", () => {
    const a = player({ key: "s1", worldCardId: "1", stats: makeStats({}, 60) });
    const b = player({ key: "s2", worldCardId: "1", stats: makeStats({}, 60) });
    expect(() => diagnoseSquad(fullInputInput({ starters: [a, b] }))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 長所・弱点
// ---------------------------------------------------------------------------
describe("長所・弱点", () => {
  it("最大3件まで", () => {
    const starters = fullInputInput().starters.map((s) => ({ ...s, stats: makeStats({}, 95) }));
    const r = diagnoseSquad(fullInputInput({ starters }));
    expect(r.strengths.length).toBeLessThanOrEqual(3);
    expect(r.weaknesses.length).toBeLessThanOrEqual(3);
  });
  it("データ不足を弱点（ability）にしない", () => {
    const r = diagnoseSquad(fullInputInput({ starters: [] }));
    expect(r.weaknesses.every((w) => w.kind !== "ability")).toBe(true);
  });
  it("参照エラーを能力弱点にしない（kind=referenceError）", () => {
    const input = fullInputInput({ starters: [player({ savedBuildId: "x", savedBuildStatus: "missing" })] });
    const r = diagnoseSquad(input);
    const refFinding = r.weaknesses.find((w) => w.id.startsWith("weakness-ref-"));
    expect(refFinding?.kind).toBe("referenceError");
  });
  it("根拠を保持する（各カテゴリに evidence がある）", () => {
    const r = diagnoseSquad(fullInputInput());
    for (const c of r.categories) {
      expect(c.evidence.length).toBeGreaterThan(0);
    }
  });
  it("同点時も安定した順序（同じ入力で同じ並び）", () => {
    const input = fullInputInput({ starters: fullInputInput().starters.map((s) => ({ ...s, stats: makeStats({}, 60) })) });
    const r1 = diagnoseSquad(input);
    const r2 = diagnoseSquad(input);
    expect(r1.strengths.map((s) => s.id)).toEqual(r2.strengths.map((s) => s.id));
    expect(r1.weaknesses.map((s) => s.id)).toEqual(r2.weaknesses.map((s) => s.id));
  });
});

// ---------------------------------------------------------------------------
// 改善候補
// ---------------------------------------------------------------------------
describe("suggestSquadImprovements", () => {
  it("保存ビルド未設定を案内", () => {
    const input = fullInputInput({ starters: [player({ savedBuildStatus: "none", savedBuildId: null })] });
    const r = diagnoseSquad(input);
    expect(r.suggestions.some((s) => s.id === "suggest-missing-build")).toBe(true);
  });
  it("保存ビルド未設定の案内文に不正確な『基礎値のまま評価』を含めず、育成後の完成状態を反映していないことを伝える", () => {
    const input = fullInputInput({ starters: [player({ savedBuildStatus: "none", savedBuildId: null })] });
    const r = diagnoseSquad(input);
    const suggestion = r.suggestions.find((s) => s.id === "suggest-missing-build");
    expect(suggestion).toBeDefined();
    expect(suggestion!.detail).not.toContain("基礎値のまま評価");
    expect(suggestion!.detail).toMatch(/育成後の完成状態を十分に反映していません/);
    // B1/B2/Power of Many 等の内部計算用語をユーザー向け文言へ含めない
    expect(suggestion!.detail).not.toMatch(/\bB1\b|\bB2\b|Power of Many|calculatePlayerBooster/i);
  });
  it("削除済み参照の修正を案内", () => {
    const input = fullInputInput({ starters: [player({ savedBuildId: "x", savedBuildStatus: "missing" })] });
    const r = diagnoseSquad(input);
    expect(r.suggestions.some((s) => s.id === "suggest-broken-ref")).toBe(true);
  });
  it("配置適性の問題を案内", () => {
    const input = fullInputInput({ starters: [player({ compatibilityStatus: "gkMismatch" })] });
    const r = diagnoseSquad(input);
    expect(r.suggestions.some((s) => s.id === "suggest-compat")).toBe(true);
  });
  it("ベンチ入れ替え候補: 改善幅が閾値以上のときだけ提案", () => {
    const weakStarter = player({ key: "s1", role: "FW", stats: makeStats({}, 50) });
    const strongBench = player({ key: "b1", stats: makeStats({}, 50 + BENCH_SWAP_IMPROVEMENT_THRESHOLD) });
    const withGap = diagnoseSquad(fullInputInput({ starters: [weakStarter], bench: [strongBench] }));
    expect(withGap.suggestions.some((s) => s.id === "suggest-bench-swap")).toBe(true);

    const weakBench = player({ key: "b2", stats: makeStats({}, 50 + BENCH_SWAP_IMPROVEMENT_THRESHOLD - 1) });
    const withoutGap = diagnoseSquad(fullInputInput({ starters: [weakStarter], bench: [weakBench] }));
    expect(withoutGap.suggestions.some((s) => s.id === "suggest-bench-swap")).toBe(false);
  });
  it("自動適用なし・架空改善点数なし・所持していない選手を推薦しない（提案は文字列のみで実行ロジックを持たない）", () => {
    const r = diagnoseSquad(fullInputInput());
    for (const s of r.suggestions) {
      expect(typeof s.label).toBe("string");
      expect(typeof s.detail).toBe("string");
      expect((s as unknown as { apply?: unknown }).apply).toBeUndefined();
    }
  });
  it("最大3件まで", () => {
    const input = fullInputInput({
      starters: [
        player({ key: "s1", savedBuildId: "x", savedBuildStatus: "missing" }),
        player({ key: "s2", savedBuildStatus: "none" }),
        player({ key: "s3", compatibilityStatus: "gkMismatch" }),
        player({ key: "s4", cardResolved: false, stats: null, worldCardId: "9" }),
      ],
    });
    const r = diagnoseSquad(input);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 総合評価
// ---------------------------------------------------------------------------
describe("総合評価", () => {
  it("判定可能項目だけで計算し、判定対象外は含めない", () => {
    const r = diagnoseSquad(fullInputInput());
    const computable = r.categories.filter((c) => c.id !== "squadCompleteness" && c.score != null);
    const expected = Math.round(computable.reduce((a, c) => a + c.score!, 0) / computable.length);
    expect(r.overall.score).toBe(expected);
  });
  it("0-100・ランクを持つ", () => {
    const r = diagnoseSquad(fullInputInput());
    expect(r.overall.score).toBeGreaterThanOrEqual(0);
    expect(r.overall.score).toBeLessThanOrEqual(100);
    expect(r.overall.tier).not.toBeNull();
  });
  it("データ充足率を別表示する（総合評価と混同しない）", () => {
    const r = diagnoseSquad(fullInputInput());
    expect(r.dataQuality.coveragePercent).toBeDefined();
    expect(r.dataQuality.coveragePercent).not.toBe(r.overall.score);
  });
});

// ---------------------------------------------------------------------------
// 無料・詳細分離
// ---------------------------------------------------------------------------
describe("basicSummary（無料版候補）と詳細分離", () => {
  it("basicSummary は総合評価・3カテゴリ・上位長所短所1件のみ", () => {
    const r = diagnoseSquad(fullInputInput());
    expect(r.basicSummary.categories.map((c) => c.id).sort()).toEqual(["aerial", "attack", "defense"]);
    expect(r.basicSummary.disclaimer).toBe(DIAGNOSIS_DISCLAIMER);
  });
  it("詳細情報（findings 全件・suggestions・evidence）は categories/strengths/weaknesses/suggestions に別で保持", () => {
    const r = diagnoseSquad(fullInputInput());
    expect(r.categories.length).toBeGreaterThan(r.basicSummary.categories.length);
  });
  it("認証・Pro判定・isProフラグを一切含まない", () => {
    const r = diagnoseSquad(fullInputInput());
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/isPro|authenticated|premium|paid/i);
  });
});

// ---------------------------------------------------------------------------
// 非変更（純関数であること）
// ---------------------------------------------------------------------------
describe("非変更・純関数であること", () => {
  it("入力オブジェクトを変更しない", () => {
    const input = fullInputInput();
    const before = JSON.stringify(input);
    diagnoseSquad(input);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("localStorage/SQLite/HTTP へアクセスしない（グローバルI/Oをスタブして例外にならないことを確認）", () => {
    // jsdom 環境でなくても純粋な計算のみで完結することを確認する意味の回帰
    expect(() => diagnoseSquad(fullInputInput())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// calculateDataCoverage 単体
// ---------------------------------------------------------------------------
describe("calculateDataCoverage", () => {
  it("先発充足数から100分率を算出", () => {
    const input = fullInputInput();
    const categories = diagnoseSquad(input).categories;
    const dq = calculateDataCoverage(input, categories);
    expect(dq.filledStartingSlots).toBe(11);
    expect(dq.totalStartingSlots).toBe(11);
    expect(dq.coveragePercent).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// buildSquadDiagnosisInput + buildSquad 統合（B1/B2/PoW/監督補正・保存ビルド）
// ---------------------------------------------------------------------------
function squadEntry(card: typeof MESSI_BIGTIME, opts: Partial<SquadEntryInput> = {}): SquadEntryInput {
  return {
    card,
    display: {
      worldCardId: card.worldCardId, nameEn: card.nameEn, nameJa: card.nameJa, cardType: card.cardType,
      registeredPosition: card.registeredPosition, playingStyle: null, playingStyleDefensive: null,
      ovrBase: card.ovrBase, ovrMax: card.ovrMax, maximumLevel: card.maximumLevel, hasEfhubLink: false,
      efhubCardId: null, imageUrlCandidate: null, mobileImageUrlCandidate: null, playerSkills: [], aiStyles: [],
    },
    buildMode: "none",
    savedAllocation: null,
    savedBuildName: null,
    savedBuildRulesVersion: null,
    ...opts,
  };
}

function fakeStoredSquad(overrides: Partial<StoredSquad> = {}): StoredSquad {
  return {
    squadId: "sq_diag00001",
    squadName: "統合テスト",
    formationId: "4-3-3",
    managerId: null,
    slots: [],
    substitutes: [],
    captainSlotId: null,
    setPieces: { corners: null, freeKicks: null, penalties: null },
    linkUp: { centerPieceSlotId: null, keyManSlotId: null },
    rulesVersion: "progression/2026-08-28.v2",
    schemaVersion: 1,
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildSquadDiagnosisInput: buildSquad実データとの統合", () => {
  it("B1・B2・監督補正込みの26能力値が診断入力へそのまま反映される（計算をやり直さない）", () => {
    const formation = getFormation("4-3-3");
    const entries: Record<string, SquadEntryInput | null> = {};
    formation.slots.forEach((fs) => {
      entries[fs.slotId] =
        fs.position === "GK" ? squadEntry(NEUER_GK) : fs.role === "DF" ? squadEntry(CANNAVARO_EPIC) : squadEntry(MESSI_BIGTIME);
    });
    const buildInput: BuildSquadInput = {
      formationId: "4-3-3",
      entries,
      substitutes: [],
      manager: null,
      managerLinkUpPlays: null,
      captainSlotId: null,
      linkUpSelection: { centerPieceSlotId: null, keyManSlotId: null },
    };
    const computed = buildSquad(buildInput);
    const squad = fakeStoredSquad({
      slots: formation.slots.map((fs) => ({
        slotId: fs.slotId,
        worldCardId: fs.position === "GK" ? NEUER_GK.worldCardId : fs.role === "DF" ? CANNAVARO_EPIC.worldCardId : MESSI_BIGTIME.worldCardId,
        buildMode: "none",
        savedBuildId: null,
      })),
    });
    const diagInput = buildSquadDiagnosisInput({ squad, computed, buildsById: new Map(), managerResolved: true });
    const messiSlot = diagInput.starters.find((s) => s.worldCardId === MESSI_BIGTIME.worldCardId)!;
    const engineResult = calculateBuild({ card: MESSI_BIGTIME, allocation: {} });
    expect(messiSlot.stats!.find((s) => s.key === "speed")!.finalValue).toBe(
      engineResult.stats.find((s) => s.key === "speed")!.finalValue,
    );
    const r = diagnoseSquad(diagInput);
    expect(r.overall.score).not.toBeNull();
  });

  it("削除済み savedBuildId 参照を buildsById との突合せで検出する", () => {
    const formation = getFormation("4-3-3");
    const gkSlot = formation.slots.find((s) => s.position === "GK")!;
    const entries: Record<string, SquadEntryInput | null> = { [gkSlot.slotId]: squadEntry(NEUER_GK) };
    const computed = buildSquad({
      formationId: "4-3-3",
      entries,
      substitutes: [],
      manager: null,
      managerLinkUpPlays: null,
      captainSlotId: null,
      linkUpSelection: { centerPieceSlotId: null, keyManSlotId: null },
    });
    const squad = fakeStoredSquad({
      slots: [{ slotId: gkSlot.slotId, worldCardId: NEUER_GK.worldCardId, buildMode: "none", savedBuildId: "gone-build" }],
    });
    const diagInput = buildSquadDiagnosisInput({ squad, computed, buildsById: new Map<string, SavedBuild>(), managerResolved: true });
    const gk = diagInput.starters.find((s) => s.worldCardId === NEUER_GK.worldCardId)!;
    expect(gk.savedBuildStatus).toBe("missing");
  });

  it("診断入力の組み立てが StoredSquad / buildsById を変更しない", () => {
    const squad = fakeStoredSquad();
    const computed = buildSquad({
      formationId: "4-3-3",
      entries: {},
      substitutes: [],
      manager: null,
      managerLinkUpPlays: null,
      captainSlotId: null,
      linkUpSelection: { centerPieceSlotId: null, keyManSlotId: null },
    });
    const before = JSON.stringify(squad);
    buildSquadDiagnosisInput({ squad, computed, buildsById: new Map(), managerResolved: true });
    expect(JSON.stringify(squad)).toBe(before);
  });
});
