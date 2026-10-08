import type { MetadataRoute } from "next";

/**
 * 検索エンジンへの登録（2026-10-08 に切り替えの仕組みを追加）。
 *
 * - 既定は **登録しない**（招待制ベータからの方針・本人の判断 2026-10-08「SEO の準備をして noindex は維持」）。
 *   robots.txt は全体を disallow、全ページ noindex、全応答に X-Robots-Tag: noindex（security-headers.mjs）。
 * - 本人が公開を決めたら、Vercel の環境変数 `NEXT_PUBLIC_SEARCH_INDEXING=enabled` を設定して再デプロイする。この 1 つで
 *   robots.txt・meta robots・X-Robots-Tag・canonical・Open Graph・Twitter カードがまとめて切り替わる（コードの変更は不要）。
 * - 公開に切り替えても、API（/api/）・認証（/auth/）・アカウント（/account/）・共有のリンク（/share/）は登録しない。
 */
export function isSearchIndexingEnabled(value: string | undefined = process.env.NEXT_PUBLIC_SEARCH_INDEXING): boolean {
  return value === "enabled";
}

export const SEARCH_INDEXING_ALLOWED: boolean = isSearchIndexingEnabled();

/** 正式な URL（canonical・sitemap・Open Graph の基準）。独自ドメインへ移ったら `NEXT_PUBLIC_SITE_URL` で変える。 */
export const SITE_URL: string = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://efootball-team-ai.vercel.app").replace(/\/+$/, "");

/** 公開に切り替えても検索に出さない経路（robots.txt の disallow）。 */
export const NEVER_INDEXED_PATH_PREFIXES: readonly string[] = ["/api/", "/auth/", "/account/", "/share/"];

export function robotsMetadataFor(allowed: boolean) {
  return allowed ? ({ index: true, follow: true } as const) : ({ index: false, follow: false, nocache: true } as const);
}

export const SITE_ROBOTS_METADATA = Object.freeze(robotsMetadataFor(SEARCH_INDEXING_ALLOWED));

export function buildRobotsTxt(allowed: boolean = SEARCH_INDEXING_ALLOWED, siteUrl: string = SITE_URL): MetadataRoute.Robots {
  if (!allowed) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...NEVER_INDEXED_PATH_PREFIXES] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
