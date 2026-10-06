import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./locale-registry";

// 多言語の辞書の監査（scripts/audit-locale-coverage.mjs）を CI でも実行する（CI は tsc・vitest・build だけのため）。
describe("多言語の辞書の監査", () => {
  it("差し込みの不一致・日本語の混入・秘密らしい値・状態の不一致などが無い（--check）", () => {
    const out = execFileSync(process.execPath, ["scripts/audit-locale-coverage.mjs", "--check"], { encoding: "utf8" });
    expect(out).toContain("[audit-locale-coverage] PASS");
  }, 60_000);

  it("状態の記録（docs/i18n/locale-status.json）は registry の全言語を持ち、未レビューの言語を公開しない", () => {
    const status = JSON.parse(readFileSync("docs/i18n/locale-status.json", "utf8")) as { locales: Record<string, { state: string; quality: string; reviewedBy: string | null }> };
    for (const l of LOCALES.filter((x) => !("pseudo" in x))) {
      const s = status.locales[l.code];
      expect(s, l.code).toBeDefined();
      expect(s.state).toBe(l.state);
      if (l.state === "PUBLISHED") {
        expect(["VERIFIED_REVIEWED", "VERIFIED_NATIVE_QUALITY"]).toContain(s.quality);
        expect(s.reviewedBy).not.toBeNull();
      }
    }
  });
});
