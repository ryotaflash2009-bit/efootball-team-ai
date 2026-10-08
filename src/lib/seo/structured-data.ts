import { SEARCH_INDEXING_ALLOWED, SITE_URL } from "@/lib/public-info/search-indexing";

/**
 * 構造化データ（JSON-LD・2026-10-09）。検索への登録を許可したときだけ出す（noindex の間は出さない）。
 * 事実だけ: サイト名・URL・パンくず（ホーム > 一覧 > 名前）。評価・価格・レビュー・公式を名乗る項目は出さない。
 */
export type JsonLd = Record<string, unknown>;

export function websiteJsonLd(siteUrl: string = SITE_URL): JsonLd {
  return { "@context": "https://schema.org", "@type": "WebSite", name: "TeamAIXI", url: `${siteUrl}/`, inLanguage: "ja" };
}

export function breadcrumbJsonLd(items: readonly { name: string; path: string }[], siteUrl: string = SITE_URL): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${siteUrl}${it.path === "/" ? "/" : it.path}` })),
  };
}

/** `<script type="application/ld+json">` の中身。`<` を逃がして、文字列から script を閉じられないようにする。 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function structuredDataEnabled(allowed: boolean = SEARCH_INDEXING_ALLOWED): boolean {
  return allowed;
}
