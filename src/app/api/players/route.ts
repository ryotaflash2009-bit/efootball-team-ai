import { NextResponse } from "next/server";
import { loadPlayers, parseSortKey, queryPlayers } from "@/lib/players";

export const dynamic = "force-dynamic";

/**
 * GET /api/players?q=<検索語>&sort=<ovr_desc|ovr_asc|name>&limit=<1-100>
 * 一覧・検索・並べ替えの内部API。外部サイトは呼ばず、保存済みデータだけを返す。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const sort = parseSortKey(searchParams.get("sort"));

  const rawLimit = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.trunc(rawLimit), 100) : 100;

  try {
    const { players, meta } = await loadPlayers();
    const { players: visible, total } = queryPlayers(players, { q, sort, limit });
    return NextResponse.json({
      players: visible,
      total,
      limit,
      source: meta?.source ?? null,
      fetchedAt: meta?.fetchedAt ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "DATA_READ_FAILED", message: "選手データを読み込めませんでした。" } },
      { status: 500 },
    );
  }
}
