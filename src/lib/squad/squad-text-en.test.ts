import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { localizeSquadText } from "./squad-text-en";

const JP = /[぀-ヿ一-龯]/;

/** コメントを除いた、日本語を含む文字列リテラル（テンプレートの ${…} は見本値 "7" に置き換える）。lib-text-en.test.ts と同じ方法。 */
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

describe("スカッド計算ライブラリの日本語の英語表示", () => {
  for (const f of ["build-squad.ts", "position.ts", "link-up.ts", "moves.ts", "squad-storage.ts", "templates.ts"]) {
    it(`${f}: すべての日本語リテラルが英語になる（汎用文への逃げなし）`, () => {
      const lits = japaneseLiterals(f);
      expect(lits.length).toBeGreaterThan(0);
      for (const l of lits) {
        const en = localizeSquadText(l, "en");
        expect(JP.test(en), `${f}: ${l} → ${en}`).toBe(false);
        expect(en, `${f}: ${l}`).not.toBe("(Details are available in Japanese only.)");
      }
    });
  }

  it("実際の値: 選手名（元データ）は残し、文だけを訳す・役割の並びも訳す", () => {
    expect(localizeSquadText("先発が 4/11 人です。", "en")).toBe("4/11 starters.");
    expect(localizeSquadText("Lionel Messi: CB は不適性の可能性があります（能力値は下げていません）。", "en")).toBe(
      "Lionel Messi: CB may be unsuited (abilities are not reduced).",
    );
    expect(localizeSquadText("先発から外れたため キャプテン / FK担当 を解除しました。", "en")).toBe(
      "Cleared captain / free-kick taker because the player left the starting XI.",
    );
    expect(localizeSquadText("監督「Test」の確認済みブースターを全選手へ適用しています。", "en")).toBe('Confirmed boosters of manager "Test" are applied to all players.');
    // 育成計算の警告（progression）も同じ関数で英語になる
    expect(JP.test(localizeSquadText("B2 ブースターは指定されていません。", "en"))).toBe(false);
  });

  it("日本語画面では元の文のまま", () => {
    expect(localizeSquadText("先発が 4/11 人です。", "ja")).toBe("先発が 4/11 人です。");
  });
});
