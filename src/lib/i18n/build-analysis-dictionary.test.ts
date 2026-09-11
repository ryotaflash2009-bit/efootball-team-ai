import { describe, it, expect } from "vitest";
import ja from "./dictionaries/ja";
import en from "./dictionaries/en";

/**
 * Build Analysis（「このビルドを分析」）辞書の安全確認。
 * - 通常/辛口ともに、ユーザー本人への侮辱・断定的な勝敗表現を含まないことを確認する
 *   （README/要件: 下手・雑魚・ゴミ・センスがない・初心者・勝てない・絶対に弱い・全国順位・勝率 等の禁止）。
 * - レンダリングを伴わない静的テキスト検査（jsdom 等の新規依存を追加しないため）。
 */

const FORBIDDEN_JA = ["下手", "雑魚", "ゴミ", "センスがない", "初心者", "勝てない", "絶対に弱い", "全国順位", "勝率", "無駄", "無意味"];
const FORBIDDEN_EN = [
  "you suck",
  "noob",
  "garbage",
  "no sense",
  "beginner",
  "you'll never win",
  "definitely weak",
  "national ranking",
  "win rate",
  "win-rate",
  "useless",
  "pointless",
  "meaningless",
];

function allBuildAnalysisStrings(dict: typeof ja): string[] {
  return Object.values(dict.buildAnalysis).filter((v): v is string => typeof v === "string");
}

describe("buildAnalysis 辞書: 禁止表現の不在", () => {
  it("ja: 侮辱的・断定的な表現を含まない", () => {
    const strings = allBuildAnalysisStrings(ja);
    for (const s of strings) {
      for (const bad of FORBIDDEN_JA) {
        expect(s.includes(bad)).toBe(false);
      }
    }
  });

  it("en: 侮辱的・断定的な表現を含まない", () => {
    const strings = allBuildAnalysisStrings(en as typeof ja).map((s) => s.toLowerCase());
    for (const s of strings) {
      for (const bad of FORBIDDEN_EN) {
        expect(s.includes(bad)).toBe(false);
      }
    }
  });

  it("辛口テンプレートにも禁止語が含まれない（key 名で harsh を含むものを個別確認）", () => {
    const harshKeys = Object.keys(ja.buildAnalysis).filter((k) => /Harsh/i.test(k)) as (keyof typeof ja.buildAnalysis)[];
    expect(harshKeys.length).toBeGreaterThan(0);
    for (const k of harshKeys) {
      const jaText = ja.buildAnalysis[k];
      const enText = (en.buildAnalysis as typeof ja.buildAnalysis)[k];
      for (const bad of FORBIDDEN_JA) expect(jaText.includes(bad)).toBe(false);
      for (const bad of FORBIDDEN_EN) expect(enText.toLowerCase().includes(bad)).toBe(false);
    }
  });
});

describe("buildAnalysis 辞書: 基本的な整合性", () => {
  it("analyzeButtonLabel が日本語/英語で規定文言と一致する", () => {
    expect(ja.buildAnalysis.analyzeButtonLabel).toBe("このビルドを分析");
    expect(en.buildAnalysis.analyzeButtonLabel).toBe("Analyze This Build");
  });

  it("ja と en のキー集合が一致する（audit:i18n-keys と独立の確認）", () => {
    expect(Object.keys(ja.buildAnalysis).sort()).toEqual(Object.keys(en.buildAnalysis).sort());
  });

  it("すべての値が空文字列ではない", () => {
    for (const [k, v] of Object.entries(ja.buildAnalysis)) expect(v, `ja.buildAnalysis.${k}`).not.toBe("");
    for (const [k, v] of Object.entries(en.buildAnalysis)) expect(v, `en.buildAnalysis.${k}`).not.toBe("");
  });
});
