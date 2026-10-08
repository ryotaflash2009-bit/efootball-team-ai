import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isCanonicalHost, noindexReasonForPath, xRobotsTagFor } from "@/lib/public-info/search-indexing";
import { sitemapEntries, sitemapResponseFor } from "./sitemap";
import { SITEMAP_ROUTES } from "./sitemap-routes";
import { PLAYER_GUIDES } from "./player-guides";

/** 検索の公開（2026-10-09 本人の正式決定）: 公開する画面と、個別に noindex にする画面の契約。 */
describe("検索に出す画面・出さない画面", () => {
  it.each([
    "/", "/players", "/players/world/89136409091415", "/managers", "/managers/12", "/compare", "/squads", "/squads/templates", "/squads/compare",
    "/best-xi", "/boosters", "/managers/compare", "/about", "/support", "/terms", "/privacy", "/disclaimer",
  ])("%s は検索に出してよい", (p) => {
    expect(noindexReasonForPath(p)).toBeNull();
  });

  it.each([
    ["/api/players", "api"], ["/auth/sign-in", "auth"], ["/auth/update-password", "auth"], ["/auth/confirm", "auth"], ["/account", "account"],
    ["/account/public-id-preview", "account"], ["/share/diagnosis", "share-link"], ["/share/compare", "share-link"], ["/community/local-posts", "community"],
    ["/my-team", "user-local"], ["/my-builds", "user-local"], ["/favorites", "user-local"], ["/build-inventory", "user-local"],
    ["/diagnosis-history", "user-local"], ["/data-management", "user-local"], ["/release-readiness", "internal"], ["/tier-pack-preview", "internal"],
    ["/squads/abc123", "user-squad"], ["/players/123", "legacy-player-page"], ["/players/world", "non-canonical"],
  ])("%s は noindex（%s）", (p, reason) => {
    expect(noindexReasonForPath(p)).toBe(reason);
  });

  it("下書きの記事（published: false）は noindex・公開した記事だけ出す", () => {
    for (const g of PLAYER_GUIDES) expect(noindexReasonForPath(`/players/guide/${g.slug}`) === null).toBe(g.published);
    expect(noindexReasonForPath("/players/guide/x", new Set(["x"]))).toBe("draft-guide");
    expect(noindexReasonForPath("/players/guide/y", new Set(["x"]))).toBeNull();
  });

  it("正式な URL 以外のホスト（デプロイごとの URL・Preview）は noindex", () => {
    expect(isCanonicalHost("efootball-team-ai.vercel.app", "https://efootball-team-ai.vercel.app")).toBe(true);
    expect(isCanonicalHost("efootball-team-ai-abc123-team.vercel.app", "https://efootball-team-ai.vercel.app")).toBe(false);
    expect(isCanonicalHost("localhost:3000")).toBe(true);
    expect(isCanonicalHost(null)).toBe(false);
    expect(xRobotsTagFor({ allowed: true, pathname: "/", host: "evil.example" })).toBe("noindex, nofollow");
    expect(xRobotsTagFor({ allowed: true, pathname: "/my-team", host: "localhost:3000" })).toBe("noindex, nofollow");
    expect(xRobotsTagFor({ allowed: true, pathname: "/players", host: "localhost:3000" })).toBeNull();
    expect(xRobotsTagFor({ allowed: false, pathname: "/players", host: "localhost:3000" })).toBeNull();
  });

  it("非公開の画面のページは meta robots でも noindex（個別）", () => {
    const pages = ["account", "auth/confirm", "auth/forgot-password", "auth/sign-in", "auth/sign-up", "auth/update-password", "build-inventory",
      "data-management", "diagnosis-history", "favorites", "my-builds", "my-team", "players/[id]", "squads/[squadId]"];
    for (const p of pages) expect(readFileSync(`src/app/${p}/page.tsx`, "utf8"), p).toMatch(/robots: PRIVATE_PAGE_ROBOTS/);
    for (const p of ["share/diagnosis", "share/compare", "account/my-team-cloud", "account/local-data-migration", "community/local-posts"]) {
      expect(readFileSync(`src/app/${p}/page.tsx`, "utf8"), p).toMatch(/robots: \{ index: false/);
    }
  });

  it("src/app の全ての画面が「出す」か「出さない」のどちらかに分類されている", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f === "page.tsx" ? [d] : []));
    const routes = walk("src/app").map((d) => d.replace(/\\/g, "/").replace(/^src\/app/, "") || "/");
    const sample = (r: string) => r.replace("[worldCardId]", "1").replace("[managerId]", "1").replace("[squadId]", "s1").replace("[id]", "1").replace("[slug]", "draft-x");
    const sitemapPaths = new Set(SITEMAP_ROUTES.map((r) => r.path));
    for (const r of routes) {
      const indexable = noindexReasonForPath(sample(r), new Set(["draft-x"])) === null;
      if (sitemapPaths.has(r)) expect(indexable, r).toBe(true);
    }
  });
});

describe("sitemap（公開中）", () => {
  const ids = { worldCardIds: ["89136409091415", "89136409091415", "1?x=1", "abc"], managerIds: ["12", "12", "a/b"] };
  it("固定の画面・選手と監督の詳細を正式な URL で載せ、重複・クエリ・不正な ID・非公開の画面を入れない", () => {
    const e = sitemapEntries("https://example.test", ids);
    const urls = e.map((x) => x.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("https://example.test/players/world/89136409091415");
    expect(urls).toContain("https://example.test/managers/12");
    expect(urls.filter((u) => u.includes("/players/world/"))).toHaveLength(1);
    expect(urls.filter((u) => u.includes("/managers/") && !u.endsWith("/compare") && u !== "https://example.test/managers")).toHaveLength(1);
    for (const u of urls) {
      expect(u.startsWith("https://example.test")).toBe(true);
      expect(u).not.toMatch(/[?#]/);
      expect(noindexReasonForPath(new URL(u).pathname), u).toBeNull();
    }
  });
  it("ID の読み込みに失敗しても 5xx にせず固定の画面だけ出す", async () => {
    const r = await sitemapResponseFor(true, async () => {
      throw new Error("down");
    });
    expect(r.status).toBe(200);
    expect(r.urlCount).toBe(SITEMAP_ROUTES.length + PLAYER_GUIDES.filter((g) => g.published).length);
  });
});
