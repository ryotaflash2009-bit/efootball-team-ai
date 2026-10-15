import dataJson from "./data/provisional-cards.json";

/**
 * 暫定のカード（2026-10-15・本人の指示「なんとしてでも最新の情報に」）。
 *
 * - eFootball World（主の取得元）にまだ載っていない新しいカードを、PES Master から作った行（reference_data.world_player_cards と同じ形）で補う。
 *   作るのは GitHub Actions（scripts/provisional-cards-sync.mjs）で、このファイルの JSON を main へ入れる。DB には書かない。
 * - World に同じ ID が載ったら、同期で JSON から外れる（正式なデータに置き換わる）。読む側でも World の行があれば World を優先する。
 * - 最大レベルは PES Master の利用者の投稿で、分からなければ null（育成の計算は出さない）。
 */
export const PROVISIONAL_SOURCE = "pesmaster.com";
export const PROVISIONAL_SCHEMA = "provisional-world-cards/v1";

export interface ProvisionalInfo {
  source: typeof PROVISIONAL_SOURCE;
  sourceUrl: string;
  firstSeenAt: string | null;
  /** "pesmaster_user_submitted"（PES Master の利用者の投稿）か null（最大レベルが不明）。 */
  maxLevelSource: string | null;
}

type Row = Record<string, unknown>;
const ID_RE = /^\d{10,20}$/;
const STAT_COUNT = 26;

/** 形の正しい行だけを使う（壊れた行は捨てる・推測で埋めない）。 */
export function validProvisionalRows(raw: unknown): Row[] {
  const d = raw as { schema?: unknown; cards?: unknown };
  if (!d || d.schema !== PROVISIONAL_SCHEMA || !Array.isArray(d.cards)) return [];
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const r of d.cards as Row[]) {
    if (!r || typeof r !== "object") continue;
    const id = String(r.world_card_id ?? "");
    if (!ID_RE.test(id) || seen.has(id)) continue;
    if (typeof r.name_en !== "string" || !r.name_en.trim()) continue;
    if (r.source !== PROVISIONAL_SOURCE) continue;
    const stats = r.stats as Record<string, unknown> | null;
    if (!stats || typeof stats !== "object" || Object.values(stats).filter((v) => Number.isInteger(v)).length !== STAT_COUNT) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

const ROWS = validProvisionalRows(dataJson);
const BY_ID = new Map(ROWS.map((r) => [String(r.world_card_id), r]));

export function provisionalInfoOf(row: Row): ProvisionalInfo {
  return {
    source: PROVISIONAL_SOURCE,
    sourceUrl: typeof row.source_url === "string" ? row.source_url : "https://www.pesmaster.com/",
    firstSeenAt: typeof row.first_seen_at === "string" ? row.first_seen_at : null,
    maxLevelSource: typeof row.max_level_source === "string" ? row.max_level_source : null,
  };
}

export function getProvisionalRow(worldCardId: string): Row | null {
  return BY_ID.get(worldCardId) ?? null;
}

/** 暫定のカード（新しく見つかった順）。 */
export function listProvisionalRows(): Row[] {
  return [...ROWS].sort((a, b) => String(b.first_seen_at ?? "").localeCompare(String(a.first_seen_at ?? "")) || String(a.world_card_id).localeCompare(String(b.world_card_id)));
}

export function provisionalUpdatedAt(): string | null {
  const u = (dataJson as { updatedAt?: unknown }).updatedAt;
  return typeof u === "string" ? u : null;
}
