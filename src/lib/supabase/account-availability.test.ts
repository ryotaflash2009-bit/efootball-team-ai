import { describe, it, expect } from "vitest";
import {
  ACCOUNT_SIGNUP_MODE,
  AUTH_EMAIL_DELIVERY,
  isEmailDeliveryVerified,
  isSignupOpen,
  isSignupPreviewAllowed,
  resolveAuthRedirectOrigin,
} from "./account-availability";
import { isLocalDevHostname } from "./local-dev";

describe("アカウント機能の公開状態（2つの Gate・fail closed）", () => {
  it("既定: メール配信は標準（メンバー宛てのみ）、新規登録は限定テスト中", () => {
    expect(AUTH_EMAIL_DELIVERY).toBe("builtin_members_only");
    expect(ACCOUNT_SIGNUP_MODE).toBe("limited");
    expect(isEmailDeliveryVerified()).toBe(false);
    expect(isSignupOpen()).toBe(false);
  });

  it("新規登録が開くのは、公開判断（open）と配信確認（custom_smtp_verified）の両方がそろったときだけ", () => {
    expect(isSignupOpen("open", "custom_smtp_verified")).toBe(true);
    expect(isSignupOpen("open", "builtin_members_only")).toBe(false); // SMTP 未確認では開かない
    expect(isSignupOpen("limited", "custom_smtp_verified")).toBe(false); // SMTP を有効にしただけでは開かない
    expect(isSignupOpen("limited", "builtin_members_only")).toBe(false);
  });
});

describe("登録フォームのローカル確認用プレビュー", () => {
  it("ローカル開発ホストでだけ、?signupPreview=1 で許可される", () => {
    expect(isSignupPreviewAllowed("localhost", "?signupPreview=1", isLocalDevHostname)).toBe(true);
    expect(isSignupPreviewAllowed("127.0.0.1", "?signupPreview=1", isLocalDevHostname)).toBe(true);
    expect(isSignupPreviewAllowed("localhost", "", isLocalDevHostname)).toBe(false);
    expect(isSignupPreviewAllowed("localhost", "?signupPreview=true", isLocalDevHostname)).toBe(false);
  });

  it("本番・プレビューのホストでは、クエリだけでは決して開かない", () => {
    for (const h of ["efootball-team-ai.vercel.app", "efootball-team-abc-ryotaflash2009-bit.vercel.app", "teamaixi.com", "localhost.evil.example", "example.com"]) {
      expect(isSignupPreviewAllowed(h, "?signupPreview=1", isLocalDevHostname), h).toBe(false);
    }
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
