import { getDb, WorldQueryError } from "./db";
import { buildWhere, orderByClause, CARD_COLUMNS, CARD_FROM } from "./queries";
import { rowToListItem, rowsToStats, rowToAppearance } from "./mappers";
import type {
  WorldListQuery,
  WorldListResult,
  WorldPlayerDetail,
  WorldPlayerListItem,
  WorldFacets,
  WorldSourceMeta,
  WorldEfhubConflict,
} from "./types";
import { WORLD_CARD_ID_RE } from "./schemas";
import { getWorldDataSource } from "@/lib/reference-data/runtime/data-source";
import {
  listPlayersFromSupabase,
  getPlayerByWorldIdFromSupabase,
  getPlayersByWorldIdsFromSupabase,
  getWorldImageUrlsFromSupabase,
  getFacetsFromSupabase,
  getSourceMetaFromSupabase,
  _resetFacetCacheForSupabase,
} from "@/lib/reference-data/runtime/world-source";

type Row = Record<string, unknown>;

/**
 * データソース抽象化: `WORLD_DATA_SOURCE`環境変数に応じて、既存のSQLite実装
 * (`*Sqlite`、挙動は完全に既存のまま無変更)とSupabase実装(`runtime/world-source.ts`)を
 * 切り替える。既定は"supabase"(Phase E)。`WORLD_DATA_SOURCE=sqlite`を明示指定すれば
 * この分岐でSQLite実装へ戻る(切戻し経路)。関数はいずれの経路でも同じPromiseを返す
 * (SQLite経路は同期処理をそのままPromiseで包むだけで、処理内容自体は変えない)。
 * Supabase経路が失敗した場合もSQLiteへの暗黙フォールバックは行わない(呼び出し元へ
 * そのままエラーを伝播する)。
 */

/** 一覧: 検索 + フィルタ + 並べ替え + サーバー側ページネーション */
export async function listPlayers(q: WorldListQuery): Promise<WorldListResult> {
  if (getWorldDataSource() === "supabase") return listPlayersFromSupabase(q);
  return listPlayersSqlite(q);
}

function listPlayersSqlite(q: WorldListQuery): WorldListResult {
  const db = getDb();
  const { sql: where, params } = buildWhere(q);

  let totalCount: number;
  try {
    const countRow = db
      .prepare(`SELECT COUNT(*) AS n ${CARD_FROM} ${where}`)
      .get(...params) as { n: number } | undefined;
    totalCount = Number(countRow?.n ?? 0);
  } catch {
    throw new WorldQueryError();
  }

  const totalPages = q.pageSize > 0 ? Math.max(1, Math.ceil(totalCount / q.pageSize)) : 1;
  const page = Math.min(q.page, totalPages);
  const offset = (page - 1) * q.pageSize;

  let rows: Row[];
  try {
    rows = db
      .prepare(
        `SELECT ${CARD_COLUMNS} ${CARD_FROM} ${where} ${orderByClause(q.sort)} LIMIT ? OFFSET ?`,
      )
      .all(...params, q.pageSize, offset) as Row[];
  } catch {
    throw new WorldQueryError();
  }

  const players = rows.map(rowToListItem);

  return {
    players,
    page,
    pageSize: q.pageSize,
    totalCount,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
    appliedFilters: buildAppliedFilters(q),
  };
}

function buildAppliedFilters(q: WorldListQuery): Record<string, string | number | boolean> {
  const f: Record<string, string | number | boolean> = { sort: q.sort };
  if (q.query) f.query = q.query;
  if (q.position) f.position = q.position;
  if (q.cardType) f.cardType = q.cardType;
  if (q.playingStyle) f.playingStyle = q.playingStyle;
  if (q.playingStyleDefensive) f.playingStyleDef = q.playingStyleDefensive;
  if (q.minOvr != null) f.minOvr = q.minOvr;
  if (q.maxOvr != null) f.maxOvr = q.maxOvr;
  if (q.hasBooster != null) f.hasBooster = q.hasBooster;
  return f;
}

