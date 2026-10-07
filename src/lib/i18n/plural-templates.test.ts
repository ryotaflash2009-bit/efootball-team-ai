import { describe, it, expect, afterEach } from "vitest";
import en from "./dictionaries/en";
import { fillMessage, setPluralLocale } from "./message-format";
import es from "./dictionaries/locales/es";

/**
 * 数が 1 になりうる英語（と複数形のある言語）の文言は、ICU の複数形で書く（2026-10-08）。
 * 呼び出し側は `.replace` ではなく fillMessage を使う（`.replace` では複数形を選べない）。
 */
afterEach(() => setPluralLocale("en-US"));

describe("英語の複数形", () => {
  const cases: [string, Record<string, string>, string, string][] = [
    [en.boosterList.countTemplate, { count: "1" }, "1 booster", "2 boosters"],
    [en.growthProfile.excludedRulesTemplate, { count: "1" }, "1 entry under a different diagnosis rule is not compared.", "2 entries under different diagnosis rules are not compared."],
    [en.squadCompareBoard.skillKindsTemplate, { name: "A", n: "1" }, "A: 1 skill", "A: 2 skills"],
    [en.squadCompareBoard.miniAriaTemplate, { side: "A", name: "X", n: "1", list: "" }, "Placement of squad A (X). 1 starter. ", "Placement of squad A (X). 2 starters. "],
    [en.squadEditor.placementAssistAppliedTemplate, { action: "Align", count: "1" }, "Align (1 player)", "Align (2 players)"],
  ];
  it.each(cases)("%s", (tpl, vars, one, two) => {
    setPluralLocale("en-US");
    expect(fillMessage(tpl, vars)).toBe(one);
    const key = Object.keys(vars).find((k) => vars[k] === "1")!;
    expect(fillMessage(tpl, { ...vars, [key]: "2" })).toBe(two);
  });
  it("書式済みの大きな数でも other を選ぶ", () => {
    setPluralLocale("en-US");
    expect(fillMessage(en.boosterList.countTemplate, { count: "1,234" })).toBe("1,234 boosters");
  });
});

describe("スペイン語の複数形", () => {
  it("1 と 2 で形が変わる", () => {
    setPluralLocale("es");
    const tpl = (es as unknown as typeof en).squadCompareBoard.skillKindsTemplate;
    expect(fillMessage(tpl, { name: "A", n: "1" })).toBe("A: 1 habilidad");
    expect(fillMessage(tpl, { name: "A", n: "3" })).toBe("A: 3 habilidades");
  });
});
