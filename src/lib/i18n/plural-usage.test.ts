import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 複数形の書式（`{count, plural, …}`）を使うキーは、画面で必ず fillMessage を通すこと（2026-10-06）。
 * `t("ns", "key").replace("{count}", …)` のような直接の置き換えでは複数形が解決されず、書式がそのまま画面に出る。
 */
function pluralKeys(): Set<string> {
  const keys = new Set<string>();
  for (const f of [...globSync("src/lib/i18n/dictionaries/locales/**/*.ts"), "src/lib/i18n/dictionaries/en.ts"]) {
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

  /**
   * 英語で複数形の書式を使ってよいキー（2026-10-08）。数が 1 になりうる文言だけ。呼び出し側は fillMessage を使う（上のテストで確認）。
   * 日本語は複数形を区別しないため使わない。
   */
  const EN_PLURAL_KEYS = new Set([
    "countTemplate", "excludedRulesTemplate", "skillKindsTemplate", "miniAriaTemplate", "optionTemplate",
    "placementAssistAppliedTemplate", "anShowAll", "streakTemplate",
  ]);

  it("ja の辞書は複数形の書式を使わない・en は許可したキーだけ", () => {
    for (const f of ["src/lib/i18n/dictionaries/ja.ts", ...globSync("src/lib/i18n/dictionaries/ja-ns/*.ts")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/,\s*plural\s*,/);
    }
    const en = readFileSync("src/lib/i18n/dictionaries/en.ts", "utf8");
    const used = [...en.matchAll(/^\s*([A-Za-z0-9_]+):\s*"[^\n]*,\s*plural\s*,/gm)].map((m) => m[1]);
    expect(used.filter((k) => !EN_PLURAL_KEYS.has(k))).toEqual([]);
    expect(used.length).toBeGreaterThan(0);
  });
});
