import { describe, it, expect } from "vitest";
import { ACCOUNT_SIGNUP_MODE, isSignupOpen, resolveAuthRedirectOrigin } from "./account-availability";

describe("アカウント機能の公開状態", () => {
  it("カスタム SMTP の配信確認が終わるまで、新規登録は限定テスト中（既定）", () => {
    expect(ACCOUNT_SIGNUP_MODE).toBe("limited");
    expect(isSignupOpen()).toBe(false);
    expect(isSignupOpen("open")).toBe(true);
  });
});

describe("認証メールの戻り先 origin", () => {
  const here = "https://preview-abc.vercel.app";
  it("設定済みの https origin を使う（プレビュー URL を本番のメールへ混ぜない）", () => {
    expect(resolveAuthRedirectOrigin(here, "https://example.app")).toBe("https://example.app");
    expect(resolveAuthRedirectOrigin(here, "https://example.app/")).toBe("https://example.app");
  });
  it("未設定・http・パスやクエリ付き・資格情報付き・不正な値は使わず、現在の origin", () => {
    for (const bad of [undefined, "", "http://example.app", "https://example.app/x", "https://example.app/?a=1", "https://u:p@example.app", "javascript:alert(1)", "not a url"]) {
      expect(resolveAuthRedirectOrigin(here, bad)).toBe(here);
    }
  });
});
