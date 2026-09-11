import { NextResponse } from "next/server";
import { loadPlayers } from "@/lib/players";

export const dynamic = "force-dynamic";

/**
 * GET /api/data-status
 * データの取得元・取得日時・件数を返す内部API。
 */
export async function GET() {
  try {
    const { players, meta } = await loadPlayers();
    return NextResponse.json({
      hasData: players.length > 0,
      count: players.length,
      meta,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "DATA_READ_FAILED", message: "データ状態を取得できませんでした。" } },
      { status: 500 },
    );
  }
}
