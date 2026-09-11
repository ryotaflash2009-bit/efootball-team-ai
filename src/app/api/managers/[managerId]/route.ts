import { NextResponse } from "next/server";
import { getManagerById, ManagerDataUnavailableError } from "@/lib/managers/repository";
import { MANAGER_ID_RE } from "@/lib/managers/schemas";
import { WorldQueryError } from "@/lib/world/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/managers/:managerId — 監督1件（ブースター・Link-Up Play を含む） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ managerId: string }> },
) {
  const { managerId } = await params;
  const decoded = decodeURIComponent(managerId);
  if (!MANAGER_ID_RE.test(decoded)) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "監督 ID の形式が正しくありません。" } },
      { status: 400 },
    );
  }

  try {
    const manager = getManagerById(decoded);
    if (!manager) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "監督が見つかりません。" } },
        { status: 404 },
      );
    }
    const res = NextResponse.json({ manager });
    if (process.env.NODE_ENV === "production") {
      res.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
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
