/**
 * eFootball World 選手画像の自前プロキシ用ロジック。
 *
 * - 画像 URL は SQLite（world_player_cards.image_url / mobile_image_url）に保存済みのものだけを使う。
 *   ユーザー入力を外部 URL として使わない。
 * - 許可ホストは d1zxa6glxh8sq9.cloudfront.net のみ。保存済み URL でも他ホストへは行かない。
 * - GET / タイムアウト20秒 / リダイレクト自動追跡なし / 再試行なし。
 * - HTTP 200 かつ image/* かつ 3MB 以内 のときだけ「画像」と認める。
 * - 正常な画像のみプロセス内メモリにキャッシュ（最大32件・TTL1時間・古いものから破棄）。
 *   プレースホルダー・失敗結果はキャッシュしない。プロセス再起動で消える。
 *
 * 既存の efimg.com プロキシ（src/lib/player-image.ts）と同じ設計方針。キャッシュは別。
 */

export const WORLD_IMAGE_HOST = "d1zxa6glxh8sq9.cloudfront.net";

/** 保存 URL のパス形式（player_<id>_<ts>.webp / player_mobile_<id>.webp など） */
const WORLD_IMAGE_PATH_RE =
  /^\/player_(mobile_)?[0-9]{1,20}(_[0-9]{4,20})?\.(webp|png|jpe?g|avif)$/i;

const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
export const FETCH_TIMEOUT_MS = 20_000;
const ALLOWED_CONTENT_TYPES = ["image/webp", "image/png", "image/jpeg", "image/avif"];

const CACHE_MAX_ENTRIES = 32;
const CACHE_TTL_MS = 60 * 60 * 1000;

const UA = "eFootball-Team-AI/0.1 (world player image proxy)";

export function isValidWorldCardId(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && WORLD_CARD_ID_RE.test(raw);
}

/** 保存済み URL が「https・許可ホスト・許可パス・クエリ/フラグメントなし」か */
export function isAllowedWorldImageUrl(url: string | null | undefined): url is string {
  if (typeof url !== "string" || url === "") return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    u.host === WORLD_IMAGE_HOST &&
    u.search === "" &&
    u.hash === "" &&
    WORLD_IMAGE_PATH_RE.test(u.pathname)
  );
}

// ---- メモリキャッシュ ----

export interface CachedWorldImage {
  body: Uint8Array;
  contentType: string;
  etag: string | null;
  storedAt: number;
}

const cache = new Map<string, CachedWorldImage>();

export function getCachedWorldImage(key: string): CachedWorldImage | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

export function setCachedWorldImage(key: string, value: CachedWorldImage): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function _clearWorldImageCache(): void {
  cache.clear();
}
export function _worldImageCacheSize(): number {
  return cache.size;
}

// ---- 外部取得 ----

export type FetchWorldImageResult =
  | { ok: true; body: Uint8Array; contentType: string; etag: string | null; cache: "HIT" | "MISS" }
  | { ok: false; reason: string; status?: number };

/**
 * 保存済み画像 URL（許可ホストのもの）から画像を取得する。
 * 成功時のみキャッシュへ格納。失敗時は理由を返す（呼び出し側でプレースホルダー）。
 */
export async function fetchWorldImage(storedUrl: string): Promise<FetchWorldImageResult> {
  if (!isAllowedWorldImageUrl(storedUrl)) {
    return { ok: false, reason: "url not allowed" };
  }

  const cached = getCachedWorldImage(storedUrl);
  if (cached) {
    return { ok: true, body: cached.body, contentType: cached.contentType, etag: cached.etag, cache: "HIT" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(storedUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: ALLOWED_CONTENT_TYPES.join(",") },
    });
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, reason: `network/timeout: ${(err as Error)?.message ?? err}` };
  }
  clearTimeout(timer);

  if (res.status >= 300 && res.status < 400) {
    return { ok: false, reason: `redirect not followed (${res.status})`, status: res.status };
  }
  if (res.status !== 200) {
    return { ok: false, reason: `upstream status ${res.status}`, status: res.status };
  }

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/") || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return { ok: false, reason: `not an allowed image content-type: ${contentType || "(none)"}` };
  }

  const lenHeader = res.headers.get("content-length");
  if (lenHeader != null) {
    const declaredLen = Number(lenHeader);
    if (!Number.isFinite(declaredLen) || declaredLen <= 0 || declaredLen > MAX_IMAGE_BYTES) {
      return { ok: false, reason: `content-length invalid or too large: ${lenHeader}` };
    }
  }

  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch (err) {
    return { ok: false, reason: `body read failed: ${(err as Error)?.message ?? err}` };
  }
  if (buf.byteLength <= 0 || buf.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, reason: `body size out of range: ${buf.byteLength}` };
  }

  const body = new Uint8Array(buf);
  const etag = res.headers.get("etag");
  setCachedWorldImage(storedUrl, { body, contentType, etag, storedAt: Date.now() });

  return { ok: true, body, contentType, etag, cache: "MISS" };
}
