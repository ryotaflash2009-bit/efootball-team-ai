import {
  POST_LIMITS,
  POST_SCHEMA_VERSION,
  checkRateLimit,
  isDisplayable,
  localPostSchema,
  randomPostId,
  toTombstone,
  validateDraftInput,
  type ImageMeta,
  type LocalPost,
  type PostCategory,
  type PostLinks,
  type PostPurpose,
  type Visibility,
} from "./post-model";

/**
 * F-084 投稿の保存（ローカル/モック）。保存先は差し替え可能（ブラウザーは IndexedDB、テストはメモリ）。
 * - 作成は「画像を書く → 投稿を書く」の順で、投稿の書き込みに失敗したら画像を消す（不完全な投稿を残さない）。
 * - 読み出しは所有者（領域）ごと。別の領域の投稿・画像は読めない。
 * - 操作の記録（監査ログ）を領域ごとに最大 200 件残す（本文・画像は記録しない）。
 */
export interface PostBackend {
  getPosts(owner: string): Promise<LocalPost[]>;
  putPost(post: LocalPost): Promise<void>;
  putImage(key: string, owner: string, blob: Blob): Promise<void>;
  getImage(key: string, owner: string): Promise<Blob | null>;
  deleteImage(key: string, owner: string): Promise<void>;
  getAudit(owner: string): Promise<AuditEntry[]>;
  putAudit(owner: string, entries: AuditEntry[]): Promise<void>;
}

export type AuditAction = "draft_saved" | "posted" | "deleted" | "draft_deleted" | "post_failed" | "rate_limited";
export interface AuditEntry {
  at: string;
  action: AuditAction;
  postId: string | null;
}

export interface NewPostInput {
  status: "draft" | "posted";
  category: PostCategory;
  purpose: PostPurpose;
  visibility: Visibility;
  commentsAllowed: boolean;
  body: string;
  links: PostLinks;
  image: { blob: Blob; mime: "image/webp" | "image/jpeg"; width: number; height: number; alt: string } | null;
  /** 下書きを更新するときの既存 ID。 */
  draftId?: string | null;
}

export type SaveResult = { ok: true; post: LocalPost } | { ok: false; reason: "body_too_long" | "alt_too_long" | "empty" | "invalid_links" | "too_soon" | "hourly_limit" | "storage_full" | "not_found" | "write_failed"; retryAfterMs?: number };

export class PostStore {
  constructor(
    private readonly backend: PostBackend,
    private readonly owner: string,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => randomPostId(),
  ) {}

  private async audit(action: AuditAction, postId: string | null) {
    try {
      const list = await this.backend.getAudit(this.owner);
      list.push({ at: this.now().toISOString(), action, postId });
      await this.backend.putAudit(this.owner, list.slice(-POST_LIMITS.auditMax));
    } catch {
      /* 記録の失敗で操作を止めない */
    }
  }

