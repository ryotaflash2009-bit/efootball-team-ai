import type { MetadataRoute } from "next";
import guideData from "@/content/player-guides.json";

/**
 * 検索エンジンへの登録（2026-10-08 に切り替えの仕組みを追加）。
 *
 * - 既定は **登録しない**（招待制ベータからの方針・本人の判断 2026-10-08「SEO の準備をして noindex は維持」）。
 *   robots.txt は全体を disallow、全ページ noindex、全応答に X-Robots-Tag: noindex（security-headers.mjs）。
 * - 本人が公開を決めたら、Vercel の環境変数 `NEXT_PUBLIC_SEARCH_INDEXING=enabled` を設定して再デプロイする。この 1 つで
 *   robots.txt・meta robots・X-Robots-Tag・canonical・Open Graph・Twitter カードがまとめて切り替わる（コードの変更は不要）。
 * - 公開に切り替えても、API（/api/）・認証（/auth/）・アカウント（/account/）・共有のリンク（/share/）は登録しない。
 * - 2026-10-09 本人の正式決定で公開へ。非公開・端末だけ・内部・下書きの画面は `noindexReasonForPath` で個別に noindex
 *   （meta robots と X-Robots-Tag の両方。middleware.ts）。正式な URL 以外のホスト（デプロイごとの *.vercel.app）も noindex。
 */
export function isSearchIndexingEnabled(value: string | undefined = process.env.NEXT_PUBLIC_SEARCH_INDEXING): boolean {
  return value === "enabled";
}

export const SEARCH_INDEXING_ALLOWED: boolean = isSearchIndexingEnabled();

/** 正式な URL（canonical・sitemap・Open Graph の基準）。独自ドメインへ移ったら `NEXT_PUBLIC_SITE_URL` で変える。 */
export const SITE_URL: string = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://efootball-team-ai.vercel.app").replace(/\/+$/, "");

/** 公開に切り替えても検索に出さない経路（robots.txt の disallow）。 */
export const NEVER_INDEXED_PATH_PREFIXES: readonly string[] = ["/api/", "/auth/", "/account/", "/share/"];

/** 内部の確認の画面（本番は 404）。robots.txt でも disallow する。 */
export const INTERNAL_ONLY_PATH_PREFIXES: readonly string[] = ["/release-readiness", "/tier-pack-preview", "/community/"];

/** 非公開の画面の meta robots（個別の noindex）。 */
export const PRIVATE_PAGE_ROBOTS = Object.freeze({ index: false, follow: false } as const);

/** 個別に noindex にする画面（経路の先頭の区切りで一致）。理由つき。 */
const NOINDEX_SEGMENTS: Readonly<Record<string, string>> = {
  "/api": "api",
  "/auth": "auth",
  "/account": "account",
  "/share": "share-link",
  "/community": "community",
  "/my-team": "user-local",
  "/my-builds": "user-local",
  "/favorites": "user-local",
  "/build-inventory": "user-local",
  "/diagnosis-history": "user-local",
  "/data-management": "user-local",
  "/release-readiness": "internal",
  "/tier-pack-preview": "internal",
};
const PUBLIC_SQUAD_SUBPATHS = new Set(["templates", "compare"]);
const DRAFT_GUIDE_SLUGS: ReadonlySet<string> = new Set(
  ((guideData as { guides?: { slug?: unknown; published?: unknown }[] }).guides ?? [])
    .filter((g) => g.published !== true && typeof g.slug === "string")
    .map((g) => g.slug as string),
);

/** その経路を検索に出さない理由（出してよければ null）。 */
export function noindexReasonForPath(pathname: string, draftGuideSlugs: ReadonlySet<string> = DRAFT_GUIDE_SLUGS): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  for (const [seg, reason] of Object.entries(NOINDEX_SEGMENTS)) {
    if (p === seg || p.startsWith(`${seg}/`)) return reason;
  }
  const parts = p.split("/").filter(Boolean);
  if (parts[0] === "squads" && parts.length >= 2 && !(parts.length === 2 && PUBLIC_SQUAD_SUBPATHS.has(parts[1]))) return "user-squad";
  if (parts[0] === "players" && parts.length >= 2) {
    if (parts[1] === "guide") return parts.length === 3 && !draftGuideSlugs.has(parts[2]) ? null : "draft-guide";
    if (parts[1] === "world") return parts.length === 3 ? null : "non-canonical";
    return "legacy-player-page";
  }
  return null;
}

/** 正式な URL のホストか（デプロイごとの URL・Preview は false）。手元の確認（localhost）は正式と同じに扱う。 */
export function isCanonicalHost(host: string | null | undefined, siteUrl: string = SITE_URL): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h)) return true;
  return h === new URL(siteUrl).host.toLowerCase();
}

/** 検索を許可しているときに、その応答へ付ける X-Robots-Tag（付けなければ null）。 */
export function xRobotsTagFor(input: { allowed?: boolean; pathname: string; host: string | null | undefined }): string | null {
  const allowed = input.allowed ?? SEARCH_INDEXING_ALLOWED;
  if (!allowed) return null; // 全体の noindex は security-headers.mjs が付ける
  if (!isCanonicalHost(input.host)) return "noindex, nofollow";
  return noindexReasonForPath(input.pathname) ? "noindex, nofollow" : null;
}

export function robotsMetadataFor(allowed: boolean) {
  return allowed ? ({ index: true, follow: true } as const) : ({ index: false, follow: false, nocache: true } as const);
}

export const SITE_ROBOTS_METADATA = Object.freeze(robotsMetadataFor(SEARCH_INDEXING_ALLOWED));

export function buildRobotsTxt(allowed: boolean = SEARCH_INDEXING_ALLOWED, siteUrl: string = SITE_URL): MetadataRoute.Robots {
  if (!allowed) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/account", "/share/", ...INTERNAL_ONLY_PATH_PREFIXES] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
