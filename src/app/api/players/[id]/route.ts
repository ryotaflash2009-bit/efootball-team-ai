import { NextResponse } from "next/server";
import { getPlayerById } from "@/lib/players";

export const dynamic = "force-dynamic";

/**
 * GET /api/players/:id
 * 選手1件を返す内部API。見つからなければ 404。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  try {
    const { player, meta } = await getPlayerById(decodedId);
    if (!player) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "選手が見つかりません。" } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      player,
      source: meta?.source ?? null,
      sourceUrl: meta?.sourceUrl ?? null,
      method: meta?.method ?? null,
      fetchedAt: meta?.fetchedAt ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "DATA_READ_FAILED", message: "選手データを読み込めませんでした。" } },
      { status: 500 },
    );
  }
}