/** 詳細: world_card_id 1 件（見つからなければ null） */
export async function getPlayerByWorldId(worldCardId: string): Promise<WorldPlayerDetail | null> {
  if (getWorldDataSource() === "supabase") return getPlayerByWorldIdFromSupabase(worldCardId);
  return getPlayerByWorldIdSqlite(worldCardId);
}

function getPlayerByWorldIdSqlite(worldCardId: string): WorldPlayerDetail | null {
  if (!WORLD_CARD_ID_RE.test(worldCardId)) return null;
  const db = getDb();

  let cardRow: Row | undefined;
  try {
    cardRow = db
      .prepare(`SELECT ${CARD_COLUMNS}, lw.internal_card_id AS internal_card_id ${CARD_FROM} WHERE c.world_card_id = ?`)
      .get(worldCardId) as Row | undefined;
  } catch {
    throw new WorldQueryError();
  }
  if (!cardRow) return null;

  const base = rowToListItem(cardRow);

  let statRows: Row[] = [];
  let skillRows: Row[] = [];
  let aiRows: Row[] = [];
  let appRow: Row | undefined;
  let conflictRows: Row[] = [];
  try {
    statRows = db
      .prepare("SELECT stat_key, value FROM world_player_stats WHERE world_card_id = ? AND stat_kind = 'base'")
      .all(worldCardId) as Row[];
    skillRows = db
      .prepare("SELECT skill_name FROM world_player_skills WHERE world_card_id = ? ORDER BY display_order ASC")
      .all(worldCardId) as Row[];
    aiRows = db
      .prepare("SELECT style_name FROM world_player_ai_styles WHERE world_card_id = ? ORDER BY display_order ASC")
      .all(worldCardId) as Row[];
    appRow = db
      .prepare("SELECT * FROM world_player_appearances WHERE world_card_id = ?")
      .get(worldCardId) as Row | undefined;

    const internalId = cardRow.internal_card_id;
    if (internalId != null) {
      conflictRows = db
        .prepare(
          "SELECT field_name, efhub_value, world_value FROM data_conflicts WHERE internal_card_id = ? AND resolution_status = 'open'",
        )
        .all(Number(internalId)) as Row[];
    }
  } catch {
    throw new WorldQueryError();
  }

  const efhubConflicts: WorldEfhubConflict[] = conflictRows.map((r) => ({
    fieldName: String(r.field_name),
    efhubValue: r.efhub_value == null ? null : String(r.efhub_value),
    worldValue: r.world_value == null ? null : String(r.world_value),
  }));

  return {
    ...base,
    stats: rowsToStats(statRows),
    playerSkills: dedupeStrings(skillRows.map((r) => String(r.skill_name))),
    aiStyles: dedupeStrings(aiRows.map((r) => String(r.style_name))),
    appearance: rowToAppearance(appRow),
    source: "world",
    sourceUrl: String(cardRow.source_url ?? "https://efootball-world.com/api/proxy/v1/api/players/search"),
    fetchedAt: cardRow.fetched_at == null ? null : String(cardRow.fetched_at),
    efhubConflicts,
  };
}

/**
 * 複数の world_card_id をまとめて取得（お気に入り / My Team の解決用・読み取り専用）。
 * 見つからなかった ID は結果に含まれない。入力上限あり（DoS 回避）。順序は入力順を尊重。
 */
export async function getPlayersByWorldIds(ids: string[]): Promise<WorldPlayerListItem[]> {
  if (getWorldDataSource() === "supabase") return getPlayersByWorldIdsFromSupabase(ids);
  return getPlayersByWorldIdsSqlite(ids);
}

