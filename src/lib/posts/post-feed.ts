import { foldAccents } from "@/lib/reference-data/runtime/search-normalize";
import type { LocalPost, PostCategory, Visibility } from "./post-model";

/**
 * F-085 投稿フィード（ローカル/モックの段階・2026-10-08）と F-084-S3「URL を知っている人だけ」の契約（モック）。
 * 純関数。サーバー・Production には接続しない（本番の投稿の画面は 404 のまま）。
 *
 * フィード:
 * - 出すのは投稿済み（posted）で、運営に非表示にされていない（hidden_by_admin でない）ものだけ。下書き・削除済みは出さない。
 * - 審査中（under_review）は本人のフィードだけに「審査中」として出す（他人のフィードの契約では出さない）。
 * - 絞り込み: カテゴリ・選手（World のカード ID）・監督・スカッド。検索は本文の大文字小文字・アクセントを無視した部分一致
 *   （選手名・監督名の翻訳や別名の対応はしない）。新しい順（同時刻は ID の順で決定的）。
 * - 「URL を知っている人だけ」（url）の投稿は、本人以外のフィードには載せない（URL で直接開いた場合だけ見える）。
 */
export const POST_FEED_VERSION = "post-feed/2026-10-08.mock.v1";
export const FEED_PAGE_SIZE = 20;
export const FEED_QUERY_MAX = 80;

export type FeedViewer = { kind: "owner" } | { kind: "friend" } | { kind: "other" };

export interface FeedFilter {
  category?: PostCategory | null;
  worldCardId?: string | null;
  managerId?: string | null;
  squadId?: string | null;
  query?: string | null;
}

export interface FeedItem {
  post: LocalPost;
  underReview: boolean;
}

export interface FeedPage {
  items: FeedItem[];
  total: number;
  /** 次のページの位置（無ければ null）。 */
  nextOffset: number | null;
  /** 検索語が短すぎる・長すぎる場合は検索を使わない（全件から絞り込みだけ）。 */
  queryIgnored: boolean;
}

/** 一覧（フィード）に載せてよいか。URL 限定は本人だけ・友達限定は友達と本人だけ。 */
export function visibleInFeed(post: LocalPost, viewer: FeedViewer): boolean {
  if (post.status !== "posted" || post.deletedAt) return false;
  if (post.moderation === "hidden_by_admin") return false;
  if (viewer.kind === "owner") return true;
  if (post.moderation === "under_review") return false;
  return post.visibility === "public" || (post.visibility === "friends" && viewer.kind === "friend");
}

/**
 * F-084-S3: URL（推測困難な投稿の ID）で直接開いたときに見せてよいか。フィードには載らない。
 * - 公開範囲が url・public のときだけ（private・friends は URL を知っていても見せない。friends は友達の関係で判断する別の契約）。
 * - 削除済み・下書き・運営の非表示・審査中は、他人には「見つからない」と同じ扱い（存在の推測を防ぐ）。
 */
export function viewableByUrl(post: LocalPost | null, viewer: FeedViewer): { ok: true } | { ok: false; reason: "not_found" } {
  if (!post) return { ok: false, reason: "not_found" };
  if (viewer.kind === "owner") return post.status === "deleted" ? { ok: false, reason: "not_found" } : { ok: true };
  if (post.status !== "posted" || post.deletedAt || post.moderation !== "visible") return { ok: false, reason: "not_found" };
  const allowed: readonly Visibility[] = ["url", "public"];
  return allowed.includes(post.visibility) ? { ok: true } : { ok: false, reason: "not_found" };
}

export function normalizeFeedText(s: string): string {
  return foldAccents(s.normalize("NFKC")).toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildFeed(posts: readonly LocalPost[], viewer: FeedViewer, filter: FeedFilter = {}, offset = 0, pageSize = FEED_PAGE_SIZE): FeedPage {
  const rawQuery = (filter.query ?? "").trim();
  const q = normalizeFeedText(rawQuery);
  const queryIgnored = rawQuery !== "" && (Array.from(q).length < 2 || Array.from(rawQuery).length > FEED_QUERY_MAX);
  const useQuery = q !== "" && !queryIgnored;
  const matched = posts.filter((p) => {
    if (!visibleInFeed(p, viewer)) return false;
    if (filter.category && p.category !== filter.category) return false;
    if (filter.worldCardId && !p.links.worldCardIds.includes(filter.worldCardId)) return false;
    if (filter.managerId && p.links.managerId !== filter.managerId) return false;
    if (filter.squadId && p.links.squadId !== filter.squadId) return false;
    if (useQuery && !normalizeFeedText(p.body).includes(q)) return false;
    return true;
  });
  matched.sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.createdAt < b.createdAt ? 1 : -1));
  const start = Math.max(0, Math.floor(offset));
  const size = Math.max(1, Math.min(50, Math.floor(pageSize)));
  const slice = matched.slice(start, start + size);
  return {
    items: slice.map((post) => ({ post, underReview: post.moderation === "under_review" })),
    total: matched.length,
    nextOffset: start + size < matched.length ? start + size : null,
    queryIgnored,
  };
}
