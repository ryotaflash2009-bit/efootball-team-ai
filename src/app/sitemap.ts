import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/public-info/search-indexing";
import { SITEMAP_ROUTES } from "@/lib/seo/sitemap-routes";
import { publishedPlayerGuides } from "@/lib/seo/player-guides";

/**
 * /sitemap.xml（2026-10-08）。公開の画面（`SITEMAP_ROUTES`）と、公開にした選手の解説だけを載せる。
 * 検索への登録を許可していない間も生成するが、robots.txt が全体を disallow しているため検索には使われない。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = SITEMAP_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path === "/" ? "" : r.path}` || SITE_URL,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
  const guides: MetadataRoute.Sitemap = publishedPlayerGuides().map((g) => ({
    url: `${SITE_URL}/players/guide/${g.slug}`,
    lastModified: g.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...pages, ...guides];
}
