import { describe, expect, it } from "vitest";
import type { DisplayLocale } from "./locale-registry";
import { registerGeneratedCatalog, ruleId } from "./generated-catalog";
import { GENERATED_SOURCE as DIAG, localizeSquadDiagnosisText } from "@/lib/squad/squad-diagnosis-text-en";
import { GENERATED_SOURCE as LIB, localizeLibText } from "@/lib/progression/lib-text-en";

/**
 * 計算ライブラリが作る文の多言語の表示（2026-10-06）: メッセージ ID・引数・言語ごとの書式。
 * ja・en の表示は変えない。ja・en 以外の言語は、登録された表（catalog）で訳し、無ければ English。
 * ここでは合成の表（"xx-TEST"）で仕組みを確かめる。各言語の表の coverage は言語ごとのテストで確かめる。
 */
const avgRule = DIAG.patterns.find(([re]) => re.source.includes("対象能力平均"))![0];
const highRule = DIAG.patterns.find(([re]) => re.source.includes("評価が高水準"))![0];
const scaleRule = LIB.patterns.find(([re]) => re.source.includes("99 を超える"))![0];

registerGeneratedCatalog("xx-TEST", {
  squadDiagnosis: {
    fixed: { 攻撃: "ATAQUE-T" },
    patterns: {
      [ruleId("squadDiagnosis", avgRule)]: "Media de {1, plural, one {# titular} other {# titulares}}",
      [ruleId("squadDiagnosis", highRule)]: "{cat:1} alto (rango {2}, {3} pts)",
    },
    terms: { cat: { 攻撃: "Ataque-T" } },
  },
  libText: { patterns: { [ruleId("libText", scaleRule)]: "Escala ampliada a {1}" } },
});

const XX = "xx-TEST" as DisplayLocale;

describe("計算ライブラリの文の多言語化（仕組み）", () => {
  it("ja・en の表示は従来どおり（表があっても使わない）", () => {
    expect(localizeSquadDiagnosisText("攻撃", "en")).toBe("Attack");
    expect(localizeSquadDiagnosisText("攻撃", "ja")).toBe("攻撃");
  });

  it("固定の文・パターンの文（引数・複数形・語の表）を表示言語で出す", () => {
    expect(localizeSquadDiagnosisText("攻撃", XX)).toBe("ATAQUE-T");
    expect(localizeSquadDiagnosisText("先発の対象フィールドプレイヤー 1 人（GK除く）の対象能力平均（標準最終値）", XX)).toBe("Media de 1 titular");
    expect(localizeSquadDiagnosisText("先発の対象フィールドプレイヤー 9 人（GK除く）の対象能力平均（標準最終値）", XX)).toBe("Media de 9 titulares");
    expect(localizeSquadDiagnosisText("攻撃の評価が高水準です（ランクA・82点）。", XX)).toBe("Ataque-T alto (rango A, 82 pts)");
    expect(localizeLibText("能力値が 99 を超える系列があります（目盛り上限を 120 に拡張して描画・正確値は代替表と 26 能力値表を参照）。", XX)).toBe("Escala ampliada a 120");
  });

  it("訳が無い・引数を訳せない文は、文ごと English（言語を混ぜない）", () => {
    // 規則はあるが、この表に書式が無い
    const low = "攻撃の評価が低水準です（ランクD・31点）。";
    expect(localizeSquadDiagnosisText(low, XX)).toBe(localizeSquadDiagnosisText(low, "en"));
    // 語の表に無いカテゴリ
    const high = "守備の評価が高水準です（ランクA・80点）。";
    expect(localizeSquadDiagnosisText(high, XX)).toBe(localizeSquadDiagnosisText(high, "en"));
    // 表の無い言語
    expect(localizeSquadDiagnosisText("攻撃", "fr")).toBe("Attack");
  });

  it("規則の ID は正規表現から作り、安定している（同じ規則は同じ ID・違う規則は違う ID）", () => {
    expect(ruleId("m", /^a(\d+)$/)).toBe(ruleId("m", /^a(\d+)$/));
    expect(ruleId("m", /^a(\d+)$/)).not.toBe(ruleId("m", /^b(\d+)$/));
    expect(ruleId("m", /^a$/)).not.toBe(ruleId("n", /^a$/));
    expect(ruleId("m", /^a$/)).toMatch(/^m:[0-9a-f]{8}$/);
  });
});
