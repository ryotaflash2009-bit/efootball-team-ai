import { describe, it, expect } from "vitest";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildRobotsTxt, isSearchIndexingEnabled, robotsMetadataFor, SEARCH_INDEXING_ALLOWED, SITE_ROBOTS_METADATA } from "@/lib/public-info/search-indexing";
import { pageMetadata } from "./page-metadata";
import { SITEMAP_DYNAMIC_ROUTES, SITEMAP_EXCLUDED_ROUTES, SITEMAP_ROUTES } from "./sitemap-routes";
import { PLAYER_GUIDES, publishedPlayerGuides, validatePlayerGuides } from "./player-guides";
import sitemap from "@/app/sitemap";

describe("検索への登録の切り替え（既定は登録しない）", () => {
  it("既定（環境変数なし）は noindex・robots.txt は全体を disallow（今までと同じ）", () => {
    expect(SEARCH_INDEXING_ALLOWED).toBe(false);
    expect(SITE_ROBOTS_METADATA).toEqual({ index: false, follow: false, nocache: true });
    expect(buildRobotsTxt(false)).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });
  it("enabled のときだけ許可・/api/ などは disallow・sitemap を記載", () => {
    expect(isSearchIndexingEnabled("enabled")).toBe(true);
    expect(isSearchIndexingEnabled("true")).toBe(false);
    expect(isSearchIndexingEnabled(undefined)).toBe(false);
    expect(robotsMetadataFor(true)).toEqual({ index: true, follow: true });
    const r = buildRobotsTxt(true, "https://example.test");
    expect(r.sitemap).toBe("https://example.test/sitemap.xml");
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/auth/", "/account/", "/share/"]));
  });
  it("X-Robots-Tag も同じ環境変数で切り替わる（security-headers）", () => {
    const src = readFileSync("src/lib/security/security-headers.mjs", "utf8");
    expect(src).toMatch(/NEXT_PUBLIC_SEARCH_INDEXING === "enabled" \? \[\] : \[\{ key: "X-Robots-Tag"/);
  });
});

describe("画面の metadata", () => {
  it("登録しない間は title・description だけ（canonical・OG は出さない）", () => {
    const m = pageMetadata({ path: "/players", title: "T", description: "D", allowed: false });
    expect(m).toEqual({ title: "T", description: "D" });
  });
  it("登録する場合は canonical・Open Graph・Twitter カード", () => {
    const m = pageMetadata({ path: "/players", title: "T", description: "D", allowed: true });
    expect(m.alternates).toEqual({ canonical: "/players" });
    expect(m.openGraph).toMatchObject({ siteName: "TeamAIXI", locale: "ja_JP", title: "T", description: "D" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });
  it("noindex を指定した画面（下書きの記事）は登録しても canonical・OG を出さない", () => {
    const m = pageMetadata({ path: "/x", title: "T", description: "D", allowed: true, noindex: true });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.openGraph).toBeUndefined();
  });
  it("主な公開の画面に title と description がある", () => {
    for (const r of SITEMAP_ROUTES) {
      const file = r.path === "/" ? "src/app/page.tsx" : `src/app${r.path}/page.tsx`;
      const src = readFileSync(file, "utf8");
      expect(src, file).toMatch(/pageMetadata\(\{[\s\S]*title:[\s\S]*description:/);
    }
  });
});

describe("sitemap", () => {
  it("src/app の全ての画面が、載せる・載せない・動的のどれかに分類されている（新しい画面の載せ忘れを防ぐ）", () => {
    const pages = globSync("src/app/**/page.tsx").map((f) => {
      const rel = path.relative("src/app", path.dirname(f)).split(path.sep).join("/");
      return rel === "" ? "/" : `/${rel}`;
    });
    const listed = new Set([...SITEMAP_ROUTES.map((r) => r.path), ...Object.keys(SITEMAP_EXCLUDED_ROUTES), ...Object.keys(SITEMAP_DYNAMIC_ROUTES)]);
    expect(pages.filter((p) => !listed.has(p))).toEqual([]);
    // 同じ画面を「載せる」と「載せない」の両方に入れない
    expect(SITEMAP_ROUTES.filter((r) => r.path in SITEMAP_EXCLUDED_ROUTES)).toEqual([]);
  });
  it("公開の画面と公開した記事だけ（下書きの記事・個人データの画面は載せない）", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.length).toBe(SITEMAP_ROUTES.length + publishedPlayerGuides().length);
    expect(urls.some((u) => /\/my-team|\/account|\/auth|\/share\//.test(u))).toBe(false);
    for (const g of PLAYER_GUIDES.filter((x) => !x.published)) expect(urls.some((u) => u.endsWith(`/players/guide/${g.slug}`))).toBe(false);
  });
});

describe("選手の解説の記事（データ）", () => {
  it("サンプルは 2 件・下書き（published: false）", () => {
    expect(PLAYER_GUIDES).toHaveLength(2);
    expect(PLAYER_GUIDES.every((g) => g.published === false)).toBe(true);
  });
  it("不正な slug・重複・欠けた項目は読み込みで失敗する", () => {
    const ok = { slug: "a-b", worldCardId: "1", title: "t", description: "d", published: false, updatedAt: "2026-10-08", sections: [{ heading: "h", body: "b" }] };
    expect(validatePlayerGuides({ guides: [ok] })).toHaveLength(1);
    expect(() => validatePlayerGuides({ guides: [{ ...ok, slug: "A B" }] })).toThrow("invalid slug");
    expect(() => validatePlayerGuides({ guides: [ok, ok] })).toThrow("duplicate slug");
    expect(() => validatePlayerGuides({ guides: [{ ...ok, sections: [] }] })).toThrow("sections required");
    expect(() => validatePlayerGuides({})).toThrow("not an array");
  });
});
