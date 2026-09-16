import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWorldImageUrls } from "@/lib/world/repository";
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";
import {
  fetchWorldImage,
  isValidWorldCardId,
  isAllowedWorldImageUrl,
} from "@/lib/world/player-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
const PLACEHOLDER_CACHE_CONTROL = "public, max-age=300";

let placeholderCache: Buffer | null = null;
async function readPlaceholder(): Promise<Buffer> {
  if (placeholderCache) return placeholderCache;
  placeholderCache = await fs.readFile(
    path.join(process.cwd(), "public", "player-placeholder.svg"),
  );
  return placeholderCache;
}

async function placeholderResponse(reason: string): Promise<Response> {
  const svg = await readPlaceholder();
  return new Response(new Uint8Array(svg), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Length": String(svg.byteLength),
      "Cache-Control": PLACEHOLDER_CACHE_CONTROL,
      "X-Image-Placeholder": "1",
      "X-Image-Reason": reason.slice(0, 120),
    },
  });
}

/**
 * GET /api/world/player-image/:worldCardId?variant=(main|mobile)
 *
 * SQLite に保存済みの World 画像 URL（許可ホストのみ）を自前でプロキシして返す。
 * 失敗時はローカル SVG プレースホルダーを 200 で返す（カード描画を壊さない）。
 * ユーザー入力を外部 URL として使わない。許可ホスト以外へアクセスしない。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ worldCardId: string }> },
): Promise<Response> {
  const { worldCardId } = await params;

  let decoded: string;
  try {
    decoded = decodeURIComponent(worldCardId);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "worldCardId が不正です。" } },
      { status: 400 },
    );
  }
  if (!isValidWorldCardId(decoded)) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "worldCardId は数字 1〜20桁のみ許可されます。" } },
      { status: 400 },
    );
  }

  const variant = new URL(request.url).searchParams.get("variant");

  let urls: { imageUrl: string | null; mobileImageUrl: string | null } | null;
  try {
    urls = await getWorldImageUrls(decoded);
  } catch (err) {
    if (err instanceof WorldDataUnavailableError || err instanceof WorldQueryError) {
      return placeholderResponse(err.code);
    }
    return placeholderResponse("lookup failed");
  }
  if (!urls) {
    return placeholderResponse("card not found");
  }

  // variant=mobile はモバイル URL のみ。既定は 通常 → モバイル の順で試す。
  const candidates: string[] = [];
  if (variant === "mobile") {
    if (urls.mobileImageUrl) candidates.push(urls.mobileImageUrl);
  } else {
    if (urls.imageUrl) candidates.push(urls.imageUrl);
    if (urls.mobileImageUrl) candidates.push(urls.mobileImageUrl);
  }

  const allowed = candidates.filter((u) => isAllowedWorldImageUrl(u));
  if (allowed.length === 0) {
    return placeholderResponse("no allowed image url");
  }

  let lastReason = "unknown";
  let upstreamRequests = 0; // 実際に外部へ出た GET 数（キャッシュ HIT は数えない）
  for (const url of allowed) {
    let result;
    try {
      result = await fetchWorldImage(url);
    } catch (err) {
      upstreamRequests += 1;
      lastReason = `exception: ${(err as Error)?.message ?? err}`;
      continue;
    }
    if (result.ok && result.cache === "MISS") upstreamRequests += 1;
    else if (!result.ok && !/url not allowed/.test(result.reason)) upstreamRequests += 1;
    if (result.ok) {
      const headers: Record<string, string> = {
        "Content-Type": result.contentType,
        "Content-Length": String(result.body.byteLength),
        "Cache-Control": IMAGE_CACHE_CONTROL,
        "X-Image-Cache": result.cache,
        "X-Image-Upstream-Requests": String(upstreamRequests),
      };
      if (result.etag) headers["ETag"] = result.etag;
      return new Response(result.body, { status: 200, headers });
    }
    lastReason = result.reason;
  }

  const res = await placeholderResponse(lastReason);
  res.headers.set("X-Image-Upstream-Requests", String(upstreamRequests));
  return res;
}
