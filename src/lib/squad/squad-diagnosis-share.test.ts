import { describe, it, expect } from "vitest";
import {
  buildSquadDiagnosisShareData,
  sanitizeForFileName,
  formatDateForFileName,
  buildSquadDiagnosisFileName,
  SQUAD_DIAGNOSIS_SHARE_SERVICE_NAME,
  SQUAD_DIAGNOSIS_SHARE_SHORT_DISCLAIMER,
} from "./squad-diagnosis-share";
import { diagnoseSquad, type SquadDiagnosisInput, type SquadDiagnosisPlayerInput } from "./squad-diagnosis";

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
    stats: [],
    savedBuildId: null,
    savedBuildStatus: "none",
    ...overrides,
  };
}

function makeStats(base = 60) {
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

function fullInputInput(overrides: Partial<SquadDiagnosisInput> = {}): SquadDiagnosisInput {
  const starters = Array.from({ length: 11 }, (_, i) =>
    player({ key: `s${i}`, role: i === 0 ? "GK" : "FW", stats: makeStats(60 + (i % 5)) }),
  );
  return {
    squadId: "sq_test", squadName: "テストスカッド", updatedAt: "2026-09-06T00:00:00.000Z",
    formationId: "4-3-3", starters, bench: [], managerId: null, managerResolved: true, managerApplied: false,
    ...overrides,
  };
}

describe("buildSquadDiagnosisShareData", () => {
  it("既存の診断結果から安全なフィールドだけを抽出する（内部ID・根拠を含まない）", () => {
    const result = diagnoseSquad(fullInputInput());
    const data = buildSquadDiagnosisShareData(result, {
      squadName: "マイスカッド",
      formationLabel: "4-3-3",
      generatedAtIso: "2026-09-06T12:00:00.000Z",
    });
    expect(data.serviceName).toBe(SQUAD_DIAGNOSIS_SHARE_SERVICE_NAME);
    expect(data.squadName).toBe("テストスカッド"); // result.squadName を優先
    expect(data.formationLabel).toBe("4-3-3");
    expect(data.categories.length).toBe(8); // squadCompleteness を含めない
    expect(data.disclaimer).toBe(SQUAD_DIAGNOSIS_SHARE_SHORT_DISCLAIMER);
    const json = JSON.stringify(data);
    expect(json).not.toMatch(/worldCardId|buildId|squadId|evidence/i);
  });
  it("スカッド名が空の場合は安全な既定値を使う", () => {
    const result = diagnoseSquad(fullInputInput({ squadName: "" }));
    const data = buildSquadDiagnosisShareData(result, {
      squadName: "",
      formationLabel: "4-3-3",
      generatedAtIso: "2026-09-06T12:00:00.000Z",
    });
    expect(data.squadName).toBe("スカッド");
  });
  it("判定可能カテゴリ数が既存診断結果と一致する", () => {
    const result = diagnoseSquad(fullInputInput());
    const data = buildSquadDiagnosisShareData(result, {
      squadName: "x", formationLabel: "4-3-3", generatedAtIso: "2026-09-06T12:00:00.000Z",
    });
    const expected = result.categories.filter((c) => c.id !== "squadCompleteness" && c.score != null).length;
    expect(data.ratedCategoryCount).toBe(expected);
  });
  it("代表的な長所・弱点は先頭1件のみ（既存の strengths[0]/weaknesses[0] と一致）", () => {
    const result = diagnoseSquad(fullInputInput());
    const data = buildSquadDiagnosisShareData(result, {
      squadName: "x", formationLabel: "4-3-3", generatedAtIso: "2026-09-06T12:00:00.000Z",
    });
    expect(data.topStrength?.label ?? null).toBe(result.strengths[0]?.label ?? null);
    expect(data.topWeakness?.label ?? null).toBe(result.weaknesses[0]?.label ?? null);
  });
  it("判定対象外（空スカッド）でもクラッシュせず安全な値を返す", () => {
    const result = diagnoseSquad(fullInputInput({ starters: [] }));
    const data = buildSquadDiagnosisShareData(result, {
      squadName: "空", formationLabel: "4-3-3", generatedAtIso: "2026-09-06T12:00:00.000Z",
    });
    expect(data.overallScore).toBeNull();
    expect(data.overallTier).toBeNull();
    expect(data.topStrength).toBeNull();
  });
});

describe("sanitizeForFileName", () => {
  it("使用禁止文字を安全な文字へ置換する", () => {
    expect(sanitizeForFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });
  it("空文字列は既定値 squad を返す", () => {
    expect(sanitizeForFileName("")).toBe("squad");
  });
  it("空白のみの文字列も既定値 squad を返す", () => {
    expect(sanitizeForFileName("   ")).toBe("squad");
  });
  it("長すぎる名前は切り詰める", () => {
    const long = "あ".repeat(100);
    expect(sanitizeForFileName(long).length).toBeLessThanOrEqual(40);
  });
  it("前後のドットを除去する（隠しファイル化を避ける）", () => {
    expect(sanitizeForFileName("..hidden..")).not.toMatch(/^\.|\.$/);
  });
  it("日本語チーム名はそのまま使用できる", () => {
    expect(sanitizeForFileName("俺の最強イレブン")).toBe("俺の最強イレブン");
  });
});

describe("formatDateForFileName / buildSquadDiagnosisFileName", () => {
  it("YYYYMMDD形式でゼロ埋めする", () => {
    expect(formatDateForFileName(new Date(2026, 0, 5))).toBe("20260105");
  });
  it("既定のファイル名パターンに従う", () => {
    const name = buildSquadDiagnosisFileName("マイチーム", new Date(2026, 8, 6));
    expect(name).toBe("efootball-team-ai-squad-diagnosis-マイチーム-20260906.png");
  });
  it("空のチーム名でも安全なファイル名になる", () => {
    const name = buildSquadDiagnosisFileName("", new Date(2026, 8, 6));
    expect(name).toBe("efootball-team-ai-squad-diagnosis-squad-20260906.png");
  });
  it("使用禁止文字を含むチーム名でも安全なファイル名になる", () => {
    const name = buildSquadDiagnosisFileName("A/B:C*D", new Date(2026, 8, 6));
    expect(name).toBe("efootball-team-ai-squad-diagnosis-A_B_C_D-20260906.png");
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
  });
  it("同じ入力からは常に同じファイル名を返す（決定的）", () => {
    const d = new Date(2026, 8, 6, 12, 30);
    expect(buildSquadDiagnosisFileName("チームA", d)).toBe(buildSquadDiagnosisFileName("チームA", d));
  });
});
