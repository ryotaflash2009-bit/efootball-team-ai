import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { localizeSquadCompareText } from "./compare-text-en";

const JP = /[぀-ヿ一-龯]/;

/** コメントを除いた、日本語を含む文字列リテラル（テンプレートの ${…} は見本値に置き換える）。lib-text-en.test.ts と同じ方法。 */
function japaneseLiterals(file: string): string[] {
  let s = readFileSync(path.join(__dirname, file), "utf8");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const out = new Set<string>();
  const re = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const v = m[1] ?? m[2];
    if (!v || !JP.test(v)) continue;
    out.add(m[2] != null ? v.replace(/\$\{[^}]*\}/g, "7") : v);
  }
  return [...out];
}

describe("スカッド比較ライブラリの日本語の英語表示", () => {
  it("compare-squads.ts: すべての日本語リテラルが英語になる（汎用文への逃げなし）", () => {
    const lits = japaneseLiterals("compare-squads.ts");
    expect(lits.length).toBeGreaterThan(0);
    for (const l of lits) {
      const en = localizeSquadCompareText(l, "en");
      expect(JP.test(en), l).toBe(false);
      expect(en, l).not.toBe("(Details are available in Japanese only.)");
    }
  });

  it("日本語画面では元の文のまま・テンプレートの値を保つ", () => {
    expect(localizeSquadCompareText("先発人数", "ja")).toBe("先発人数");
    expect(localizeSquadCompareText("ベンチ 3番", "en")).toBe("Bench #3");
    expect(localizeSquadCompareText("先発 LWF", "en")).toBe("Starter LWF");
    expect(localizeSquadCompareText("カード 89138556575063", "en")).toBe("Card 89138556575063");
    expect(localizeSquadCompareText("English", "en")).toBe("English");
  });
});
