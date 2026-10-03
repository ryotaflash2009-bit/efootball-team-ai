import { describe, it, expect, vi } from "vitest";

// 本番の状態（英語の辞書は未登録）を、setup の登録を経ない新しいモジュールで確認する。
describe("英語の辞書の遅延読み込み（translate.ts）", () => {
  it("未登録の間は ja へフォールバックし、loadDictionary(en) の後は英語を返す", async () => {
    vi.resetModules();
    const t = await import("./translate");
    expect(t.hasDictionary("ja")).toBe(true);
    expect(t.hasDictionary("en")).toBe(false);
    const ja = t.translate("ja", "nav", "home");
    expect(t.translate("en", "nav", "home")).toBe(ja); // 生のキーではなく ja
    expect(t.dictionaryOf("en")).toBe(t.dictionaryOf("ja"));
    await t.loadDictionary("en");
    expect(t.hasDictionary("en")).toBe(true);
    const en = t.translate("en", "nav", "home");
    expect(en).not.toBe(ja);
    expect(en.length).toBeGreaterThan(0);
    await t.loadDictionary("en"); // 2 回目は即時
  });

  it("全画面の殻（LocaleContext）と translate.ts は英語の辞書を静的に import しない", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    for (const f of ["translate.ts", "LocaleContext.tsx"]) {
      const src = readFileSync(path.join(__dirname, f), "utf8");
      expect(src).not.toMatch(/^import\s+\w+\s+from\s+"\.\/dictionaries\/en"/m);
    }
  });
});
