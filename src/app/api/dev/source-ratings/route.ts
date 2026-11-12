import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/world/db";
import { getWorldDataSource } from "@/lib/reference-data/runtime/data-source";
import { getReferenceDataClient } from "@/lib/reference-data/runtime/supabase-client";
import { listProvisionalRows } from "@/lib/reference-data/provisional/provisional-cards";
import { isLocalRequest, isSourceRatingsEnabled, resolveRecordCards, sourceRatingsFileSchema, type ResolverCard, type SourceRatingsFile } from "@/lib/dev/source-ratings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** このPCのクローラーが書き出す受け渡しファイル（/data は Git の対象外 → 本番には存在しない）。 */
const SOURCE_RATINGS_FILE = path.join(process.cwd(), "data", "external", "crawler", "latest_ratings.json");
const NO_STORE = { "Cache-Control": "no-store" };
const CARD_COLUMNS = "world_card_id,name_ja,name_en,card_type,maximum_level,ovr_base,ovr_max,stats,skills,playing_style";
const CARD_PAGE_SIZE = 1000;
const CARD_CACHE_MS = 30 * 60 * 1000;

type CardRow = Record<string, unknown>;

function rowToCard(row: CardRow): ResolverCard {
  return {
    worldCardId: String(row.world_card_id),
    nameJa: (row.name_ja as string | null) ?? null,
    nameEn: (row.name_en as string | null) ?? null,
    cardType: (row.card_type as string | null) ?? null,
    maximumLevel: (row.maximum_level as number | null) ?? null,
    ovrBase: (row.ovr_base as number | null) ?? null,
    ovrMax: (row.ovr_max as number | null) ?? null,
    stats: (row.stats as Record<string, number> | null) ?? {},
    playStyle: (row.playing_style as string | null) ?? null,
    skills: Array.isArray(row.skills) ? (row.skills as unknown[]).filter((s): s is string => typeof s === "string" && s !== "-") : undefined,
  };
}

async function loadSupabaseRows(): Promise<CardRow[]> {
  const rows: CardRow[] = [];
  for (let from = 0; ; from += CARD_PAGE_SIZE) {
    const { data, error } = await getReferenceDataClient()
      .from("world_player_cards")
      .select(CARD_COLUMNS)
      .order("world_card_id")
      .range(from, from + CARD_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data as unknown as CardRow[]));
    if (data.length < CARD_PAGE_SIZE) return rows;
  }
}

function loadSqliteRows(): CardRow[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT world_card_id, name_ja, name_en, card_type, maximum_level, ovr_base, ovr_max FROM world_player_cards")
    .all() as unknown as CardRow[];
  const stats = new Map<string, Record<string, number>>();
  for (const s of db.prepare("SELECT world_card_id AS id, stat_key AS k, value AS v FROM world_player_stats WHERE stat_kind = 'base'").all() as unknown as { id: string; k: string; v: number }[]) {
    const own = stats.get(s.id);
    if (own) own[s.k] = s.v;
    else stats.set(s.id, { [s.k]: s.v });
  }
  return rows.map((r) => ({ ...r, stats: stats.get(String(r.world_card_id)) ?? {} }));
}

let cardCache: { at: number; cards: ResolverCard[] } | null = null;

/** アプリが表示に使うカード（World と暫定。World に同じ番号があれば World を優先）。読み直しは 30 分に 1 回。 */
async function loadCards(): Promise<ResolverCard[]> {
  if (cardCache && Date.now() - cardCache.at < CARD_CACHE_MS) return cardCache.cards;
  const world = getWorldDataSource() === "sqlite" ? loadSqliteRows() : await loadSupabaseRows();
  const ids = new Set(world.map((r) => String(r.world_card_id)));
  const rows = [...world, ...listProvisionalRows().filter((r) => !ids.has(String(r.world_card_id)))];
  const cards = rows.map(rowToCard);
  cardCache = { at: Date.now(), cards };
  return cards;
}

/** カード番号の無い記録を、カードデータと突き合わせる。読めなければファイルのまま返す（画面は名前と総合値の照合になる）。 */
async function withResolvedCards(file: SourceRatingsFile): Promise<SourceRatingsFile> {
  try {
    return resolveRecordCards(file, await loadCards());
  } catch {
    return file;
  }
}

/**
 * GET /api/dev/source-ratings（開発用・2026-11-04）
 *
 * `next dev` で、かつ localhost から開いたときだけ受け渡しファイルを返す。それ以外（本番・Preview・LAN の IP など）は 404。
 * 内部ページの `NEXT_PUBLIC_EFTA_INTERNAL_PAGES` では有効にならない（{@link isSourceRatingsEnabled}）。
 * 形を確かめ、カード番号の無い記録をカードデータと突き合わせてから返す。保存・外部への送信はしない。
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
    return NextResponse.json({ ok: true, file: await withResolvedCards(parsed.data) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { headers: NO_STORE });
  }
}
