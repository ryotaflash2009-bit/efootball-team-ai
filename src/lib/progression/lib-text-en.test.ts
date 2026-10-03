import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { localizeLibText } from "./lib-text-en";

const FILES = [
  "calculate-player-booster.ts",
  "conditional-boosters.ts",
  "calculate-manager-booster.ts",
  "engine.ts",
  "card-eligibility.ts",
  "group-allocation.ts",
  "booster-catalog.ts",
  "../comparison/ability-radar.ts",
  "../comparison/build-comparison.ts",
];
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
    out.add(m[2] != null ? v.replace(/\$\{[^}]*\}/g, "7") : v);
  }
  return [...out];
}

describe("育成ライブラリの日本語注記の英語表示", () => {
  for (const f of FILES) {
    it(`${f}: すべての日本語リテラルが英語になる（汎用文への逃げなし）`, () => {
      const lits = japaneseLiterals(f);
      expect(lits.length).toBeGreaterThan(0);
      for (const l of lits) {
        const en = localizeLibText(l, "en");
        expect(JP.test(en), `${f}: ${l}`).toBe(false);
        expect(en, `${f}: ${l}`).not.toBe("(Details are available in Japanese only.)");
      }
    });
  }

  it("日本語画面では元の文のまま", () => {
    expect(localizeLibText("監督は未選択。", "ja")).toBe("監督は未選択。");
  });

  it("テンプレート: 監督名・ユーザー指定条件・配分の補正（入れ子）", () => {
    expect(localizeLibText("監督「Test」のブースター効果は未確認のため適用していません。", "en")).toBe('Manager "Test" booster effects are unconfirmed, so they are not applied.');
    expect(localizeLibText("ユーザー指定条件: 対象リーグ 14〜19 人相当、対象能力 +2", "en")).toBe("User-specified condition: 14–19 players from the league, target abilities +2");
    expect(localizeLibText("配分の補正: dribbling: 上限まで丸め (20 → 13)", "en")).toBe("Allocation adjusted: dribbling: capped (20 → 13)");
    expect(localizeLibText("English text", "en")).toBe("English text");
  });
});
