import { afterEach, describe, expect, it } from "vitest";
import { countFromFormatted, fillMessage, setPluralLocale } from "./message-format";

afterEach(() => setPluralLocale("en-US"));

describe("文言の差し込み（fillMessage）", () => {
  it("{name} を置き換える（従来と同じ。同じ名前は全部）。無い名前・不明な書式はそのまま", () => {
    expect(fillMessage("Search {count} cards", { count: "13,372" })).toBe("Search 13,372 cards");
    expect(fillMessage("{a} vs {b} ({a})", { a: "X", b: "Y" })).toBe("X vs Y (X)");
    expect(fillMessage("{missing} ok", {})).toBe("{missing} ok");
    expect(fillMessage("no braces", { a: "x" })).toBe("no braces");
    expect(fillMessage("{weird thing}", { a: "x" })).toBe("{weird thing}");
  });

  it("日本語・English の辞書の値の差し込みは従来の実装と同じ結果（複数形の書式を使わない）", () => {
    const legacy = (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), s);
    for (const [s, v] of [
      ["全 {count} 件", { count: "13,372" }],
      ["{name} ({position})", { name: "Lionel Messi", position: "SS" }],
      ["Top {value}%", { value: "5" }],
    ] as const) {
      expect(fillMessage(s, v)).toBe(legacy(s, v));
    }
  });

  it("複数形: es・pt-BR は 1 だけ単数（Intl.PluralRules）。# は書式済みの値", () => {
    const t = "{count, plural, one {# jugador} other {# jugadores}}";
    setPluralLocale("es");
    expect(fillMessage(t, { count: "1" })).toBe("1 jugador");
    expect(fillMessage(t, { count: "0" })).toBe("0 jugadores");
    expect(fillMessage(t, { count: "13.372" })).toBe("13.372 jugadores");
    setPluralLocale("pt-BR");
    const p = "{count, plural, one {# carta salva} other {# cartas salvas}}";
    expect(fillMessage(p, { count: "1" })).toBe("1 carta salva");
    expect(fillMessage(p, { count: "2" })).toBe("2 cartas salvas");
  });

  it("=0 の形・入れ子の差し込み・前後の文", () => {
    setPluralLocale("es");
    const t = "Hay {count, plural, =0 {ningún resultado} one {# resultado para {q}} other {# resultados para {q}}}.";
    expect(fillMessage(t, { count: "0", q: "Messi" })).toBe("Hay ningún resultado.");
    expect(fillMessage(t, { count: "1", q: "Messi" })).toBe("Hay 1 resultado para Messi.");
    expect(fillMessage(t, { count: "24", q: "Messi" })).toBe("Hay 24 resultados para Messi.");
  });

  it("書式済みの数から整数を読む（区切りの違い）", () => {
    expect(countFromFormatted("13,372")).toBe(13372);
    expect(countFromFormatted("13.372")).toBe(13372);
    expect(countFromFormatted("1 234")).toBe(1234);
    expect(countFromFormatted("-3")).toBe(-3);
    expect(countFromFormatted("n/a")).toBeNull();
  });
});
