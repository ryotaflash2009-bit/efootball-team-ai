import { sitemapResponseFor } from "@/lib/seo/sitemap";

/** /sitemap.xml（2026-10-08）。検索への登録を許可していない間は 404（noindex の間は sitemap を出さない）。 */
export const dynamic = "force-static";

export function GET() {
  const r = sitemapResponseFor();
  return new Response(r.body, {
    status: r.status,
    headers: { "Content-Type": r.status === 200 ? "application/xml; charset=utf-8" : "text/plain; charset=utf-8" },
  });
}
