import { NextResponse } from "next/server";
import { getPlayersByWorldIds, getSourceMeta } from "@/lib/world/repository";
import { WorldDataUnavailableError, WorldQueryError } from "@/lib/world/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORLD_ID_RE = /^[0-9]{1,20}$/;

/**
 * GET /api/world/players/by-ids?ids=111,222,333
 *
 * 指定した world_card_id のカード要約をまとめて返す（お気に入り / My Team の解決用）。
 * 保存済みの SQLite だけを参照。外部アクセスなし。最大 500 ID。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => WORLD_ID_RE.test(s));

  if (ids.length === 0) {
    return NextResponse.json({ players: [], requested: 0, found: 0 });
  }

  try {
    const players = await getPlayersByWorldIds(ids);
    const meta = await getSourceMeta();
    const res = NextResponse.json({
      players,
      requested: ids.length,
      found: players.length,
      source: meta.source,
      updatedAt: meta.syncFinishedAt,
    });
    if (process.env.NODE_ENV === "production") {
      res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
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
