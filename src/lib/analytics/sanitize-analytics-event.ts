import { isInternalPagePath } from "@/lib/public-info/internal-pages";

/**
 * Vercel Web Analytics へ送る前の URL の整理（2026-10-07・Page Views と Visitors だけ・Custom Event なし）。
 *
 * - query（`?`）と fragment（`#`）は必ず落とす。共有の payload・token・認証の code・reset の link・検索語を送らない。
 * - 送らない画面: 認証（/auth/*）・アカウント（/account*）・API・内部ページ（internal-pages.ts）・非公開ページの置き換え先。
 * - 利用者が作った ID を含むパス（/squads/sq_…）は、ID を `[id]` に置き換える（どのスカッドかを送らない）。
 * - 自動のブラウザー（`navigator.webdriver`・User-Agent の HeadlessChrome / Lighthouse: このリポジトリの black-box・本番の読み取りの確認・
 *   性能の計測）・トラッキングの拒否（Do Not Track・Global Privacy Control）・オプトアウトの印のある端末からは送らない。
 * Cookie は使わない（Vercel Web Analytics 自体も Cookie を使わない）。
 */
export const ANALYTICS_OPT_OUT_STORAGE_KEY = "efootball-team-ai:analytics-opt-out:v1";

const EXCLUDED_PREFIXES = ["/auth", "/account", "/api"] as const;

/** 送ってよいパスへ整える。送らない場合は null。 */
export function sanitizeAnalyticsPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return null;
  if (path.startsWith("/__")) return null; // 非公開ページの置き換え先（/__internal-page-not-available 等）
  if (isInternalPagePath(path)) return null;
  // 利用者が作ったスカッドの ID（端末の中だけの ID）は送らない
  if (/^\/squads\/(?!compare$|templates$)[^/]+/.test(path)) return path.replace(/^\/squads\/[^/]+/, "/squads/[id]");
  return path;
}

/** Analytics の URL（絶対 URL）を整える。送らない場合は null。 */
export function sanitizeAnalyticsUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const path = sanitizeAnalyticsPath(u.pathname);
  if (path === null) return null;
  return `${u.origin}${path}`;
}

export interface AnalyticsEnv {
  webdriver?: boolean;
  optedOut?: boolean;
  userAgent?: string;
  /** ブラウザーのトラッキングの拒否（Do Not Track・Global Privacy Control） */
  doNotTrack?: boolean;
}

/** 自動のブラウザー（headless・計測ツール）の User-Agent。 */
const AUTOMATION_UA = /HeadlessChrome|Chrome-Lighthouse|Lighthouse|PTST|Playwright|Puppeteer/i;

/** `beforeSend` の本体（テストしやすいよう環境を引数で受ける）。 */
export function sanitizeAnalyticsEvent<E extends { url: string }>(event: E, env: AnalyticsEnv = {}): E | null {
  if (env.webdriver || env.optedOut || env.doNotTrack || AUTOMATION_UA.test(env.userAgent ?? "")) return null;
  const url = sanitizeAnalyticsUrl(event.url);
  return url === null ? null : { ...event, url };
}

/** ブラウザーの環境を読む（失敗しても計測を止めるだけ・例外を出さない）。 */
export function readAnalyticsEnv(): AnalyticsEnv {
  if (typeof window === "undefined") return { webdriver: true };
  let optedOut = false;
  try {
    optedOut = window.localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY) === "1";
  } catch {
    optedOut = false;
  }
  const nav = window.navigator as Navigator & { globalPrivacyControl?: boolean };
  const doNotTrack = nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
  return { webdriver: nav.webdriver === true, optedOut, userAgent: nav.userAgent, doNotTrack };
}
