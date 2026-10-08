import { describe, expect, it } from "vitest";
import { checkIndexingLive, checkIndexingRepo, decideIndexing, INDEXED_ROUTES, NOINDEX_ROUTES, parseSitemap } from "../../../scripts/lib/search-indexing-release.mjs";

const O = "https://e.test";
const LEGAL = "TeamAIXI は非公式です。KONAMI の公式ではありません。商標は各権利者に帰属します。データには誤りや遅延の可能性があります。";
type Res = { status: number; headers: Record<string, string>; body: string };

function page(path: string, opts: { noindex?: boolean; canonical?: string | null } = {}): Res {
  const robots = opts.noindex ? "noindex, nofollow" : "index, follow";
  const canonical = opts.canonical === undefined ? (path === "/" ? O : `${O}${path.split("?")[0]}`) : opts.canonical;
  const head = [
    `<title>${path} | TeamAIXI</title>`,
    `<meta name="description" content="desc ${path.split("?")[0]}"/>`,
    `<meta name="robots" content="${robots}"/>`,
    canonical && !opts.noindex ? `<link rel="canonical" href="${canonical}"/>` : "",
    opts.noindex ? "" : '<meta property="og:title" content="x"/><meta property="og:description" content="x"/><meta property="og:image" content="x"/><meta property="og:url" content="x"/><meta name="twitter:card" content="summary_large_image"/>',
  ].join("");
  const base = path.split("?")[0];
  const ld = opts.noindex
    ? ""
    : base === "/"
      ? `<script type="application/ld+json">${JSON.stringify({ "@type": "WebSite", name: "TeamAIXI" })}</script>`
      : /^\/(players\/world|managers)\/\d+$/.test(base)
        ? `<script type="application/ld+json">${JSON.stringify({ "@type": "BreadcrumbList", itemListElement: [{ item: `${O}/` }, { item: `${O}${base}` }] })}</script>`
        : "";
  return { status: 200, headers: opts.noindex ? { "x-robots-tag": "noindex, nofollow" } : {}, body: `<html lang="ja"><head>${head}</head><body>${ld}${LEGAL}</body></html>` };
}

const sitemapBody = (urls: string[]) => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
const goodUrls = [...INDEXED_ROUTES.map((r: string) => (r === "/" ? O : `${O}${r}`)), `${O}/players/world/1`, `${O}/players/world/2`, `${O}/managers/5`];

function site(overrides: Record<string, Res> = {}, urls = goodUrls) {
  return async (p: string): Promise<Res> => {
    if (overrides[p]) return overrides[p];
    if (p === "/robots.txt")
      return { status: 200, headers: {}, body: `User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\nDisallow: /account\nDisallow: /share/\nDisallow: /release-readiness\nDisallow: /tier-pack-preview\nDisallow: /community/\n\nSitemap: ${O}/sitemap.xml\n` };
    if (p === "/sitemap.xml") return { status: 200, headers: {}, body: sitemapBody(urls) };
    if (["/account/rls-test", "/release-readiness", "/community/local-posts", "/account/public-id-preview", "/tier-pack-preview", "/community", "/this-page-does-not-exist-teamaixi"].includes(p))
      return { status: 404, headers: {}, body: '<html><meta name="robots" content="noindex"/></html>' };
    if (NOINDEX_ROUTES.includes(p) || p.startsWith("/players/guide/")) return page(p, { noindex: true });
    return page(p);
  };
}

