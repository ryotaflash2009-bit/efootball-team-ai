import { NextResponse } from "next/server";
import { buildIntentExtractionRequestSchema, getBuildIntentExtractor } from "@/lib/ai/build-intent-extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/build-intent/extract — 自由記述(「育成の狙い」)から育成意図を構造化抽出する。
 *
 * 安全設計:
 * - この環境にはAIプロバイダー・APIキーが一切存在しないため、実際には常に NOT_CONFIGURED を返す
 *   (getBuildIntentExtractor() を参照)。「解析に成功したふり」はしない。
 * - Content-Type / JSONスキーマ / 文字数上限を境界で検証し、不正な入力は 400 で拒否する。
 * - タイムアウトを設けてハングを防ぐ(AbortController)。
 * - 自由文全文をログへ出力しない(エラー時も本文を含めない)。
 * - 簡易的な同時実行/連投対策(プロセス内メモリのみ・ベストエフォート。分散環境や複数プロセスでは
 *   有効に機能しない既知の制限。本番運用には認証・専用のレート制限基盤が別途必要)。
 */

const REQUEST_TIMEOUT_MS = 10_000;

// プロセス内メモリのみのベストエフォート・スロットリング(既知の制限: 再起動で消える・分散環境では効かない)。
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const recentRequestTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  while (recentRequestTimestamps.length > 0 && now - recentRequestTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    recentRequestTimestamps.shift();
  }
  if (recentRequestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) return true;
  recentRequestTimestamps.push(now);
  return false;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Content-Type must be application/json." } }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "リクエスト本文が正しいJSONではありません。" } }, { status: 400 });
  }

  const parsed = buildIntentExtractionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "リクエストの形式が正しくありません。" } }, { status: 400 });
  }

  if (isRateLimited()) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "リクエストが多すぎます。しばらく待ってから再試行してください。" } }, { status: 429 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const extractor = getBuildIntentExtractor();
    // 注意: parsed.data.freeText はこの先いかなるログ出力にも含めない(自由文全文をログへ出さない方針)。
    const result = await extractor.extract(parsed.data, controller.signal);
    clearTimeout(timer);

    if (!result.ok) {
      const status =
        result.error.code === "NOT_CONFIGURED"
          ? 200
          : result.error.code === "RATE_LIMITED"
            ? 429
            : result.error.code === "TIMEOUT"
              ? 504
              : result.error.code === "INVALID_RESPONSE"
                ? 502
                : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ extraction: result.extraction }, { status: 200 });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ error: { code: "UNKNOWN", message: "予期しないエラーが発生しました。" } }, { status: 500 });
  }
}
