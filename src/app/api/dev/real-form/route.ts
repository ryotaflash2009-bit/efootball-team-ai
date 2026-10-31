import { NextResponse } from "next/server";
import { areInternalPagesVisible } from "@/lib/public-info/internal-pages";
import { parseRealForm } from "@/lib/dev/real-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ローカルのサッカー AI（このPCの中だけで動く）。外部のサーバーへは送らない。 */
const LOCAL_SOCCER_AI = "http://127.0.0.1:7870";
const TIMEOUT_MS = 15_000;

/**
 * GET /api/dev/real-form?name=<英語の名前>（開発用・2026-10-31）
 *
 * 内部ページを有効にしたビルド（`areInternalPagesVisible`）でだけ動く。それ以外（本番・Preview）は 404。
 * サーバーの中から 127.0.0.1:7870 の /player_form を読み（ブラウザーからは CORS で読めないため）、形を確かめて返す。
 * カードの選手と同じかどうか（名前・国籍）は画面の側で確かめる。保存はしない。
 */
export async function GET(request: Request) {
  if (!areInternalPagesVisible()) return NextResponse.json({ ok: false }, { status: 404 });
  const name = (new URL(request.url).searchParams.get("name") ?? "").trim();
  if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) return NextResponse.json({ ok: false, error: "bad_name" }, { status: 400 });
  try {
    const res = await fetch(`${LOCAL_SOCCER_AI}/player_form?name=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    const form = res.ok ? parseRealForm(await res.json()) : null;
    return NextResponse.json(form ? { ok: true, form } : { ok: false, error: "not_found" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { headers: { "Cache-Control": "no-store" } });
  }
}
