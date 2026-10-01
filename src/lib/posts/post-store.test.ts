import { describe, it, expect } from "vitest";
import { MemoryPostBackend, PostStore, type NewPostInput } from "./post-store";
import { EMPTY_LINKS, POST_LIMITS, checkRateLimit, localPostSchema, randomPostId } from "./post-model";

const OWNER = "guest";
const OTHER = `account:${"b".repeat(64)}`;
function store(backend = new MemoryPostBackend(), owner = OWNER, clock = { t: Date.parse("2026-10-02T00:00:00Z") }) {
  return { s: new PostStore(backend, owner, () => new Date(clock.t), () => randomPostId()), backend, clock };
}
const image = () => ({ blob: new Blob([new Uint8Array(1000)], { type: "image/webp" }), mime: "image/webp" as const, width: 1536, height: 2048, alt: "スカッドの画面" });
const input = (over: Partial<NewPostInput> = {}): NewPostInput => ({ status: "posted", category: "squad", purpose: "show", visibility: "private", commentsAllowed: true, body: "4-3-3 のスカッド", links: EMPTY_LINKS, image: image(), ...over });

describe("F-084 投稿の保存（ローカル/モック）", () => {
  it("投稿は推測困難な ID・画像キーで保存され、公開の印は常に false", async () => {
    const { s, backend } = store();
    const r = await s.save(input({ visibility: "public" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.post.id).toMatch(/^[a-z2-7]{26}$/);
    expect(r.post.image?.key).toMatch(/^[a-z2-7]{26}$/);
    expect(r.post.image?.key).not.toContain("jpg");
    expect(r.post.publishedRemotely).toBe(false);
    expect(localPostSchema.safeParse(r.post).success).toBe(true);
    expect(backend.images.size).toBe(1);
  });

  it("本文が長すぎる・空・連携先の形式が不正なら保存しない", async () => {
    const { s } = store();
    expect(await s.save(input({ body: "x".repeat(POST_LIMITS.bodyMax + 1) }))).toMatchObject({ ok: false, reason: "body_too_long" });
    expect(await s.save(input({ body: " ", image: null }))).toMatchObject({ ok: false, reason: "empty" });
    expect(await s.save(input({ links: { ...EMPTY_LINKS, worldCardIds: ["<script>"] } }))).toMatchObject({ ok: false, reason: "invalid_links" });
    expect(await s.save(input({ image: { ...image(), alt: "a".repeat(POST_LIMITS.altMax + 1) } }))).toMatchObject({ ok: false, reason: "alt_too_long" });
  });

  it("投稿の書き込みに失敗したら、先に書いた画像を消す（不完全な投稿を残さない）", async () => {
    const backend = new MemoryPostBackend();
    backend.failNext.putPost = true;
    const { s } = store(backend);
    expect(await s.save(input())).toMatchObject({ ok: false, reason: "write_failed" });
    expect(backend.images.size).toBe(0);
    expect(backend.posts.size).toBe(0);
    expect((await s.auditLog()).map((a) => a.action)).toEqual(["post_failed"]);
  });

  it("連投の制限: 30 秒以内・1 時間に 10 件", async () => {
    const { s, clock } = store();
    expect((await s.save(input())).ok).toBe(true);
    clock.t += 10_000;
    expect(await s.save(input())).toMatchObject({ ok: false, reason: "too_soon" });
    expect(checkRateLimit(Array.from({ length: 10 }, (_, i) => 1_000_000 + i * 60_000), 1_000_000 + 10 * 60_000)).toMatchObject({ ok: false, reason: "hourly_limit" });
    // 下書きは制限しない
    expect((await s.save(input({ status: "draft" }))).ok).toBe(true);
  });

  it("下書きの更新（画像を差し替えると古い画像を消す）と、下書きからの投稿", async () => {
    const { s, backend, clock } = store();
    const d = await s.save(input({ status: "draft" }));
    if (!d.ok) throw new Error("draft");
    const oldKey = d.post.image!.key;
    clock.t += 1000;
    const d2 = await s.save(input({ status: "draft", draftId: d.post.id }));
    if (!d2.ok) throw new Error("draft2");
    expect(d2.post.id).toBe(d.post.id);
    expect(backend.images.has(oldKey)).toBe(false);
    const p = await s.save(input({ status: "posted", draftId: d.post.id, image: null }));
    expect(p).toMatchObject({ ok: true, post: { id: d.post.id, status: "posted" } });
    expect(await s.save(input({ status: "posted", draftId: "zzzzzzzzzzzzzzzzzzzzzzzzzz" }))).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("削除すると画像は消え、投稿は墓標になり、表示も画像の取得もできない", async () => {
    const { s, backend } = store();
    const r = await s.save(input());
    if (!r.ok) throw new Error("save");
    expect(await s.image(r.post)).not.toBeNull();
    expect(await s.remove(r.post.id)).toEqual({ ok: true });
    expect(backend.images.size).toBe(0);
    const tomb = backend.posts.get(r.post.id)!;
    expect(tomb).toMatchObject({ status: "deleted", body: "", image: null });
    expect(await s.list()).toEqual([]);
    expect(await s.image(r.post)).toBeNull();
    expect(await s.remove(r.post.id)).toEqual({ ok: false });
  });

  it("別の領域の投稿・画像は読めない・消せない。管理者の非表示は出さない", async () => {
    const backend = new MemoryPostBackend();
    const a = store(backend, OWNER).s;
    const b = store(backend, OTHER).s;
    const r = await a.save(input());
    if (!r.ok) throw new Error("save");
    expect(await b.list()).toEqual([]);
    expect(await b.image(r.post)).toBeNull();
    expect(await b.remove(r.post.id)).toEqual({ ok: false });
    backend.posts.set(r.post.id, { ...r.post, moderation: "hidden_by_admin" });
    expect(await a.list()).toEqual([]);
  });

  it("監査ログは本文・画像を含まず、上限で古いものから捨てる", async () => {
    const { s, clock } = store();
    for (let i = 0; i < 3; i++) {
      await s.save(input({ status: "draft" }));
      clock.t += 1000;
    }
    const log = await s.auditLog();
    expect(log.map((e) => e.action)).toEqual(["draft_saved", "draft_saved", "draft_saved"]);
    expect(JSON.stringify(log)).not.toMatch(/スカッド|webp|blob/);
  });
});
