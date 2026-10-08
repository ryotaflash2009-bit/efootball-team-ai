import { SEARCH_INDEXING_ALLOWED, SITE_URL } from "@/lib/public-info/search-indexing";
import { SITEMAP_ROUTES } from "./sitemap-routes";
import { publishedPlayerGuides } from "./player-guides";

/**
 * sitemap.xml の項目（2026-10-08）。公開の画面（`SITEMAP_ROUTES`）と、公開にした選手の解説だけ。
 * 検索への登録を許可していない間は配信しない（/sitemap.xml は 404。v1 の公開の契約「noindex の間は sitemap を出さない」）。
 */
export interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency: string;
  priority: number;
}

export function sitemapEntries(siteUrl: string = SITE_URL): SitemapEntry[] {
  const pages = SITEMAP_ROUTES.map((r) => ({ url: `${siteUrl}${r.path === "/" ? "" : r.path}` || siteUrl, changeFrequency: r.changeFrequency, priority: r.priority }));
  const guides = publishedPlayerGuides().map((g) => ({ url: `${siteUrl}/players/guide/${g.slug}`, lastModified: g.updatedAt, changeFrequency: "monthly", priority: 0.6 }));
  return [...pages, ...guides];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sitemapXml(entries: readonly SitemapEntry[]): string {
  const items = entries
    .map(
      (e) =>
        `<url><loc>${esc(e.url)}</loc>${e.lastModified ? `<lastmod>${esc(e.lastModified)}</lastmod>` : ""}<changefreq>${e.changeFrequency}</changefreq><priority>${e.priority}</priority></url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}

export function sitemapResponseFor(allowed: boolean = SEARCH_INDEXING_ALLOWED): { status: 200 | 404; body: string } {
  if (!allowed) return { status: 404, body: "Not Found" };
  return { status: 200, body: sitemapXml(sitemapEntries()) };
}
