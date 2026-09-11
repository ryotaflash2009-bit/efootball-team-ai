import { NextResponse } from "next/server";
import { parseWorldListQuery } from "@/lib/world/schemas";
import { listPlayers, getSourceMeta, getFacets } from "@/lib/world/repository";
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/world/players
 *   ?page= &pageSize=(24|50|100) &q= &sort= &position= &cardType=
 *   &playingStyle= &playingStyleDef= &minOvr= &maxOvr= &hasBooster=(1|0) &facets=1
 *
 * 保存済みの eFootball World データ（SQLite）だけを返す。外部アクセスなし。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = parseWorldListQuery({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
    q: searchParams.get("q"),
    query: searchParams.get("query"),
    sort: searchParams.get("sort"),
    position: searchParams.get("position"),
    cardType: searchParams.get("cardType"),
    playingStyle: searchParams.get("playingStyle"),
    playingStyleDef: searchParams.get("playingStyleDef"),
    minOvr: searchParams.get("minOvr"),
    maxOvr: searchParams.get("maxOvr"),
    hasBooster: searchParams.get("hasBooster"),
  });

  try {
    const result = listPlayers(q);
    const meta = getSourceMeta();
    const body: Record<string, unknown> = {
      players: result.players,
      page: result.page,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrevious: result.hasPrevious,
      appliedFilters: result.appliedFilters,
      source: meta.source,
      updatedAt: meta.syncFinishedAt,
    };
    if (searchParams.get("facets") === "1") {
      body.facets = getFacets();
    }

    const res = NextResponse.json(body);
    if (process.env.NODE_ENV === "production") {
      res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    }
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof WorldDataUnavailableError) {
    return NextResponse.json(
      { error: { code: err.code, message: "World データがまだ用意されていません。" } },
      { status: 503 },
    );
  }
  if (err instanceof WorldQueryError) {
    return NextResponse.json(
      { error: { code: err.code, message: "選手データの照会に失敗しました。" } },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { error: { code: "UNEXPECTED", message: "予期しないエラーが発生しました。" } },
    { status: 500 },
  );
}
