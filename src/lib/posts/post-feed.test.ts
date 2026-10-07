import { describe, it, expect } from "vitest";
import { buildFeed, viewableByUrl, visibleInFeed, FEED_PAGE_SIZE } from "./post-feed";
import { EMPTY_LINKS, POST_SCHEMA_VERSION, type LocalPost } from "./post-model";

let seq = 0;
function post(over: Partial<LocalPost> = {}): LocalPost {
  seq += 1;
  const id = `p${String(seq).padStart(25, "0")}`.replace(/[^a-z0-9]/g, "a").slice(0, 26);
  return {
    schema: POST_SCHEMA_VERSION,
    id,
    owner: "guest",
    status: "posted",
    moderation: "visible",
    visibility: "public",
    publishedRemotely: false,
    commentsAllowed: false,
    category: "squad",
    purpose: "show",
    body: "My squad",
    image: null,
    links: { ...EMPTY_LINKS },
    createdAt: `2026-10-0${(seq % 9) + 1}T00:00:00.000Z`,
    updatedAt: "2026-10-08T00:00:00.000Z",
    deletedAt: null,
    ...over,
  } as LocalPost;
}

describe("投稿フィード（モック）", () => {
  it("下書き・削除済み・運営の非表示は出さない。審査中は本人だけ（印つき）", () => {
    const posts = [post(), post({ status: "draft" }), post({ status: "deleted", deletedAt: "x" }), post({ moderation: "hidden_by_admin" }), post({ moderation: "under_review" })];
    const owner = buildFeed(posts, { kind: "owner" });
    expect(owner.total).toBe(2);
    expect(owner.items.filter((i) => i.underReview)).toHaveLength(1);
    expect(buildFeed(posts, { kind: "other" }).total).toBe(1);
  });

  it("公開範囲: url と private は他人のフィードに載らない・friends は友達だけ", () => {
    const [pub, url, priv, fr] = [post({ visibility: "public" }), post({ visibility: "url" }), post({ visibility: "private" }), post({ visibility: "friends" })];
    const ids = (v: Parameters<typeof buildFeed>[1]) => buildFeed([pub, url, priv, fr], v).items.map((i) => i.post.id).sort();
    expect(ids({ kind: "other" })).toEqual([pub.id]);
    expect(ids({ kind: "friend" })).toEqual([pub.id, fr.id].sort());
    expect(ids({ kind: "owner" })).toHaveLength(4);
    expect(visibleInFeed(url, { kind: "friend" })).toBe(false);
  });

  it("絞り込み（カテゴリ・選手・監督・スカッド）と、大文字小文字・アクセントを無視した本文の検索", () => {
    const a = post({ category: "gacha", body: "Vinícius を引いた", links: { ...EMPTY_LINKS, worldCardIds: ["111"], managerId: "65" } });
    const b = post({ category: "squad", body: "4-3-3 の配置", links: { ...EMPTY_LINKS, squadId: "sq_abc" } });
    const all = [a, b];
    const other = { kind: "other" } as const;
    expect(buildFeed(all, other, { category: "gacha" }).items.map((i) => i.post.id)).toEqual([a.id]);
    expect(buildFeed(all, other, { worldCardId: "111" }).total).toBe(1);
    expect(buildFeed(all, other, { managerId: "65" }).total).toBe(1);
    expect(buildFeed(all, other, { squadId: "sq_abc" }).items[0].post.id).toBe(b.id);
    expect(buildFeed(all, other, { query: "VINICIUS" }).items.map((i) => i.post.id)).toEqual([a.id]);
    // 1 文字の検索は使わない（全件から絞り込みだけ）
    const short = buildFeed(all, other, { query: "v" });
    expect(short.queryIgnored).toBe(true);
    expect(short.total).toBe(2);
  });

  it("新しい順・同時刻は ID の順（決定的）・ページ分け", () => {
    const many = Array.from({ length: 45 }, (_, i) => post({ createdAt: `2026-10-08T00:00:${String(i % 60).padStart(2, "0")}.000Z` }));
    const p1 = buildFeed(many, { kind: "other" });
    expect(p1.items).toHaveLength(FEED_PAGE_SIZE);
    expect(p1.nextOffset).toBe(FEED_PAGE_SIZE);
    expect(p1.items[0].post.createdAt >= p1.items[1].post.createdAt).toBe(true);
    const p3 = buildFeed(many, { kind: "other" }, {}, 40);
    expect(p3.items).toHaveLength(5);
    expect(p3.nextOffset).toBeNull();
    expect(buildFeed([...many].reverse(), { kind: "other" }).items.map((i) => i.post.id)).toEqual(p1.items.map((i) => i.post.id));
  });
});

describe("URL を知っている人だけ（F-084-S3・モック）", () => {
  it("url と public だけ URL で見える。private・friends・審査中・非表示・削除・下書きは「見つからない」", () => {
    const other = { kind: "other" } as const;
    expect(viewableByUrl(post({ visibility: "url" }), other)).toEqual({ ok: true });
    expect(viewableByUrl(post({ visibility: "public" }), other)).toEqual({ ok: true });
    for (const p of [
      post({ visibility: "private" }),
      post({ visibility: "friends" }),
      post({ visibility: "url", moderation: "under_review" }),
      post({ visibility: "url", moderation: "hidden_by_admin" }),
      post({ visibility: "url", status: "deleted", deletedAt: "x" }),
      post({ visibility: "url", status: "draft" }),
      null,
    ]) {
      expect(viewableByUrl(p, other)).toEqual({ ok: false, reason: "not_found" });
    }
    expect(viewableByUrl(post({ visibility: "private", moderation: "under_review" }), { kind: "owner" })).toEqual({ ok: true });
  });
});
