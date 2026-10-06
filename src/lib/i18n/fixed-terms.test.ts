import { describe, expect, it } from "vitest";
import { checkFixedTerms, FIXED_TERMS } from "../../../scripts/lib/fixed-terms.mjs";
import en from "./dictionaries/en";
import ja from "./dictionaries/ja";
import { GENERATED_SOURCE as LIB } from "@/lib/progression/lib-text-en";
import { GENERATED_SOURCE as BUILDS } from "@/lib/progression/builds-text-en";
import { GENERATED_SOURCE as COMPARE } from "@/lib/squad/compare-text-en";
import { GENERATED_SOURCE as SQUAD } from "@/lib/squad/squad-text-en";
import { GENERATED_SOURCE as DIAG } from "@/lib/squad/squad-diagnosis-text-en";
import { GENERATED_SOURCE as PERSP } from "@/lib/squad/diagnosis-perspectives-text-en";

/**
 * 固有の用語の契約（本人の判断 2026-10-07）: Link-Up Play・OVR は、データ元で正式な現地語の表記を確認できるまで全言語で原語のまま。
 * 現地語の短い補足は原語と並べた場合だけ。English の原文に用語がある文は、訳にも同じ原語が必要（scripts/lib/fixed-terms.mjs）。
 */
const LOCALES = ["es", "pt-BR", "fr", "de", "it", "ko", "zh-CN", "zh-TW", "id", "tr"] as const;
const LEGAL = new Set(["terms", "privacy", "disclaimer"]);
const SOURCES = [LIB, BUILDS, COMPARE, SQUAD, DIAG, PERSP];
type Dict = Record<string, Record<string, unknown>>;
type Catalog = Record<string, { fixed?: Record<string, string>; patterns?: Record<string, string> }>;

describe("固有の用語の契約（Link-Up Play・OVR）", () => {
  it("判定: 原語あり・補足つきは OK、原語なしの現地語や原語の欠落は違反", () => {
    expect(checkFixedTerms("Link-Up Play", "Link-Up Play")).toEqual([]);
    expect(checkFixedTerms("Link-Up Play", "Link-Up Play (juego combinado)")).toEqual([]);
    expect(checkFixedTerms("Link-Up Play", "Juego combinado").length).toBeGreaterThan(0);
    expect(checkFixedTerms("Max OVR", "OVR máx.")).toEqual([]);
    expect(checkFixedTerms("Max OVR", "Gesamtwertung max.").length).toBeGreaterThan(0);
    expect(checkFixedTerms("Overall", "Note générale (GEN)").length).toBeGreaterThan(0);
    expect(FIXED_TERMS.map((t: { id: string }) => t.id)).toEqual(["linkUpPlay", "ovr"]);
  });

  it("ja・en の原文は原語を使う（ja も Link-Up Play・OVR）", () => {
    for (const [ns, keys] of Object.entries(en as unknown as Dict)) {
      for (const [k, v] of Object.entries(keys)) {
        const j = (ja as unknown as Dict)[ns]?.[k];
        if (typeof v !== "string" || typeof j !== "string") continue;
        if (/\bOVR\b/.test(v) && /総合値|オーバーオール/.test(j)) expect(j, `${ns}.${k}`).toMatch(/OVR/);
      }
    }
  });

  for (const locale of LOCALES) {
    it(`${locale}: 辞書・生成文の表で原語が保たれ、原語なしの現地語の訳が無い`, async () => {
      const { default: dict } = (await import(`./dictionaries/locales/${locale}.ts`)) as { default: Dict };
      const { default: cat } = (await import(`./dictionaries/locales/${locale}/generated.ts`)) as { default: Catalog };
      const problems: string[] = [];
      let checked = 0;
      for (const [ns, keys] of Object.entries(en as unknown as Dict)) {
        if (LEGAL.has(ns)) continue;
        for (const [k, v] of Object.entries(keys)) {
          const t = dict[ns]?.[k];
          if (typeof v !== "string" || typeof t !== "string") continue;
          checked++;
          for (const p of checkFixedTerms(v, t)) problems.push(`${ns}.${k}: ${p}`);
        }
      }
      for (const src of SOURCES) {
        const c = cat[src.module];
        if (!c) continue;
        for (const [jaText, enText] of Object.entries(src.fixed)) {
          const t = c.fixed?.[jaText];
          if (typeof t !== "string") continue;
          checked++;
          for (const p of checkFixedTerms(enText, t)) problems.push(`generated ${src.module} "${enText}": ${p}`);
        }
        // パターンの書式は English の原文を持たないため、原語なしの現地語の訳だけを確認する
        for (const [id, t] of Object.entries(c.patterns ?? {})) for (const p of checkFixedTerms("", t)) problems.push(`generated ${src.module}.${id}: ${p}`);
      }
      expect(checked).toBeGreaterThan(3500);
      expect(problems).toEqual([]);
    }, 60_000);
  }
});
