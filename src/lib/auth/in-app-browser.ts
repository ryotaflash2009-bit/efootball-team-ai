/**
 * アプリ内ブラウザー（WebView）の検出と、Safari / Chrome で開く案内（2026-10-11）。
 *
 * Google は WebView（埋め込みのブラウザー）での OAuth を拒否する（エラー `disallowed_useragent`・Google の方針）。
 * LINE・X・Instagram などのアプリの中でリンクを開いた人には、Google のボタンを押す前に「Safari / Chrome で開いてください」と案内する。
 *
 * - 判定は User-Agent の文字列だけ（推測）。外れても害が小さい側に倒す: 判定できないときは「通常のブラウザー」として扱い、
 *   Google の失敗の文（authErrorOAuthFailed）とログインの画面の「うまくいかないときは」の案内で補う。
 * - 外部のブラウザーで開くリンク:
 *   - LINE: URL に `openExternalBrowser=1` を付けると LINE が既定のブラウザーで開く（LINE の公式の機能）。
 *   - Android: `intent://…#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=…;end` で Chrome を開く。
 *   - iOS のその他のアプリ: 自動で開く方法が無いため、メニュー（「…」・共有）→「Safari で開く」の手順と URL のコピー。
 */
export type InAppApp = "line" | "x" | "instagram" | "facebook" | "tiktok" | "wechat" | "kakaotalk" | "webview";
export type MobileOs = "ios" | "android" | "other";

export interface InAppBrowserInfo {
  inApp: boolean;
  app: InAppApp | null;
  os: MobileOs;
}

const APP_PATTERNS: [InAppApp, RegExp][] = [
  ["line", /\bLine\/\d/i],
  ["x", /\bTwitter(?:Android)?\b|\bTwitter for iP(?:hone|ad)\b/i],
  ["instagram", /\bInstagram\b/i],
  ["facebook", /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\[FB/i],
  ["tiktok", /\bmusical_ly\b|\bBytedanceWebview\b|\bTikTok\b/i],
  ["wechat", /\bMicroMessenger\//i],
  ["kakaotalk", /\bKAKAOTALK\b/i],
];

export function osOf(ua: string): MobileOs {
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return "ios";
  if (/\bAndroid\b/.test(ua)) return "android";
  return "other";
}

export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowserInfo {
  const ua = String(userAgent ?? "");
  const os = osOf(ua);
  for (const [app, re] of APP_PATTERNS) if (re.test(ua)) return { inApp: true, app, os };
  // Android の WebView は "; wv)" を含む（Chrome 本体は含まない）。
  if (os === "android" && /;\s*wv\)/.test(ua)) return { inApp: true, app: "webview", os };
  // iOS の WKWebView は "Safari/" を含まない（Safari・iOS の Chrome（CriOS）・Firefox（FxiOS）・Edge（EdgiOS）は含む）。
  if (os === "ios" && /AppleWebKit\//.test(ua) && !/Safari\//.test(ua) && !/\b(CriOS|FxiOS|EdgiOS|OPiOS)\//.test(ua)) {
    return { inApp: true, app: "webview", os };
  }
  return { inApp: false, app: null, os };
}

/** 外部のブラウザーで開くリンク（自動で開ける場合だけ）。開けない場合は null（手順の案内とコピーで対応）。 */
export function externalBrowserUrl(currentUrl: string, info: InAppBrowserInfo): string | null {
  let u: URL;
  try {
    u = new URL(currentUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (info.app === "line") {
    u.searchParams.set("openExternalBrowser", "1");
    return u.toString();
  }
  if (info.os === "android" && info.inApp) {
    const fallback = encodeURIComponent(u.toString());
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  }
  return null;
}
