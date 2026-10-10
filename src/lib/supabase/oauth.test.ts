import { describe, it, expect } from "vitest";
import { buildGoogleRedirectTo, GOOGLE_OAUTH_MODE, isGoogleFlow, isGoogleOAuthAvailable, oauthCallbackFailure } from "./oauth";
import { isLocalDevHostname } from "./local-dev";
import { authErrorMessageKey } from "./email-link";

describe("Google OAuth（2026-10-11 の方針）", () => {
  it("既定は無効（本人の Google Cloud・Supabase の設定とテストの後に PR で有効にする）", () => {
    expect(GOOGLE_OAUTH_MODE).toBe("disabled");
  });
  it("ボタン: 有効なら表示・無効でもローカルの ?oauthPreview=1 だけ表示・本番やプレビューのホストではクエリで開かない", () => {
    expect(isGoogleOAuthAvailable("efootball-team-ai.vercel.app", "", isLocalDevHostname, "enabled")).toBe(true);
    expect(isGoogleOAuthAvailable("efootball-team-ai.vercel.app", "?oauthPreview=1", isLocalDevHostname, "disabled")).toBe(false);
    expect(isGoogleOAuthAvailable("localhost", "?oauthPreview=1", isLocalDevHostname, "disabled")).toBe(true);
    expect(isGoogleOAuthAvailable("localhost", "", isLocalDevHostname, "disabled")).toBe(false);
  });
  it("redirectTo: 自サイトの /auth/callback?flow=google&next=<内部パス>・NEXT_PUBLIC_SITE_URL を優先・外部の next は /account", () => {
    expect(buildGoogleRedirectTo("https://x.vercel.app", "/squads", "https://efootball-team-ai.vercel.app")).toBe(
      "https://efootball-team-ai.vercel.app/auth/callback?flow=google&next=%2Fsquads",
    );
    expect(buildGoogleRedirectTo("http://localhost:3000", "//evil.example", undefined)).toBe("http://localhost:3000/auth/callback?flow=google&next=%2Faccount");
    expect(buildGoogleRedirectTo("http://localhost:3000", null, "javascript:alert(1)")).toBe("http://localhost:3000/auth/callback?flow=google&next=%2Faccount");
  });
  it("失敗の理由: flow=google のときだけ判定（キャンセル・一時的な障害・その他）", () => {
    expect(oauthCallbackFailure("?flow=google&error=access_denied")).toBe("oauth_cancelled");
    expect(oauthCallbackFailure("?flow=google&error=server_error")).toBe("unavailable");
    expect(oauthCallbackFailure("?flow=google&error=invalid_scope")).toBe("oauth_failed");
    expect(oauthCallbackFailure("?flow=google&code=abc")).toBeNull();
    expect(oauthCallbackFailure("?error=access_denied")).toBeNull();
    expect(isGoogleFlow("?flow=google")).toBe(true);
    expect(isGoogleFlow("?flow=email")).toBe(false);
  });
  it("表示の文言のキー（日本語・英語の辞書にある）", () => {
    expect(authErrorMessageKey("oauth_cancelled")).toBe("authErrorOAuthCancelled");
    expect(authErrorMessageKey("oauth_failed")).toBe("authErrorOAuthFailed");
  });
});

import { googleProviderStatusFromSettings } from "./oauth";

describe("Google の Provider の状態（緊急停止の検出）", () => {
  it("Supabase の公開の設定の external.google が true / false / それ以外", () => {
    expect(googleProviderStatusFromSettings({ external: { google: true, email: true } })).toBe("enabled");
    expect(googleProviderStatusFromSettings({ external: { google: false } })).toBe("disabled");
    expect(googleProviderStatusFromSettings({ external: {} })).toBe("unknown");
    expect(googleProviderStatusFromSettings(null)).toBe("unknown");
  });
});
