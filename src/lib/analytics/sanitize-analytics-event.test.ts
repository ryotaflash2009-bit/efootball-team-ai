import { describe, expect, it } from "vitest";
import { sanitizeAnalyticsEvent, sanitizeAnalyticsPath, sanitizeAnalyticsUrl } from "./sanitize-analytics-event";

const O = "https://efootball-team-ai.vercel.app";

describe("Vercel Web Analytics へ送る URL の整理", () => {
  it("公開ページはパスだけ（query・fragment を落とす）", () => {
    expect(sanitizeAnalyticsUrl(`${O}/players?q=messi&page=2`)).toBe(`${O}/players`);
    expect(sanitizeAnalyticsUrl(`${O}/compare?ids=1,2#section`)).toBe(`${O}/compare`);
    expect(sanitizeAnalyticsUrl(`${O}/`)).toBe(`${O}/`);
    expect(sanitizeAnalyticsUrl(`${O}/players/world/89138556575063?tab=progression`)).toBe(`${O}/players/world/89138556575063`);
  });

  it("共有の payload（fragment）・token を送らない", () => {
    expect(sanitizeAnalyticsUrl(`${O}/share/diagnosis#v=1&d=eyJzZWNyZXQiOjF9`)).toBe(`${O}/share/diagnosis`);
    expect(sanitizeAnalyticsUrl(`${O}/share/compare?token=abc#payload`)).toBe(`${O}/share/compare`);
  });

  it("認証・アカウント・API・内部ページは送らない", () => {
    for (const p of ["/auth/callback?code=xyz", "/auth/update-password#access_token=t", "/auth/sign-in", "/auth/forgot-password", "/account", "/account/my-team-cloud", "/api/players", "/release-readiness", "/tier-pack-preview", "/community/local-posts", "/account/public-id-preview", "/__internal-page-not-available"]) {
      expect(sanitizeAnalyticsUrl(`${O}${p}`), p).toBeNull();
    }
  });

  it("利用者が作ったスカッドの ID を送らない", () => {
    expect(sanitizeAnalyticsPath("/squads/sq_8f3a2c")).toBe("/squads/[id]");
    expect(sanitizeAnalyticsPath("/squads/sq_8f3a2c/")).toBe("/squads/[id]");
    expect(sanitizeAnalyticsPath("/squads/compare")).toBe("/squads/compare");
    expect(sanitizeAnalyticsPath("/squads/templates")).toBe("/squads/templates");
    expect(sanitizeAnalyticsPath("/squads")).toBe("/squads");
  });

  it("壊れた URL・http(s) 以外は送らない", () => {
    expect(sanitizeAnalyticsUrl("not a url")).toBeNull();
    expect(sanitizeAnalyticsUrl("javascript:alert(1)")).toBeNull();
  });

  it("自動のブラウザー・オプトアウトの端末からは送らない", () => {
    const ev = { type: "pageview" as const, url: `${O}/players` };
    expect(sanitizeAnalyticsEvent(ev, { webdriver: true })).toBeNull();
    expect(sanitizeAnalyticsEvent(ev, { optedOut: true })).toBeNull();
    expect(sanitizeAnalyticsEvent(ev, { doNotTrack: true })).toBeNull();
    expect(sanitizeAnalyticsEvent(ev, { userAgent: "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 HeadlessChrome/154.0.0.0 Safari/537.36" })).toBeNull();
    expect(sanitizeAnalyticsEvent(ev, { userAgent: "Mozilla/5.0 Chrome-Lighthouse" })).toBeNull();
    expect(sanitizeAnalyticsEvent(ev, { userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1" })).toEqual(ev);
    expect(sanitizeAnalyticsEvent({ ...ev, url: `${O}/players?q=x` }, {})).toEqual({ type: "pageview", url: `${O}/players` });
  });
});
