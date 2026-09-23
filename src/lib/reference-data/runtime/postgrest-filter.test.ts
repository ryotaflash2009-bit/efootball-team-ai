import { describe, it, expect } from "vitest";
import { buildSearchOrFilter, escapeLikePattern, likePatternToRegExp, parsePostgrestOrExpression, quotePostgrestValue } from "./postgrest-filter";

const WORLD = { likeColumns: ["name_en", "name_ja"], exact: { column: "world_card_id", pattern: /^[0-9]{1,20}$/ } } as const;

describe("PostgREST検索フィルターの組み立て", () => {
  it("予約文字(, . ( ) \" \ :)を含む検索語でも条件数は変わらず、値として往復する", () => {
    for (const q of ["'; DROP TABLE world_player_cards;--", "a,b", "x.y.z", "(or)", 'say "hi"', String.raw`back\slash`, "trailing" + String.fromCharCode(92), "id.eq.1,name_en.neq.x", "and(a.eq.1)", "日本語", "@@@###%%%__"]) {
      const expr = buildSearchOrFilter(WORLD, q);
      const parsed = parsePostgrestOrExpression(expr);
      expect(parsed.map((p) => `${p.field}.${p.op}`), q).toEqual(["name_en.ilike", "name_ja.ilike"]);
      for (const p of parsed) expect(p.value).toBe(`%${escapeLikePattern(q)}%`);
    }
  });

  it("完全一致条件は形式に合う検索語だけに付く", () => {
    expect(parsePostgrestOrExpression(buildSearchOrFilter(WORLD, "88041460996837")).map((p) => [p.field, p.op, p.value])).toContainEqual(["world_card_id", "eq", "88041460996837"]);
    expect(buildSearchOrFilter(WORLD, "1 or 1")).not.toContain("world_card_id");
  });

  it("LIKEのワイルドカードは文字どおりに一致する(SQLite経路のESCAPEと同じ)", () => {
    const pattern = `%${escapeLikePattern("50%_off")}%`;
    expect(likePatternToRegExp(pattern).test("Big 50%_off sale")).toBe(true);
    expect(likePatternToRegExp(pattern).test("Big 50xxoff sale")).toBe(false);
    expect(likePatternToRegExp("%messi%").test("Lionel MESSI")).toBe(true);
  });

  it("引用値のエスケープ", () => {
    expect(quotePostgrestValue(String.raw`a"b\c`)).toBe(String.raw`"a\"b\\c"`);
    expect(() => buildSearchOrFilter({ likeColumns: ["name_en;drop"] }, "x")).toThrow();
    expect(() => parsePostgrestOrExpression('name_en.ilike."open')).toThrow();
  });
});