function getPlayersByWorldIdsSqlite(ids: string[]): WorldPlayerListItem[] {
  const clean = Array.from(new Set(ids.filter((id) => WORLD_CARD_ID_RE.test(id)))).slice(0, 500);
  if (clean.length === 0) return [];
  const db = getDb();
  const placeholders = clean.map(() => "?").join(",");
  let rows: Row[];
  try {
    rows = db
      .prepare(`SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE c.world_card_id IN (${placeholders})`)
      .all(...clean) as Row[];
  } catch {
    throw new WorldQueryError();
  }
  const byId = new Map(rows.map((r) => [String(r.world_card_id), rowToListItem(r)]));
  return clean.map((id) => byId.get(id)).filter((p): p is WorldPlayerListItem => p != null);
}

/** 画像プロキシ用: 保存済みの画像 URL を取得（見つからなければ null） */
export async function getWorldImageUrls(
  worldCardId: string,
): Promise<{ imageUrl: string | null; mobileImageUrl: string | null } | null> {
  if (getWorldDataSource() === "supabase") return getWorldImageUrlsFromSupabase(worldCardId);
  return getWorldImageUrlsSqlite(worldCardId);
}

function getWorldImageUrlsSqlite(worldCardId: string): { imageUrl: string | null; mobileImageUrl: string | null } | null {
  if (!WORLD_CARD_ID_RE.test(worldCardId)) return null;
  const db = getDb();
  let row: Row | undefined;
  try {
    row = db
      .prepare("SELECT image_url, mobile_image_url FROM world_player_cards WHERE world_card_id = ?")
      .get(worldCardId) as Row | undefined;
  } catch {
    throw new WorldQueryError();
  }
  if (!row) return null;
  return {
    imageUrl: typeof row.image_url === "string" && row.image_url !== "" ? row.image_url : null,
    mobileImageUrl:
      typeof row.mobile_image_url === "string" && row.mobile_image_url !== "" ? row.mobile_image_url : null,
  };
}

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

// ---- フィルタ選択肢（distinct 値。プロセス内キャッシュ） ----

let facetCache: WorldFacets | null = null;

export async function getFacets(): Promise<WorldFacets> {
  if (getWorldDataSource() === "supabase") return getFacetsFromSupabase();
  return getFacetsSqlite();
}

function getFacetsSqlite(): WorldFacets {
  if (facetCache) return facetCache;
  const db = getDb();
  try {
    const distinct = (col: string): string[] =>
      (db.prepare(`SELECT DISTINCT ${col} AS v FROM world_player_cards WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY ${col} ASC`).all() as { v: string }[])
        .map((r) => r.v);
    facetCache = {
      positions: distinct("registered_position"),
      cardTypes: distinct("card_type"),
      playingStyles: distinct("playing_style"),
      playingStyleDefensives: distinct("playing_style_def"),
    };
  } catch {
    throw new WorldQueryError();
  }
  return facetCache;
}

// ---- データソースのメタ情報 ----

export async function getSourceMeta(): Promise<WorldSourceMeta> {
  if (getWorldDataSource() === "supabase") return getSourceMetaFromSupabase();
  return getSourceMetaSqlite();
}

function getSourceMetaSqlite(): WorldSourceMeta {
  const db = getDb();
  try {
    const total = db.prepare("SELECT COUNT(*) AS n FROM world_player_cards").get() as { n: number };
    const state = Object.fromEntries(
      (db.prepare("SELECT key, value FROM world_sync_state").all() as { key: string; value: string }[]).map((r) => [r.key, r.value]),
    );
    const run = db
      .prepare("SELECT finished_at, status FROM world_sync_runs WHERE kind = 'world-initial' ORDER BY id DESC LIMIT 1")
      .get() as { finished_at: string | null; status: string | null } | undefined;
    return {
      source: "eFootball World",
      sourceUrl: "https://efootball-world.com/api/proxy/v1/api/players/search",
      totalCount: Number(total?.n ?? 0),
      syncFinishedAt: run?.finished_at ?? null,
      syncStatus: state.world_initial_status ?? run?.status ?? null,
    };
  } catch {
    throw new WorldQueryError();
  }
}

export function _resetFacetCache(): void {
  facetCache = null;
  _resetFacetCacheForSupabase();
}
