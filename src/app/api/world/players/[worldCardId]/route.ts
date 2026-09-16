import { NextResponse } from "next/server";
import { getPlayerByWorldId } from "@/lib/world/repository";
import { worldCardIdSchema } from "@/lib/world/schemas";
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/world/players/:worldCardId
 * eFootball World カード 1 件（26 能力値・スキル・AI スキル・appearance を含む）。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ worldCardId: string }> },
) {
  const { worldCardId } = await params;
  const parsed = worldCardIdSchema.safeParse(decodeURIComponent(worldCardId));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "選手 ID の形式が正しくありません。" } },
      { status: 400 },
    );
  }

  try {
    const player = await getPlayerByWorldId(parsed.data);
    if (!player) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "選手が見つかりません。" } },
        { status: 404 },
      );
    }
    const res = NextResponse.json({
      player,
      source: "eFootball World",
      sourceUrl: player.sourceUrl,
      fetchedAt: player.fetchedAt,
    });
    if (process.env.NODE_ENV === "production") {
      res.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    }
    return res;
  } catch (err) {
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
}
