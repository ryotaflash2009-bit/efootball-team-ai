import { unstable_cache } from "next/cache";
import { sitemapResponseFor } from "@/lib/seo/sitemap";
import { listAllWorldCardIds } from "@/lib/world/repository";
import { listAllManagerIds } from "@/lib/managers/repository";

/**
 * /sitemap.xml（2026-10-08・2026-10-09 に選手・監督の詳細を追加）。検索への登録を許可していない間は 404。
 * ID の一覧は 1 時間ごとに作り直す（データの更新は毎時の検知・World の反映に合わせる）。
 */
export const revalidate = 3600;

const loadIds = unstable_cache(
  async () => ({ worldCardIds: await listAllWorldCardIds(), managerIds: await listAllManagerIds() }),
  ["seo:sitemap-ids:v1"],
  { revalidate: 3600 },
);

export async function GET() {
  const r = await sitemapResponseFor(undefined, loadIds);
  return new Response(r.body, {
    status: r.status,
    headers: { "Content-Type": r.status === 200 ? "application/xml; charset=utf-8" : "text/plain; charset=utf-8" },
  });
}