describe("Indexing Release Validator", () => {
  it("公開中で全て矛盾しなければ SEARCH_INDEXING_ENABLED", async () => {
    const live = await checkIndexingLive(site(), { origin: O, draftGuideSlugs: ["draft-a"] });
    expect(live.problems).toEqual([]);
    expect(decideIndexing({ live, repoProblems: [], analytics: true }).verdict).toBe("SEARCH_INDEXING_ENABLED");
  });

  it("noindex のまま矛盾が無ければ SEARCH_INDEXING_READY", async () => {
    const off = site({
      "/robots.txt": { status: 200, headers: {}, body: "User-Agent: *\nDisallow: /\n" },
      "/sitemap.xml": { status: 404, headers: {}, body: "" },
      "/": { status: 200, headers: { "x-robots-tag": "noindex, nofollow, noarchive" }, body: `<html lang="ja"><meta name="robots" content="noindex, nofollow"/>${LEGAL}</html>` },
    });
    const live = await checkIndexingLive(off, { origin: O });
    expect(live.problems).toEqual([]);
    expect(decideIndexing({ live, repoProblems: [], analytics: null }).verdict).toBe("SEARCH_INDEXING_READY");
  });

  it("非公開の画面が index・下書き・共有のリンク・クエリが sitemap に入る・canonical の違い・5xx は BLOCKED", async () => {
    const bad = site(
      { "/my-team": page("/my-team"), "/players": page("/players", { canonical: `${O}/players?page=2` }), "/best-xi": { status: 500, headers: {}, body: "" } },
      [...goodUrls, `${O}/share/diagnosis?d=abc`, `${O}/players/guide/draft-a`, `${O}/players/world/1`],
    );
    const live = await checkIndexingLive(bad, { origin: O, draftGuideSlugs: ["draft-a"] });
    expect(live.problems).toEqual(
      expect.arrayContaining([
        "noindex_route_indexable:/my-team",
        `canonical_mismatch:/players:${O}/players?page=2`,
        "sitemap_duplicate_urls",
        `sitemap_query_or_fragment:${O}/share/diagnosis?d=abc`,
        "sitemap_private_url:/share/diagnosis",
        "sitemap_draft_url:/players/guide/draft-a",
        "http_5xx:/best-xi:500",
      ]),
    );
    expect(decideIndexing({ live, repoProblems: [], analytics: true }).verdict).toBe("SEARCH_INDEXING_BLOCKED");
  });

  it("JSON-LD: ホームの WebSite・詳細のパンくず・壊れた JSON は BLOCKED", async () => {
    const bad = site({
      "/": { ...page("/"), body: page("/").body.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">{broken</script>') },
      "/players/world/1": { ...page("/players/world/1"), body: page("/players/world/1").body.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "") },
    });
    const live = await checkIndexingLive(bad, { origin: O, sampleDetailCount: 3 });
    expect(live.problems).toEqual(expect.arrayContaining(["jsonld_invalid:/", "jsonld_website_missing", "jsonld_breadcrumb_missing:/players/world/1"]));
  });

  it("法務の表示・内部の画面・新規登録の公開を確かめる", async () => {
    const bad = site({ "/": { ...page("/"), body: page("/").body.replace(LEGAL, "") }, "/community": page("/community"), "/auth/sign-up": { ...page("/auth/sign-up", { noindex: true }), body: '<input type="password">' } });
    const live = await checkIndexingLive(bad, { origin: O });
    expect(live.problems).toEqual(expect.arrayContaining(["legal_notice_missing:非公式", "internal_route_reachable:/community:200", "signup_form_exposed"]));
  });

  it("sitemap の XML の形と、リポジトリの確認（Search Console の案内・移行の手順）", () => {
    expect(parseSitemap(sitemapBody([`${O}/a`])).xmlOk).toBe(true);
    expect(parseSitemap("<urlset>").xmlOk).toBe(false);
    expect(checkIndexingRepo({})).toEqual(expect.arrayContaining(["search_console_package_missing", "canonical_migration_doc_missing", "player_guides_missing"]));
    expect(checkIndexingRepo({ searchConsolePackage: "sitemap.xml URL 検査", indexingDoc: "canonical 独自ドメイン", guides: '{"guides":[]}' })).toEqual([]);
    expect(decideIndexing({ live: { problems: [], facts: { state: "enabled" } }, repoProblems: [], analytics: false }).blocked).toContain("analytics_not_loaded");
  });
});
