import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 複数形の書式（`{count, plural, …}`）を使うキーは、画面で必ず fillMessage を通すこと（2026-10-06）。
 * `t("ns", "key").replace("{count}", …)` のような直接の置き換えでは複数形が解決されず、書式がそのまま画面に出る。
 */
function pluralKeys(): Set<string> {
  const keys = new Set<string>();
  for (const f of globSync("src/lib/i18n/dictionaries/locales/**/*.ts")) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/^\s*([A-Za-z0-9_]+):\s*(?:"|`)[^\n]*,\s*plural\s*,/gm)) keys.add(m[1]);
  }
  return keys;
}

describe("複数形の書式の使い方", () => {
  it("複数形の書式を使うキーを、直接の .replace() で埋めていない", () => {
    const keys = pluralKeys();
    const offenders: string[] = [];
    if (keys.size === 0) return;
    for (const f of globSync("src/**/*.{ts,tsx}").filter((x) => !x.includes(".test.") && !x.includes("/dictionaries/") && !x.includes("\\dictionaries\\"))) {
      const src = readFileSync(f, "utf8");
      for (const k of keys) {
        const rx = new RegExp(`["'\`]${k}["'\`]\\)\\s*\\.replace\\(`);
        if (rx.test(src)) offenders.push(`${f}: ${k}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ja・en の辞書は複数形の書式を使わない（従来の差し込みと同じ結果を保つ）", () => {
    for (const f of ["src/lib/i18n/dictionaries/en.ts", "src/lib/i18n/dictionaries/ja.ts", ...globSync("src/lib/i18n/dictionaries/ja-ns/*.ts")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/,\s*plural\s*,/);
    }
  });
});
