import { NextResponse } from "next/server";
import { getWorldBaseDistribution } from "@/lib/percentiles/world-base-server";

export const runtime = "nodejs";

/**
 * GET /api/percentiles/world-base — F-071 基礎能力値の分布（値ごとの件数・集計値だけ）。
 * applied-state と一致するときだけ中身を返す。それ以外は 200 で status だけ（画面は照合できない旨を表示する）。
 */
export async function GET() {
  const d = getWorldBaseDistribution();
  const body =
    d.status === "valid"
      ? {
          status: "valid" as const,
          generatedAt: d.artifact.generatedAt,
          datasetVersion: d.artifact.datasetVersion,
          recordCount: d.artifact.binding.recordCount,
          scopes: d.artifact.scopes,
        }
      : { status: d.status };
  const res = NextResponse.json(body);
  // 成果物はデプロイごとに固定。利用者データを含まない。
  res.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return res;
}
