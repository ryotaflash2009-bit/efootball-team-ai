import { z } from "zod";

/**
 * F-084 写真付き投稿（ローカル/モックの段階）のデータ契約。
 *
 * - 投稿はこの端末・この領域（ゲスト / ログイン中のアカウント）だけに保存する。サーバー・Production へは送らない。
 * - 公開範囲は将来の契約として持つが、今の段階では**どの値でも公開しない**（`publishedRemotely` は常に false）。
 * - ID・保存キーは推測できない乱数（ファイル名を使わない）。所有者は領域のキー（アカウントのハッシュ・ゲスト）。
 * - 削除した投稿は本文・画像を消し、墓標（削除済みの印）だけを残す（同じ ID の画像は二度と表示しない）。
 */
export const POST_SCHEMA_VERSION = "efb-local-post/v1";
export const POST_LIMITS = Object.freeze({
  bodyMax: 1000,
  altMax: 200,
  maxLinkedCards: 5,
  /** 連投の制限（ローカルの契約。将来はサーバー側でも同じ値を使う）。 */
  minIntervalMs: 30_000,
  maxPerHour: 10,
  maxPostsPerScope: 200,
  auditMax: 200,
});

export const VISIBILITIES = ["private", "url", "friends", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const CATEGORIES = ["squad", "gacha", "build", "before_after", "question", "other"] as const;
export type PostCategory = (typeof CATEGORIES)[number];
export const PURPOSES = ["show", "advice", "record"] as const;
export type PostPurpose = (typeof PURPOSES)[number];
export type PostStatus = "draft" | "posted" | "deleted";
export type ModerationState = "visible" | "under_review" | "hidden_by_admin";

const ID_RE = /^[a-z0-9]{26}$/;
const WORLD_ID_RE = /^[0-9]{1,20}$/;
const LOCAL_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const imageMetaSchema = z.object({
  /** 画像の保存キー（推測困難な乱数）。 */
  key: z.string().regex(ID_RE),
  mime: z.enum(["image/webp", "image/jpeg"]),
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
  bytes: z.number().int().min(1).max(5_000_000),
  alt: z.string().max(POST_LIMITS.altMax),
});

export const postLinksSchema = z.object({
  squadId: z.string().regex(LOCAL_ID_RE).nullable(),
  worldCardIds: z.array(z.string().regex(WORLD_ID_RE)).max(POST_LIMITS.maxLinkedCards),
  managerId: z.string().regex(LOCAL_ID_RE).nullable(),
  buildId: z.string().regex(LOCAL_ID_RE).nullable(),
  /** 診断結果（共有 URL の sd1 トークン。内部 ID・名前を含まない契約）。 */
  diagnosisToken: z.string().regex(/^sd1\.[A-Za-z0-9_-]{1,1600}\.[0-9a-f]{8}$/).nullable(),
  /** ガチャ結果のメモ（自由記述の短い文。権利の不明なデータを取り込まない）。 */
  gachaNote: z.string().max(120).nullable(),
  /** 改善前後（診断履歴の ID 2 件。この端末の中だけで意味を持つ）。 */
  beforeAfterHistoryIds: z.tuple([z.string().regex(LOCAL_ID_RE), z.string().regex(LOCAL_ID_RE)]).nullable(),
});

export const localPostSchema = z.object({
  schema: z.literal(POST_SCHEMA_VERSION),
  id: z.string().regex(ID_RE),
  /** 所有者（領域のキー）。この領域以外からは読めない・消せない。 */
  owner: z.string().regex(/^(guest|account:[0-9a-f]{64})$/),
  status: z.enum(["draft", "posted", "deleted"]),
  moderation: z.enum(["visible", "under_review", "hidden_by_admin"]),
  visibility: z.enum(VISIBILITIES),
  /** 将来の公開の印。ローカル/モックの段階では常に false。 */
  publishedRemotely: z.literal(false),
  commentsAllowed: z.boolean(),
  category: z.enum(CATEGORIES),
  purpose: z.enum(PURPOSES),
  body: z.string().max(POST_LIMITS.bodyMax),
  image: imageMetaSchema.nullable(),
  links: postLinksSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type LocalPost = z.infer<typeof localPostSchema>;
export type PostLinks = z.infer<typeof postLinksSchema>;
export type ImageMeta = z.infer<typeof imageMetaSchema>;

export const EMPTY_LINKS: PostLinks = { squadId: null, worldCardIds: [], managerId: null, buildId: null, diagnosisToken: null, gachaNote: null, beforeAfterHistoryIds: null };

/** 推測困難な ID（26 文字・base32 相当。128 bit 以上の乱数）。 */
export function randomPostId(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const b = random(26);
  let s = "";
  for (let i = 0; i < 26; i++) s += alphabet[b[i] & 31];
  return s;
}

/** 投稿前の確認（本文・代替テキストの長さ、画像の有無、連携先の形式）。 */
export function validateDraftInput(input: { body: string; alt: string; hasImage: boolean; links: PostLinks }): { ok: true } | { ok: false; reason: "body_too_long" | "alt_too_long" | "empty" | "invalid_links" } {
  if (input.body.length > POST_LIMITS.bodyMax) return { ok: false, reason: "body_too_long" };
  if (input.alt.length > POST_LIMITS.altMax) return { ok: false, reason: "alt_too_long" };
  if (!input.hasImage && input.body.trim() === "") return { ok: false, reason: "empty" };
  if (!postLinksSchema.safeParse(input.links).success) return { ok: false, reason: "invalid_links" };
  return { ok: true };
}

/** 連投の制限（直前の投稿から 30 秒・1 時間に 10 件）。 */
export function checkRateLimit(postedAtTimes: readonly number[], now: number): { ok: true } | { ok: false; reason: "too_soon" | "hourly_limit"; retryAfterMs: number } {
  const recent = postedAtTimes.filter((t) => now - t < 3_600_000).sort((a, b) => b - a);
  if (recent.length > 0 && now - recent[0] < POST_LIMITS.minIntervalMs) return { ok: false, reason: "too_soon", retryAfterMs: POST_LIMITS.minIntervalMs - (now - recent[0]) };
  if (recent.length >= POST_LIMITS.maxPerHour) return { ok: false, reason: "hourly_limit", retryAfterMs: 3_600_000 - (now - recent[recent.length - 1]) };
  return { ok: true };
}

/** 表示してよいか（削除済み・管理者による非表示・他の領域は出さない）。 */
export function isDisplayable(post: LocalPost, owner: string): boolean {
  return post.owner === owner && post.status !== "deleted" && post.moderation !== "hidden_by_admin";
}

/** 削除: 本文・画像・連携を消して墓標にする（画像の保存キーは呼び出し側が先に削除する）。 */
export function toTombstone(post: LocalPost, nowIso: string): LocalPost {
  return { ...post, status: "deleted", body: "", image: null, links: EMPTY_LINKS, updatedAt: nowIso, deletedAt: nowIso };
}