  /** 表示できる投稿（新しい順）。下書きも含む（status で区別）。 */
  async list(): Promise<LocalPost[]> {
    const all = await this.backend.getPosts(this.owner);
    return all.filter((p) => localPostSchema.safeParse(p).success && isDisplayable(p, this.owner)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async image(post: LocalPost): Promise<Blob | null> {
    if (!post.image || !isDisplayable(post, this.owner)) return null;
    return this.backend.getImage(post.image.key, this.owner);
  }

  async save(input: NewPostInput): Promise<SaveResult> {
    const v = validateDraftInput({ body: input.body, alt: input.image?.alt ?? "", hasImage: Boolean(input.image), links: input.links });
    if (!v.ok) return v;
    const all = await this.backend.getPosts(this.owner);
    const existing = input.draftId ? all.find((p) => p.id === input.draftId && p.owner === this.owner && p.status === "draft") : undefined;
    if (input.draftId && !existing) return { ok: false, reason: "not_found" };
    const nowMs = this.now().getTime();
    if (input.status === "posted") {
      const rl = checkRateLimit(all.filter((p) => p.status === "posted").map((p) => Date.parse(p.createdAt)), nowMs);
      if (!rl.ok) {
        await this.audit("rate_limited", null);
        return { ok: false, reason: rl.reason, retryAfterMs: rl.retryAfterMs };
      }
    }
    if (!existing && all.filter((p) => p.status !== "deleted").length >= POST_LIMITS.maxPostsPerScope) return { ok: false, reason: "storage_full" };

    const nowIso = this.now().toISOString();
    let imageMeta: ImageMeta | null = existing?.image ?? null;
    let newImageKey: string | null = null;
    if (input.image) {
      newImageKey = this.newId();
      try {
        await this.backend.putImage(newImageKey, this.owner, input.image.blob);
      } catch {
        await this.audit("post_failed", existing?.id ?? null);
        return { ok: false, reason: "write_failed" };
      }
      imageMeta = { key: newImageKey, mime: input.image.mime, width: input.image.width, height: input.image.height, bytes: input.image.blob.size, alt: input.image.alt };
    }
    const post: LocalPost = {
      schema: POST_SCHEMA_VERSION,
      id: existing?.id ?? this.newId(),
      owner: this.owner,
      status: input.status,
      moderation: "visible",
      visibility: input.visibility,
      publishedRemotely: false,
      commentsAllowed: input.commentsAllowed,
      category: input.category,
      purpose: input.purpose,
      body: input.body,
      image: imageMeta,
      links: input.links,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };
    if (input.status === "posted") post.createdAt = nowIso;
    const parsed = localPostSchema.safeParse(post);
    if (!parsed.success) {
      if (newImageKey) await this.backend.deleteImage(newImageKey, this.owner).catch(() => undefined);
      return { ok: false, reason: "write_failed" };
    }
    try {
      await this.backend.putPost(parsed.data);
    } catch {
      // 投稿を書けなかった: 先に書いた画像を消す（不完全な投稿を残さない）。
      if (newImageKey) await this.backend.deleteImage(newImageKey, this.owner).catch(() => undefined);
      await this.audit("post_failed", post.id);
      return { ok: false, reason: "write_failed" };
    }
    // 画像を差し替えた下書きは、古い画像を消す。
    if (newImageKey && existing?.image) await this.backend.deleteImage(existing.image.key, this.owner).catch(() => undefined);
    await this.audit(input.status === "posted" ? "posted" : "draft_saved", post.id);
    return { ok: true, post: parsed.data };
  }

  /** 削除（投稿・下書き）。画像を先に消し、投稿は墓標にする。 */
  async remove(id: string): Promise<{ ok: boolean }> {
    const all = await this.backend.getPosts(this.owner);
    const post = all.find((p) => p.id === id && p.owner === this.owner && p.status !== "deleted");
    if (!post) return { ok: false };
    try {
      if (post.image) await this.backend.deleteImage(post.image.key, this.owner);
      await this.backend.putPost(toTombstone(post, this.now().toISOString()));
    } catch {
      return { ok: false };
    }
    await this.audit(post.status === "draft" ? "draft_deleted" : "deleted", id);
    return { ok: true };
  }

  async auditLog(): Promise<AuditEntry[]> {
    return this.backend.getAudit(this.owner);
  }
}

/** テスト・モック用のメモリの保存先。`failNext` で失敗を注入できる。 */
export class MemoryPostBackend implements PostBackend {
  posts = new Map<string, LocalPost>();
  images = new Map<string, { owner: string; blob: Blob }>();
  audits = new Map<string, AuditEntry[]>();
  failNext: { putPost?: boolean; putImage?: boolean } = {};
  async getPosts(owner: string) {
    return [...this.posts.values()].filter((p) => p.owner === owner).map((p) => structuredClone(p));
  }
  async putPost(post: LocalPost) {
    if (this.failNext.putPost) {
      this.failNext.putPost = false;
      throw new Error("fail");
    }
    this.posts.set(post.id, structuredClone(post));
  }
  async putImage(key: string, owner: string, blob: Blob) {
    if (this.failNext.putImage) {
      this.failNext.putImage = false;
      throw new Error("fail");
    }
    this.images.set(key, { owner, blob });
  }
  async getImage(key: string, owner: string) {
    const v = this.images.get(key);
    return v && v.owner === owner ? v.blob : null;
  }
  async deleteImage(key: string, owner: string) {
    const v = this.images.get(key);
    if (v && v.owner === owner) this.images.delete(key);
  }
  async getAudit(owner: string) {
    return [...(this.audits.get(owner) ?? [])];
  }
  async putAudit(owner: string, entries: AuditEntry[]) {
    this.audits.set(owner, entries);
  }
}
