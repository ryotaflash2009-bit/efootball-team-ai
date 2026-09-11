import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { fetchPlayerImage, isValidPlayerId } from "@/lib/player-image";

export const dynamic = "force-dynamic";

const IMAGE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
const PLACEHOLDER_CACHE_CONTROL = "public, max-age=300";

let placeholderCache: Buffer | null = null;

async function readPlaceholder(): Promise<Buffer> {
  if (placeholderCache) return placeholderCache;
  const p = path.join(process.cwd(), "public", "player-placeholder.svg");
  placeholderCache = await fs.readFile(p);
  return placeholderCache;
}

function placeholderResponse(reason: string): Promise<Response> {
  return readPlaceholder().then(
    (svg) =>
      new Response(new Uint8Array(svg), {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Length": String(svg.byteLength),
          "Cache-Control": PLACEHOLDER_CACHE_CONTROL,
          "X-Image-Cache": "MISS",
          "X-Image-Placeholder": "1",
          "X-Image-Reason": reason.slice(0, 120),
        },
      }),
  );
}

/**
 * GET /api/player-image/:id
 * 選手画像を efimg.com から取得して返す自前プロキシ。
 * 失敗時はローカルの SVG プレースホルダーを 200 で返す（カード描画を壊さない）。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "playerId が不正です。" } },
      { status: 400 },
    );
  }

  if (!isValidPlayerId(decoded)) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "playerId は数字 1〜20桁のみ許可されます。" } },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await fetchPlayerImage(decoded);
  } catch (err) {
    return placeholderResponse(`exception: ${(err as Error)?.message ?? err}`);
  }

  if (!result.ok) {
    return placeholderResponse(result.reason);
  }

  const headers: Record<string, string> = {
    "Content-Type": result.contentType,
    "Content-Length": String(result.body.byteLength),
    "Cache-Control": IMAGE_CACHE_CONTROL,
    "X-Image-Cache": result.cache,
  };
  if (result.etag) headers["ETag"] = result.etag;

  return new Response(result.body, { status: 200, headers });
}
