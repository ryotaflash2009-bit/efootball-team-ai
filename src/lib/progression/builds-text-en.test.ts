import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { localizeBuildsText } from "./builds-text-en";
import { nextDuplicateBuildName } from "./my-builds";

const FILES = ["my-builds.ts", "build-duplicate-review.ts", "build-inventory.ts", "build-intent-analysis.ts", "build-import.ts"];
const JP = /[぀-ヿ一-龯]/;
const FALLBACK = "(Details are available in Japanese only.)";

/** コメントを除いた日本語の文字列リテラル（テンプレートの ${…} は見本値に置き換える。入れ子のテンプレートは外側だけ）。 */
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

describe("My Builds・ビルド分析の日本語（ライブラリ由来）の英語表示", () => {
  for (const f of FILES) {
    it(`${f}: すべての日本語リテラルが英語になる（汎用文への逃げなし）`, () => {
      // 入れ子のテンプレート `先発${x ? `（…）` : ""}` は抽出が途中で切れるため除外し、実際の文は下の個別テストで確認する。
      const lits = japaneseLiterals(f).filter((l) => !l.startsWith("先発${") && l !== "先発7");
      expect(lits.length).toBeGreaterThan(0);
      for (const l of lits) {
        const en = localizeBuildsText(l, "en");
        expect(JP.test(en), `${f}: ${l} -> ${en}`).toBe(false);
        expect(en, `${f}: ${l}`).not.toBe(FALLBACK);
      }
    });
  }

  it("実際に組み立てられる文（先発の役割・カテゴリ名・入れ子）", () => {
    expect(localizeBuildsText("先発（CF）", "en")).toBe("Starter (CF)");
    expect(localizeBuildsText("ベンチ 3", "en")).toBe("Bench 3");
    expect(localizeBuildsText("配分: ドリブル（Lv3 → 未配分）", "en")).toBe("Allocation: Dribbling (Lv3 → Not allocated)");
    expect(localizeBuildsText("ドリブル", "en")).toBe("Dribbling");
    expect(localizeBuildsText("スカッド（先発） が、存在しない保存ビルド（buildId b_1）を参照しています。", "en")).toBe("Squad (starter) refers to a saved build that does not exist (buildId b_1).");
    expect(localizeBuildsText("ビルド 1 のコピー", "en")).toBe("ビルド 1 copy");
  });

  it("日本語画面では元の文のまま", () => {
    expect(localizeBuildsText("現行規則", "ja")).toBe("現行規則");
  });

  it("複製名の接尾辞は表示言語に合わせる（既定は日本語・60文字以内・重複は番号）", () => {
    expect(nextDuplicateBuildName("Build 1", [])).toBe("Build 1 のコピー");
    expect(nextDuplicateBuildName("Build 1", [], " copy")).toBe("Build 1 copy");
    expect(nextDuplicateBuildName("Build 1", ["Build 1 copy"], " copy")).toBe("Build 1 copy 2");
    expect(nextDuplicateBuildName("x".repeat(60), [], " copy").length).toBe(60);
  });
});
