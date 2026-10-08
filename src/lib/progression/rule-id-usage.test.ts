import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * コストの規則は「ID」で渡す（2026-10-09 の不具合の再発防止）。
 * 現行の規則（4 段階ごと）は旧規則と版の文字列（`ruleset.version`）が同じため、版を渡すと旧規則として数えてしまう
 * （自動配分が総ポイントを超えた #220）。ポイントを数える関数に `.version` を渡していないことを、ソースから確かめる。
 */
const FUNCS = ["summarizeGroupPoints", "usedPoints", "adjustGroupLevel", "groupBreakdowns", "allocationWithGroupLevel", "getRuleset", "autoAllocate"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("コストの規則は ID で渡す", () => {
  it("ポイントを数える関数の引数に .version を使っていない", () => {
    const bad: string[] = [];
    for (const file of walk("src")) {
      const src = readFileSync(file, "utf8");
      for (const fn of FUNCS) {
        const re = new RegExp(`\\b${fn}\\(([^;]*?)\\)`, "g");
        for (const m of src.matchAll(re)) if (/\.version\b|PROGRESSION_RULES_VERSION\b/.test(m[1]) && !file.replace(/\\/g, "/").endsWith("progression/migrate-build.ts")) bad.push(`${file}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
