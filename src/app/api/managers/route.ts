import { NextResponse } from "next/server";
import { parseManagerListQuery } from "@/lib/managers/schemas";
import { listManagers, ManagerDataUnavailableError } from "@/lib/managers/repository";
import { WorldQueryError } from "@/lib/world/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/managers?page=&pageSize=&q=&sort=&hasBooster=&hasLinkUpPlay=
 * 保存済みの監督データ（SQLite）だけを返す。外部アクセスなし。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = parseManagerListQuery({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
    q: searchParams.get("q"),
    sort: searchParams.get("sort"),
    hasBooster: searchParams.get("hasBooster"),
    hasLinkUpPlay: searchParams.get("hasLinkUpPlay"),
  });

  try {
    const result = listManagers(q);
    const res = NextResponse.json(result);
    if (process.env.NODE_ENV === "production") {
      res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    }
    return res;
  } catch (err) {
    if (err instanceof ManagerDataUnavailableError) {
      return NextResponse.json(
        { error: { code: "MANAGER_DATA_UNAVAILABLE", message: "監督データがまだ用意されていません。" } },
        { status: 503 },
      );
    }
    if (err instanceof WorldQueryError) {
      return NextResponse.json(
        { error: { code: "QUERY_FAILED", message: "監督データの照会に失敗しました。" } },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: { code: "UNEXPECTED", message: "予期しないエラーが発生しました。" } },
      { status: 500 },
    );
  }
}
