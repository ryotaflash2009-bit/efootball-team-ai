/**
 * 選手画像の取得ロジック（自前プロキシ用）。
 *
 * - playerId は「数字 1〜20桁」のみ許可。
 * - 外部URLは固定テンプレートからのみ生成し、efimg.com 以外へはアクセスしない。
 * - GET / タイムアウト20秒 / リダイレクト自動追跡なし / 再試行なし。
 * - HTTP 200 かつ画像 Content-Type かつ 3MB 以内 のときだけ「画像」と認める。
 * - 正常な画像のみプロセス内メモリにキャッシュ（最大32件・TTL1時間・古いものから破棄）。
 *   プレースホルダーや失敗結果はキャッシュしない。プロセス再起動で消える。
 */

const UPSTREAM_HOST = "efimg.com";
const URL_TEMPLATE_PREFIX = "https://efimg.com/efootballhub22/images/player_cards/";
const URL_TEMPLATE_SUFFIX = "_l.png";
const UPSTREAM_PATH_RE = /^\/efootballhub22\/images\/player_cards\/[0-9]{1,20}_l\.png$/;

const PLAYER_ID_RE = /^[0-9]{1,20}$/;

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
export const FETCH_TIMEOUT_MS = 20_000;
const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];

const CACHE_MAX_ENTRIES = 32;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

const UA = "eFootball-Team-AI/0.1 (player image proxy)";

/** playerId が「数字 1〜20桁」だけかを検証する。 */
export function isValidPlayerId(raw: string | null | undefined): raw is string {
  if (typeof raw !== "string") return false;
  return PLAYER_ID_RE.test(raw);
}

/** 検証済み playerId から固定テンプレートで外部画像URLを組み立てる。 */
export function buildImageUrl(playerId: string): string {
  if (!isValidPlayerId(playerId)) {
    throw new Error(`invalid playerId: ${JSON.stringify(playerId)}`);
  }
  return `${URL_TEMPLATE_PREFIX}${playerId}${URL_TEMPLATE_SUFFIX}`;
}

/** 生成したURLが「https・efimg.com・許可パス」に一致するかを二重チェックする。 */
export function isAllowedUpstreamUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    u.host === UPSTREAM_HOST &&
    UPSTREAM_PATH_RE.test(u.pathname) &&
    u.search === "" &&
    u.hash === ""
  );
}

// ---- メモリキャッシュ（最大32件 / TTL1時間 / 古いものから破棄） ----

export interface CachedImage {
  body: Uint8Array;
  contentType: string;
  etag: string | null;
  storedAt: number;
}

const cache = new Map<string, CachedImage>();

export function getCachedImage(playerId: string): CachedImage | null {
  const hit = cache.get(playerId);
  if (!hit) return null;
  if (Date.now() - hit.storedAt > CACHE_TTL_MS) {
    cache.delete(playerId);
    return null;
  }
  return hit;
}

export function setCachedImage(playerId: string, value: CachedImage): void {
  // 既存キーは一旦削除して末尾へ（挿入順を最新化）
  if (cache.has(playerId)) cache.delete(playerId);
  cache.set(playerId, value);
  // 上限超過なら最も古い（先頭）から削除
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** テスト用: キャッシュを空にする。 */
export function _clearImageCache(): void {
  cache.clear();
}

/** テスト用: 現在のキャッシュ件数。 */
export function _imageCacheSize(): number {
  return cache.size;
}

// ---- 外部取得 ----

export type FetchImageResult =
  | { ok: true; body: Uint8Array; contentType: string; etag: string | null; cache: "HIT" | "MISS" }
  | { ok: false; reason: string; status?: number };

/**
 * playerId の画像を取得する。
 * 成功時のみキャッシュへ格納。失敗時は理由を返す（呼び出し側でプレースホルダーを返す）。
 */
export async function fetchPlayerImage(playerId: string): Promise<FetchImageResult> {
  if (!isValidPlayerId(playerId)) {
    return { ok: false, reason: "invalid playerId" };
  }

  const cached = getCachedImage(playerId);
  if (cached) {
    return { ok: true, body: cached.body, contentType: cached.contentType, etag: cached.etag, cache: "HIT" };
  }

  const url = buildImageUrl(playerId);
  if (!isAllowedUpstreamUrl(url)) {
    return { ok: false, reason: "url not allowed" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual", // リダイレクトを自動追跡しない
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
  const declaredLen = lenHeader != null ? Number(lenHeader) : NaN;
  if (!Number.isFinite(declaredLen) || declaredLen <= 0 || declaredLen > MAX_IMAGE_BYTES) {
    return { ok: false, reason: `content-length invalid or too large: ${lenHeader ?? "(none)"}` };
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

  setCachedImage(playerId, { body, contentType, etag, storedAt: Date.now() });

  return { ok: true, body, contentType, etag, cache: "MISS" };
}
