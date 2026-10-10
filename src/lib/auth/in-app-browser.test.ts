import { describe, it, expect } from "vitest";
import { detectInAppBrowser, externalBrowserUrl } from "./in-app-browser";

// 実在の形の User-Agent（各アプリ・ブラウザーの公開の例）
const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36",
  iosLine: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0",
  androidLine: "Mozilla/5.0 (Linux; Android 14; SO-51D Build/68.1.A.2.94; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Line/14.9.1/IAB",
  iosX: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.50",
  androidX: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240705.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 TwitterAndroid",
  iosInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 17_5; ja_JP; ja; scale=3.00; 1179x2556; 619461904)",
  iosFacebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/618390233;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/ja_JP;FBOP/80]",
  iosWebView: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  androidWebView: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36",
  desktopChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

describe("アプリ内ブラウザーの検出", () => {
  it("通常のブラウザーはアプリ内ではない（Safari・iOS の Chrome・Android の Chrome・PC）", () => {
    for (const ua of [UA.iosSafari, UA.iosChrome, UA.androidChrome, UA.desktopChrome]) expect(detectInAppBrowser(ua).inApp, ua).toBe(false);
    expect(detectInAppBrowser(null)).toEqual({ inApp: false, app: null, os: "other" });
  });
  it("LINE・X・Instagram・Facebook・一般の WebView を見分ける（OS も）", () => {
    expect(detectInAppBrowser(UA.iosLine)).toEqual({ inApp: true, app: "line", os: "ios" });
    expect(detectInAppBrowser(UA.androidLine)).toEqual({ inApp: true, app: "line", os: "android" });
    expect(detectInAppBrowser(UA.iosX)).toMatchObject({ inApp: true, app: "x" });
    expect(detectInAppBrowser(UA.androidX)).toMatchObject({ inApp: true, app: "x", os: "android" });
    expect(detectInAppBrowser(UA.iosInstagram).app).toBe("instagram");
    expect(detectInAppBrowser(UA.iosFacebook).app).toBe("facebook");
    expect(detectInAppBrowser(UA.iosWebView)).toEqual({ inApp: true, app: "webview", os: "ios" });
    expect(detectInAppBrowser(UA.androidWebView)).toEqual({ inApp: true, app: "webview", os: "android" });
  });
  it("外部のブラウザーで開くリンク: LINE は openExternalBrowser=1・Android は Chrome の intent・iOS のその他は null", () => {
    const url = "https://efootball-team-ai.vercel.app/auth/sign-in?next=%2Faccount";
    expect(externalBrowserUrl(url, detectInAppBrowser(UA.iosLine))).toBe("https://efootball-team-ai.vercel.app/auth/sign-in?next=%2Faccount&openExternalBrowser=1");
    const intent = externalBrowserUrl(url, detectInAppBrowser(UA.androidX)) ?? "";
    expect(intent.startsWith("intent://efootball-team-ai.vercel.app/auth/sign-in?next=%2Faccount#Intent;scheme=https;package=com.android.chrome;")).toBe(true);
    expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent(url)};end`);
    expect(externalBrowserUrl(url, detectInAppBrowser(UA.iosX))).toBeNull();
    expect(externalBrowserUrl("javascript:alert(1)", detectInAppBrowser(UA.iosLine))).toBeNull();
  });
});

import { shareableAuthUrl } from "./in-app-browser";
import { resolveSafeInternalPath } from "@/lib/supabase/safe-redirect";

describe("コピー・外部で開く URL（秘密情報を含めない）", () => {
  const safe = (p: string) => resolveSafeInternalPath(p, "") === p;
  it("origin＋パス＋安全な next だけ。code・error・プレビューのフラグは落とす・callback はログインの画面へ", () => {
    expect(shareableAuthUrl("https://x.app/auth/sign-in?next=%2Fsquads&oauthPreview=1&authError=oauth_failed", safe)).toBe("https://x.app/auth/sign-in?next=%2Fsquads");
    expect(shareableAuthUrl("https://x.app/auth/callback?flow=google&code=SECRET&next=%2Faccount", safe)).toBe("https://x.app/auth/sign-in?next=%2Faccount");
    expect(shareableAuthUrl("https://x.app/auth/sign-in?next=https%3A%2F%2Fevil.example", safe)).toBe("https://x.app/auth/sign-in");
    expect(shareableAuthUrl("javascript:alert(1)", safe)).toBeNull();
  });
});
