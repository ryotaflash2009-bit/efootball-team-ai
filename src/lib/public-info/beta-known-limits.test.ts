import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ja from "@/lib/i18n/dictionaries/ja-full";
import en from "@/lib/i18n/dictionaries/en";

const SUPPORT_VIEW = readFileSync(path.resolve(__dirname, "..", "..", "components", "public-info", "SupportView.tsx"), "utf8");
const KEYS = [
  "betaLimitsHeading", "betaLimitsIntro", "betaLimitData", "betaLimitStorage", "betaLimitRecommendation", "betaLimitChanges",
  "betaLimitWorldLag", "betaLimitNoPayment", "betaLimitDataDeletion", "betaLimitsFeedback",
] as const;

describe("問い合わせページ: 招待制ベータの追加の既知の制限(Stage 5)", () => {
  it("World データの遅れ・料金なし・公開の約束なし・非公式・削除の導線を、既存の表示名・法務文言と一致させて示す", () => {
    // 2026-10-06: 毎時の検出の後、安全条件を満たす更新だけを反映するため遅れがありうる。
    expect(ja.support.betaLimitWorldLag).toMatch(/安全条件を満たす更新だけ/);
    expect(ja.support.betaLimitWorldLag).toMatch(/遅れている場合があります/);
    expect(en.support.betaLimitWorldLag).toMatch(/pass the safety checks/);
    expect(en.support.betaLimitWorldLag).toMatch(/may lag behind/);
    expect(ja.support.betaLimitNoPayment).toContain(ja.disclaimer.unofficialBody.split("。")[0]);
    expect(en.support.betaLimitNoPayment).toContain(en.disclaimer.unofficialBody.split(". ")[0]);
    expect(ja.support.betaLimitNoPayment).toMatch(/約束するものではありません/);
    expect(ja.support.betaLimitDataDeletion).toContain(`「${ja.dataManagement.heading}」`);
    expect(en.support.betaLimitDataDeletion).toContain(`"${en.dataManagement.heading}"`);
    expect(SUPPORT_VIEW).toContain('href="/data-management"');
  });
});

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

  it("実装の状態と一致させる（自動更新は実装済み・完全同期は未実装）", () => {
    // 2026-10-04: 参照データの自動更新は実装済み（週 1 回の検出）。完全な端末間同期は未実装のまま。
    // 2026-10-04 から 1 時間おきの検出（GitHub の定期実行の欠落で数時間あく場合がある: hourly-detection-observation.md）。
    expect(ja.support.betaLimitData).toMatch(/1 時間おきの自動検出/);
    expect(ja.support.betaLimitData).toMatch(/数時間あく場合があります/);
    expect(en.support.betaLimitData).toMatch(/hourly automatic check/);
    expect(en.support.betaLimitData).toMatch(/gaps of a few hours/);
    expect(`${ja.support.betaLimitData}${en.support.betaLimitData}`).not.toMatch(/週 1 回|weekly/);
    expect(ja.support.betaLimitStorage).toMatch(/完全な自動同期はありません/);
    expect(en.support.betaLimitStorage).toMatch(/not available/);
  });
});
