import { SEARCH_INDEXING_ALLOWED, SITE_URL } from "@/lib/public-info/search-indexing";
import { SITEMAP_ROUTES } from "./sitemap-routes";
import { publishedPlayerGuides } from "./player-guides";

/**
 * sitemap.xml の項目（2026-10-08・2026-10-09 に選手・監督の詳細を追加）。公開の画面（`SITEMAP_ROUTES`）・公開にした選手の解説・選手と監督の詳細。
 * 検索への登録を許可していない間は配信しない（/sitemap.xml は 404。v1 の公開の契約「noindex の間は sitemap を出さない」）。
 */
export interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency: string;
  priority: number;
}

/** 選手・監督の詳細の ID（2026-10-09 本人の正式決定で sitemap へ入れる）。 */
export interface SitemapDynamicIds {
  worldCardIds: readonly string[];
  managerIds: readonly string[];
}

const WORLD_ID_RE = /^[0-9]{1,20}$/;
const MANAGER_ID_SAFE_RE = /^[0-9]{1,12}$/;

export function sitemapEntries(siteUrl: string = SITE_URL, ids: SitemapDynamicIds = { worldCardIds: [], managerIds: [] }): SitemapEntry[] {
  const pages = SITEMAP_ROUTES.map((r) => ({ url: `${siteUrl}${r.path === "/" ? "" : r.path}` || siteUrl, changeFrequency: r.changeFrequency, priority: r.priority }));
  const guides = publishedPlayerGuides().map((g) => ({ url: `${siteUrl}/players/guide/${g.slug}`, lastModified: g.updatedAt, changeFrequency: "monthly", priority: 0.6 }));
  // ID は数字だけ（共有のリンク・利用者の ID・クエリは入れない）。重複は除く。
  const players = [...new Set(ids.worldCardIds)].filter((id) => WORLD_ID_RE.test(id)).map((id) => ({ url: `${siteUrl}/players/world/${id}`, changeFrequency: "weekly", priority: 0.5 }));
  const managers = [...new Set(ids.managerIds)].filter((id) => MANAGER_ID_SAFE_RE.test(id)).map((id) => ({ url: `${siteUrl}/managers/${id}`, changeFrequency: "weekly", priority: 0.5 }));
  return [...pages, ...guides, ...managers, ...players];
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

/** 1 つの sitemap の上限（sitemaps.org: 50,000 URL）。超えたら分割が必要なので失敗させる。 */
export const SITEMAP_URL_LIMIT = 50_000;

export async function sitemapResponseFor(
  allowed: boolean = SEARCH_INDEXING_ALLOWED,
  loadIds: () => Promise<SitemapDynamicIds> = async () => ({ worldCardIds: [], managerIds: [] }),
): Promise<{ status: 200 | 404; body: string; urlCount: number }> {
  if (!allowed) return { status: 404, body: "Not Found", urlCount: 0 };
  let ids: SitemapDynamicIds = { worldCardIds: [], managerIds: [] };
  try {
    ids = await loadIds();
  } catch {
    // データ元に届かないときは固定の画面だけを出す（sitemap を 5xx にしない）。
  }
  const entries = sitemapEntries(SITE_URL, ids).slice(0, SITEMAP_URL_LIMIT);
  return { status: 200, body: sitemapXml(entries), urlCount: entries.length };
}
