import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isValidWorldCardId,
  isAllowedWorldImageUrl,
  fetchWorldImage,
  getCachedWorldImage,
  setCachedWorldImage,
  _clearWorldImageCache,
  _worldImageCacheSize,
  WORLD_IMAGE_HOST,
  MAX_IMAGE_BYTES,
} from "./player-image";

const ok = `https://${WORLD_IMAGE_HOST}/player_89138556575063_1785079036465.webp`;
const okMobile = `https://${WORLD_IMAGE_HOST}/player_mobile_89136409091415.webp`;

describe("isValidWorldCardId", () => {
  it("数字のみ 1〜20 桁", () => {
    expect(isValidWorldCardId("89138556575063")).toBe(true);
    expect(isValidWorldCardId("abc")).toBe(false);
    expect(isValidWorldCardId("1; DROP")).toBe(false);
    expect(isValidWorldCardId("")).toBe(false);
    expect(isValidWorldCardId(null)).toBe(false);
  });
});

describe("isAllowedWorldImageUrl", () => {
  it("許可ホストの https 画像 URL は true", () => {
    expect(isAllowedWorldImageUrl(ok)).toBe(true);
    expect(isAllowedWorldImageUrl(okMobile)).toBe(true);
  });
  it("別ホスト・http・クエリ/フラグメント・許可外パスは false", () => {
    expect(isAllowedWorldImageUrl(`https://evil.example.com/player_1_2.webp`)).toBe(false);
    expect(isAllowedWorldImageUrl(`http://${WORLD_IMAGE_HOST}/player_1_2.webp`)).toBe(false);
    expect(isAllowedWorldImageUrl(`https://${WORLD_IMAGE_HOST}/player_1_2.webp?x=1`)).toBe(false);
    expect(isAllowedWorldImageUrl(`https://${WORLD_IMAGE_HOST}/player_1_2.webp#a`)).toBe(false);
    expect(isAllowedWorldImageUrl(`https://${WORLD_IMAGE_HOST}/../secret.webp`)).toBe(false);
    expect(isAllowedWorldImageUrl(`https://${WORLD_IMAGE_HOST}/random.txt`)).toBe(false);
    expect(isAllowedWorldImageUrl(`https://${WORLD_IMAGE_HOST}.evil.com/player_1_2.webp`)).toBe(false);
    expect(isAllowedWorldImageUrl(null)).toBe(false);
  });
});

describe("World 画像メモリキャッシュ", () => {
  beforeEach(() => _clearWorldImageCache());
  it("最大32件で古いものから破棄", () => {
    for (let i = 0; i < 40; i++) {
      setCachedWorldImage(`k${i}`, { body: new Uint8Array([1]), contentType: "image/webp", etag: null, storedAt: Date.now() });
    }
    expect(_worldImageCacheSize()).toBe(32);
    expect(getCachedWorldImage("k0")).toBeNull();
    expect(getCachedWorldImage("k39")).not.toBeNull();
  });
  it("TTL 超過は返さない", () => {
    setCachedWorldImage("old", { body: new Uint8Array([1]), contentType: "image/webp", etag: null, storedAt: Date.now() - 3_600_001 });
    expect(getCachedWorldImage("old")).toBeNull();
  });
});

describe("fetchWorldImage: 外部アクセスの安全性（fetch をモック）", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => _clearWorldImageCache());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("許可外ホストの URL は fetch を呼ばず拒否", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const r = await fetchWorldImage("https://evil.example.com/player_1_2.webp");
    expect(r.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("画像でない Content-Type は拒否", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "text/html", "Content-Length": "3" } }),
    ) as unknown as typeof fetch;
    const r = await fetchWorldImage(ok);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/content-type/i);
  });

  it("Content-Length が 3MB 超なら拒否", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "Content-Type": "image/webp", "Content-Length": String(MAX_IMAGE_BYTES + 1) },
      }),
    ) as unknown as typeof fetch;
    const r = await fetchWorldImage(ok);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/too large/i);
  });

  it("リダイレクトは追跡せず拒否", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: "https://elsewhere.example.com/x" } }),
    ) as unknown as typeof fetch;
    const r = await fetchWorldImage(ok);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/redirect/i);
  });

  it("上流が 200 以外なら拒否", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 })) as unknown as typeof fetch;
    const r = await fetchWorldImage(ok);
    expect(r.ok).toBe(false);
  });

  it("実際に本文が 3MB 超なら拒否（Content-Length なし）", async () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 10);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(big, { status: 200, headers: { "Content-Type": "image/webp" } }),
    ) as unknown as typeof fetch;
    const r = await fetchWorldImage(ok);
    expect(r.ok).toBe(false);
  });

  it("正常な webp は成功しキャッシュされる（2回目は HIT）", async () => {
    const bytes = new Uint8Array([82, 73, 70, 70]);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(bytes, { status: 200, headers: { "Content-Type": "image/webp", "Content-Length": "4", ETag: '"abc"' } }),
    ) as unknown as typeof fetch;
    const r1 = await fetchWorldImage(ok);
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.cache).toBe("MISS");
    const r2 = await fetchWorldImage(ok);
    if (r2.ok) expect(r2.cache).toBe("HIT");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
