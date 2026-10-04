import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { localizePerspectiveText } from "./diagnosis-perspectives-text-en";

const JP = /[぀-ヿ一-龯]/;

/** コメントを除いた日本語のリテラル。テンプレートの ${…} は、数値の位置を 7・左右を「左」・それ以外を英語の見本値にする。 */
function japaneseLiterals(file: string): string[] {
  let s = readFileSync(path.join(__dirname, file), "utf8");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const out = new Set<string>();
  const re = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const v = m[1] ?? m[2];
    if (!v || !JP.test(v)) continue;
    if (m[2] == null) {
      out.add(v);
      continue;
    }
    out.add(
      v
        .replace(/\$\{fewerName\}/g, "左")
        .replace(/\$\{[^}]*(length|Math\.|footKnown|heightCm|\[1\])[^}]*\}/g, "7")
        .replace(/\$\{[^}]*\}/g, "Sample"),
    );
  }
  return [...out];
}

describe("F-045 診断の追加観点の日本語の英語表示", () => {
  it("diagnosis-perspectives.ts: すべての日本語リテラルが英語になる（汎用文への逃げなし）", () => {
    const lits = japaneseLiterals("diagnosis-perspectives.ts");
    expect(lits.length).toBeGreaterThan(60);
    const fails = lits.filter((l) => {
      const en = localizePerspectiveText(l, "en");
      return JP.test(en) || en === "(Details are available in Japanese only.)";
    });
    expect(fails).toEqual([]);
  });

  it("実際の値: 左右・数値・元データの値（選手名・プレースタイル名）を保つ", () => {
    expect(localizePerspectiveText("右サイドに 1 人寄せると A は 0 人になる（戦術上の意図があれば変える必要はない）", "en")).toBe(
      "Moving one player to the right side makes A 0 (no need to change if it is a tactical choice)",
    );
    expect(localizePerspectiveText("DF: 先発 4 人・控え 1 人", "en")).toBe("DF: 4 starters, 1 substitutes");
    expect(localizePerspectiveText("リオネル メッシ", "en")).toBe("リオネル メッシ");
    expect(localizePerspectiveText("控えの厚み", "ja")).toBe("控えの厚み");
  });
});
