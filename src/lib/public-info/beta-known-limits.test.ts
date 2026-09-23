import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ja from "@/lib/i18n/dictionaries/ja";
import en from "@/lib/i18n/dictionaries/en";

const SUPPORT_VIEW = readFileSync(path.resolve(__dirname, "..", "..", "components", "public-info", "SupportView.tsx"), "utf8");
const KEYS = ["betaLimitsHeading", "betaLimitsIntro", "betaLimitData", "betaLimitStorage", "betaLimitRecommendation", "betaLimitChanges", "betaLimitsFeedback"] as const;

describe("問い合わせページ: ベータ版の既知の制限", () => {
  it("日英とも全項目があり、ページに表示される", () => {
    for (const k of KEYS) {
      expect(ja.support[k], k).toBeTruthy();
      expect(en.support[k], k).toBeTruthy();
      expect(SUPPORT_VIEW).toContain(`ts("${k}")`);
    }
  });

  it("本文が参照する画面上の表示名が、実際のUI文言と一致する", () => {
    expect(ja.support.betaLimitData).toContain(`「${ja.playersPage.importedAtPrefix.replace(/[:：]\s*$/, "")}」`);
    expect(ja.support.betaLimitData).toContain("「取得日時」");
    expect(ja.support.betaLimitsFeedback).toContain(`「${ja.support.bugReportHeading}」`);
    expect(en.support.betaLimitData).toContain(`"${en.playersPage.importedAtPrefix.replace(/[:：]\s*$/, "")}"`);
    expect(en.support.betaLimitsFeedback).toContain(`"${en.support.bugReportHeading}"`);
  });

  it("未実装の機能を実装済みと書かない(自動更新・完全同期)", () => {
    expect(ja.support.betaLimitData).toMatch(/手動で取り込んで/);
    expect(ja.support.betaLimitStorage).toMatch(/完全な自動同期はありません/);
    expect(en.support.betaLimitStorage).toMatch(/not available/);
  });
});
