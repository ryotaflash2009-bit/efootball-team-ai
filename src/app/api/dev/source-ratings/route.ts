import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/world/db";
import { isLocalRequest, isSourceRatingsEnabled, resolveRecordCards, sourceRatingsFileSchema, type ResolverCard, type SourceRatingsFile } from "@/lib/dev/source-ratings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** このPCのクローラーが書き出す受け渡しファイル（/data は Git の対象外 → 本番には存在しない）。 */
const SOURCE_RATINGS_FILE = path.join(process.cwd(), "data", "external", "crawler", "latest_ratings.json");
const NO_STORE = { "Cache-Control": "no-store" };

/** カード番号の無い記録を、ローカルの World データ（読み取り専用）と突き合わせる。DB が使えなければファイルのまま返す。 */
function withResolvedCards(file: SourceRatingsFile): SourceRatingsFile {
  try {
    const db = getDb();
    const cards = db
      .prepare("SELECT world_card_id AS worldCardId, name_ja AS nameJa, name_en AS nameEn, card_type AS cardType, maximum_level AS maximumLevel, ovr_base AS ovrBase, ovr_max AS ovrMax FROM world_player_cards")
      .all() as unknown as ResolverCard[];
    const stats = db.prepare("SELECT stat_key AS k, value AS v FROM world_player_stats WHERE world_card_id = ? AND stat_kind = 'base'");
    return resolveRecordCards(file, cards, (id) => Object.fromEntries((stats.all(id) as unknown as { k: string; v: number }[]).map((r) => [r.k, r.v])));
  } catch {
    return file;
  }
}

/**
 * GET /api/dev/source-ratings（開発用・2026-11-04）
 *
 * `next dev` で、かつ localhost から開いたときだけ受け渡しファイルを返す。それ以外（本番・Preview・LAN の IP など）は 404。
 * 内部ページの `NEXT_PUBLIC_EFTA_INTERNAL_PAGES` では有効にならない（{@link isSourceRatingsEnabled}）。
 * 形を確かめ、カード番号の無い記録をローカルの World データと突き合わせてから返す。保存・外部への送信はしない。
 */
export async function GET(request: Request) {
  if (!isSourceRatingsEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  if (!isLocalRequest(request.headers)) return NextResponse.json({ ok: false }, { status: 404 });
  let raw: string;
  try {
    raw = await readFile(SOURCE_RATINGS_FILE, "utf8");
  } catch {
    return NextResponse.json({ ok: false, error: "missing" }, { headers: NO_STORE });
  }
  try {
    const parsed = sourceRatingsFileSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid" }, { headers: NO_STORE });
    return NextResponse.json({ ok: true, file: withResolvedCards(parsed.data) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { headers: NO_STORE });
  }
}
