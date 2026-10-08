import type { Metadata } from "next";
import { SEARCH_INDEXING_ALLOWED, SITE_URL } from "@/lib/public-info/search-indexing";

/**
 * 画面ごとの title・description・canonical・Open Graph・Twitter カード（2026-10-08）。
 * - title・description は常に出す（タブの題名・共有の説明に使う）。
 * - canonical・Open Graph・Twitter カードは、検索への登録を許可したとき（`NEXT_PUBLIC_SEARCH_INDEXING=enabled`）だけ出す
 *   （noindex の間に検索・SNS のプレビューへ出さない、という既存の方針を保つ）。
 * - 文言は日本語。「イーフト」「eFootball」などは自然な範囲で入れ、詰め込まない。
 */
export const SITE_NAME = "TeamAIXI";
export const OG_IMAGE_PATH = "/og-image";

export function pageMetadata(input: { path: string; title: string; description: string; allowed?: boolean; noindex?: boolean }): Metadata {
  const allowed = input.allowed ?? SEARCH_INDEXING_ALLOWED;
  const md: Metadata = { title: input.title, description: input.description };
  if (input.noindex) md.robots = { index: false, follow: true };
  if (!allowed || input.noindex) return md;
  const url = `${SITE_URL}${input.path === "/" ? "" : input.path}` || SITE_URL;
  md.alternates = { canonical: input.path };
  md.openGraph = {
    type: "website",
    siteName: SITE_NAME,
    locale: "ja_JP",
    url,
    title: input.title,
    description: input.description,
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: SITE_NAME }],
  };
  md.twitter = { card: "summary_large_image", title: input.title, description: input.description, images: [OG_IMAGE_PATH] };
  return md;
}
