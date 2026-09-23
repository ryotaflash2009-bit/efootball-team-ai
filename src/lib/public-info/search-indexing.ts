import type { MetadataRoute } from "next";

/**
 * 招待制ベータの間は検索エンジンへ登録させない(robots.txtで全体をdisallow、全ページにnoindex)。
 * 一般公開は別途の本人承認事項であり、その時点でこの値を見直す。
 */
export const SEARCH_INDEXING_ALLOWED = false as const;

export const SITE_ROBOTS_METADATA = Object.freeze({ index: false, follow: false, nocache: true } as const);

export function buildRobotsTxt(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
