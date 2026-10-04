import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { localizeSquadDiagnosisText } from "./squad-diagnosis-text-en";

const JP = /[぀-ヿ一-龯]/;

/** コメントを除いた、日本語を含む文字列リテラル（テンプレートの ${…} は見本値に置き換える）。 */
function japaneseLiterals(file: string): string[] {
  let s = readFileSync(path.join(__dirname, file), "utf8");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const out = new Set<string>();
  const re = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const v = m[1] ?? m[2];
    if (!v || !JP.test(v)) continue;
    // 見本値: 数値の位置は 7、名前の位置は "Player"（英語の名前でも文が訳されることを確認する）。
    out.add(m[2] != null ? v.replace(/\$\{[^}]*(Count|length|score|tier|Penalty|Math\.round|\.v\)|missing|Compat|Mismatch)[^}]*\}/g, "7").replace(/\$\{[^}]*\}/g, "Player") : v);
  }
  return [...out];
}

describe("スカッド診断ライブラリの日本語の英語表示", () => {
  it("squad-diagnosis.ts: 文を作る日本語リテラルはすべて英語になる（汎用文への逃げなし）", () => {
    const lits = japaneseLiterals("squad-diagnosis.ts").filter((l) => !/^[）（・\/ ]|Player$/.test(l.trim()) || l.length > 12);
    expect(lits.length).toBeGreaterThan(30);
    const fails: string[] = [];
    for (const l of lits) {
      const en = localizeSquadDiagnosisText(l, "en");
      if (JP.test(en) || en === "(Details are available in Japanese only.)") fails.push(`${l} → ${en}`);
    }
    expect(fails).toEqual([]);
  });

  it("実際の値: 能力名の並び・カテゴリ・選手名（元データ）を保つ", () => {
    expect(localizeSquadDiagnosisText("オフェンスセンス / 決定力 / ヘディング", "en")).toBe("Offensive Awareness / Finishing / Heading");
    expect(localizeSquadDiagnosisText("空中戦の評価が低水準です（ランクC・48点）。", "en")).toBe("Aerial is rated low (rank C, 48 points).");
    expect(localizeSquadDiagnosisText("リオネル メッシ（75.6）", "en")).toBe("リオネル メッシ（75.6）");
    expect(localizeSquadDiagnosisText("先発が 7/11 人です。空き枠へ選手を配置すると評価の精度が上がります。", "en")).toBe("7/11 starters. Filling empty slots makes the rating more accurate.");
    expect(localizeSquadDiagnosisText("攻撃", "ja")).toBe("攻撃");
  });
});
