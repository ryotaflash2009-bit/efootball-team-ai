import { describe, expect, it, vi } from "vitest";
import en from "./dictionaries/en";
import { pseudoDictionary, pseudoString } from "./pseudo-locale";

describe("多言語の解決の順: その言語 → English → 日本語", () => {
  it("確認中の言語の未翻訳は English で出し、欠落として記録する（生のキー・空白・日本語を出さない）", async () => {
    vi.resetModules();
    const t = await import("./translate");
    t.registerDictionary("en", en);
    t.registerDictionary("es", { nav: { home: "Inicio" } });
    expect(t.hasDictionary("es")).toBe(true);
    expect(t.translate("es", "nav", "home")).toBe("Inicio");
    expect(t.translate("es", "nav", "players")).toBe(en.nav.players);
    expect(t.missingKeysSeen()).toContain("es:nav.players");
    // 空の値は未翻訳として English
    t.registerDictionary("fr", { nav: { home: "" } });
    expect(t.translate("fr", "nav", "home")).toBe(en.nav.home);
  });

  it("確認中の言語は、英語の辞書がそろうまで表示に使わない（中途半端な日本語の混在を防ぐ）", async () => {
    vi.resetModules();
    const t = await import("./translate");
    t.registerDictionary("de", { nav: { home: "Start" } });
    expect(t.hasDictionary("de")).toBe(false);
    t.registerDictionary("en", en);
    expect(t.hasDictionary("de")).toBe(true);
  });

  it("基本の言語の辞書（dictionaryOf）は、日本語以外は English", async () => {
    vi.resetModules();
    const t = await import("./translate");
    t.registerDictionary("en", en);
    expect(t.dictionaryOf("ko")).toBe(en);
    expect(t.dictionaryOf("en")).toBe(en);
  });

  it("疑似ロケールを読み込める（英語の辞書から作る・別 chunk）", async () => {
    vi.resetModules();
    const t = await import("./translate");
    await t.loadDictionary("en-XA");
    expect(t.hasDictionary("en-XA")).toBe(true);
    expect(t.translate("en-XA", "nav", "home")).toMatch(/^⟦.+⟧$/);
  });

  it("全画面の殻は確認中の言語の辞書・疑似ロケールを静的に import しない（初回 JS に含めない）", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    for (const f of ["translate.ts", "LocaleContext.tsx", "locale-registry.ts"]) {
      const src = readFileSync(path.join(__dirname, f), "utf8");
      expect(src).not.toMatch(/^import[^;]+from\s+"\.\/(dictionaries\/(en|locales\/[^"]+)|pseudo-locale)"/m);
    }
  });
});

describe("疑似ローカライズ", () => {
  it("en-XA: アクセント・約 40% 長く・⟦ ⟧。差し込み・URL・メールアドレスは変えない", () => {
    const s = pseudoString("Search {count} cards at https://example.com or mail a@b.co", "en-XA");
    expect(s.startsWith("⟦")).toBe(true);
    expect(s.endsWith("⟧")).toBe(true);
    expect(s).toContain("{count}");
    expect(s).toContain("https://example.com");
    expect(s).toContain("a@b.co");
    expect(s).toMatch(/Šéáŕçĥ/);
    expect(s.length).toBeGreaterThan("Search {count} cards at https://example.com or mail a@b.co".length);
  });

  it("ar-XB: 右から左の表示で囲む（中身・差し込みはそのまま）", () => {
    expect(pseudoString("Hello {name}", "ar-XB")).toBe("‮Hello {name}‬");
    expect(pseudoString("", "ar-XB")).toBe("");
  });

  it("辞書全体: すべての文字列を変換し、差し込みの数・順を保つ", () => {
    const xa = pseudoDictionary(en, "en-XA") as unknown as Record<string, Record<string, string>>;
    let checked = 0;
    for (const [ns, keys] of Object.entries(en as unknown as Record<string, Record<string, unknown>>)) {
      for (const [k, v] of Object.entries(keys)) {
        if (typeof v !== "string") continue;
        const ph = (x: string) => (x.match(/\{[A-Za-z0-9_]+\}/g) ?? []).join(",");
        expect(ph(xa[ns][k])).toBe(ph(v));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3000);
  });
});

describe("下書きの言語（MACHINE_DRAFT）の読み込み", () => {
  it("registry の下書きの言語はすべて辞書を読み込め、核の文言が English と違う訳になっている", async () => {
    const { LOCALES } = await import("./locale-registry");
    const drafts = LOCALES.filter((l) => l.state === "MACHINE_DRAFT");
    for (const l of drafts) {
      vi.resetModules();
      const t = await import("./translate");
      await t.loadDictionary(l.code);
      expect(t.hasDictionary(l.code), l.code).toBe(true);
      expect(t.translate(l.code, "nav", "players"), l.code).not.toBe(en.nav.players);
      expect(t.translate(l.code, "nav", "brand"), l.code).toBe("TeamAIXI");
    }
  }, 60_000);
});
