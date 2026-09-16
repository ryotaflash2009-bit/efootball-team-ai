import { getDb, WorldQueryError, WorldDataUnavailableError } from "@/lib/world/db";
import type {
  ManagerDetail,
  ManagerListItem,
  ManagerListQuery,
  ManagerListResult,
  ManagerSortKey,
  TacticalProficiencies,
  ManagerBoosterEffect,
  LinkUpPlay,
} from "./types";
import { MANAGER_ID_RE } from "./schemas";
import { getWorldDataSource } from "@/lib/reference-data/runtime/data-source";
import { listManagersFromSupabase, getManagerByIdFromSupabase, getManagerCountFromSupabase } from "@/lib/reference-data/runtime/managers-source";

type Row = Record<string, unknown>;

export class ManagerDataUnavailableError extends WorldDataUnavailableError {}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : v == null || v === "" ? null : String(v);
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function ensureManagerTables(): void {
  const db = getDb();
  try {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('managers','manager_boosters','manager_link_up_plays')")
      .all() as { name: string }[];
    if (rows.length < 3) throw new ManagerDataUnavailableError("監督テーブルがありません（node scripts/sync-managers.mjs を実行）");
  } catch (e) {
    if (e instanceof ManagerDataUnavailableError) throw e;
    throw new ManagerDataUnavailableError();
  }
}

/**
 * 正式なタイブレーク規則(Phase Dで確定): 主ソートキー → name_en(NOCASE) → internal_manager_id ASC。
 * 最終タイブレークは主ソートの昇順・降順によらず常にASCで固定する
 * (world_player_cards側の既存規則「world_card_id ASCで固定」と同じ設計、Phase C以来の既存precedent)。
 *
 * 66件中16グループ(各2〜3件)で監督名が完全重複しており、さらに一部の主ソート値・name_enまで
 * 完全に一致する組が実在する(例: internal_manager_id 51/58の「Johan Cruyff」)。
 * この最終タイブレークが無いと、SQLiteは非公開のrowid等へ、PostgreSQLは別の内部順序へ
 * 依存する未定義動作になり、エンジン間で順序が一致しないことが実測で確認された。
 * これは「既存の意味のある表示仕様の変更」ではなく、これまで未定義だった完全同値レコード間の
 * 順序を初めて正式に決定するものとして扱う(ユーザーの明示判断)。
 *
 * NULL順序(released_at・overloadなど): SQLiteの既定動作(NULLは常に最小値として扱われるため、
 * ASCでは先頭、DESCでは末尾に来る)を正式仕様として維持する。この動作はSQLite側のクエリを
 * 変更しなくても既に得られるため、ORDER BY文字列自体は変更不要(Supabase側だけ、
 * PostgreSQLの既定NULL順序[ASCで末尾/DESCで先頭、SQLiteと正反対]に依存せず、
 * `nullsFirst`を明示してこの規則を再現する。managers-source.tsを参照)。
 */
const ORDER_BY: Record<ManagerSortKey, string> = {
  name: "m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  released_desc: "m.released_at DESC, m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  released_asc: "m.released_at ASC, m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  possession_desc: "m.possession_game DESC, m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  quick_counter_desc: "m.quick_counter DESC, m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  long_ball_counter_desc: "m.long_ball_counter DESC, m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  out_wide_desc: "m.out_wide DESC, m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  long_ball_desc: "m.long_ball DESC, m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  overload_desc: "m.overload DESC, m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
};

function proficienciesFromRow(r: Row): TacticalProficiencies {
  return {
    possessionGame: num(r.possession_game),
    quickCounter: num(r.quick_counter),
    longBallCounter: num(r.long_ball_counter),
    outWide: num(r.out_wide),
    longBall: num(r.long_ball),
    overload: num(r.overload),
  };
}

function rowToListItem(r: Row, boosterSummary: string[]): ManagerListItem {
  return {
    internalManagerId: Number(r.internal_manager_id),
    source: String(r.source),
    sourceManagerId: String(r.source_manager_id),
    nameEn: String(r.name_en),
    nameJa: str(r.name_ja),
    teamName: str(r.team_name),
    nationality: str(r.nationality),
    age: num(r.age),
    releasedAt: str(r.released_at),
    proficiencies: proficienciesFromRow(r),
    managerRating: str(r.manager_rating),
    coachingAffinity: str(r.coaching_affinity),
    formation: str(r.formation),
    hasBooster: Number(r.has_booster) === 1,
    hasLinkUpPlay: Number(r.has_link_up_play) === 1,
    boosterConfirmation: (str(r.booster_confirmation) as ManagerListItem["boosterConfirmation"]) ?? "unresolved",
    boosterSummary,
  };
}

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function listManagers(q: ManagerListQuery): Promise<ManagerListResult> {
  if (getWorldDataSource() === "supabase") return listManagersFromSupabase(q);
  return listManagersSqlite(q);
}

function listManagersSqlite(q: ManagerListQuery): ManagerListResult {
  ensureManagerTables();
  const db = getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (q.query) {
    const like = `%${escapeLike(q.query.toLowerCase())}%`;
    clauses.push("(LOWER(m.name_en) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(m.team_name,'')) LIKE ? ESCAPE '\\' OR m.source_manager_id = ?)");
    params.push(like, like, q.query);
  }
  if (q.hasBooster === true) clauses.push("m.has_booster = 1");
  else if (q.hasBooster === false) clauses.push("m.has_booster = 0");
  if (q.hasLinkUpPlay === true) clauses.push("m.has_link_up_play = 1");
  else if (q.hasLinkUpPlay === false) clauses.push("m.has_link_up_play = 0");

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  let totalCount: number;
  try {
    totalCount = Number((db.prepare(`SELECT COUNT(*) n FROM managers m ${where}`).get(...params) as { n: number }).n);
  } catch {
    throw new WorldQueryError();
  }
  const totalPages = Math.max(1, Math.ceil(totalCount / q.pageSize));
  const page = Math.min(q.page, totalPages);
  const offset = (page - 1) * q.pageSize;

  let rows: Row[];
  try {
    rows = db
      .prepare(`SELECT m.* FROM managers m ${where} ORDER BY ${ORDER_BY[q.sort]} LIMIT ? OFFSET ?`)
      .all(...params, q.pageSize, offset) as Row[];
  } catch {
    throw new WorldQueryError();
  }

  const ids = rows.map((r) => Number(r.internal_manager_id));
  const summaries = new Map<number, string[]>();
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const bRows = db
      .prepare(`SELECT internal_manager_id, stat_name_en, delta FROM manager_boosters WHERE internal_manager_id IN (${placeholders}) ORDER BY display_order`)
      .all(...ids) as Row[];
    for (const b of bRows) {
      const mid = Number(b.internal_manager_id);
      const arr = summaries.get(mid) ?? [];
      arr.push(`${String(b.stat_name_en)} ${Number(b.delta) >= 0 ? "+" : ""}${Number(b.delta)}`);
      summaries.set(mid, arr);
    }
  }

  return {
    managers: rows.map((r) => rowToListItem(r, summaries.get(Number(r.internal_manager_id)) ?? [])),
    page,
    pageSize: q.pageSize,
    totalCount,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
    source: "amine250/efootball-managers",
  };
}

export async function getManagerById(internalManagerId: string | number): Promise<ManagerDetail | null> {
  if (getWorldDataSource() === "supabase") return getManagerByIdFromSupabase(internalManagerId);
  return getManagerByIdSqlite(internalManagerId);
}

function getManagerByIdSqlite(internalManagerId: string | number): ManagerDetail | null {
  const idStr = String(internalManagerId);
  if (!MANAGER_ID_RE.test(idStr)) return null;
  ensureManagerTables();
  const db = getDb();

  let mRow: Row | undefined;
  let bRows: Row[] = [];
  let lupRows: Row[] = [];
  let lupCondRows: Row[] = [];
  try {
    mRow = db.prepare("SELECT * FROM managers WHERE internal_manager_id = ?").get(Number(idStr)) as Row | undefined;
    if (!mRow) return null;
    bRows = db.prepare("SELECT * FROM manager_boosters WHERE internal_manager_id = ? ORDER BY display_order").all(Number(idStr)) as Row[];
    lupRows = db.prepare("SELECT * FROM manager_link_up_plays WHERE internal_manager_id = ? ORDER BY display_order").all(Number(idStr)) as Row[];
    const lupIds = lupRows.map((r) => Number(r.id));
    if (lupIds.length > 0) {
      const ph = lupIds.map(() => "?").join(",");
      lupCondRows = db.prepare(`SELECT * FROM manager_link_up_conditions WHERE link_up_play_id IN (${ph})`).all(...lupIds) as Row[];
    }
  } catch {
    throw new WorldQueryError();
  }

  const boosters: ManagerBoosterEffect[] = bRows.map((b) => ({
    statNameEn: String(b.stat_name_en),
    statKey: str(b.stat_key),
    delta: Number(b.delta),
    rawValue: String(b.raw_value),
    applicationCondition: str(b.application_condition),
    confirmationStatus: (str(b.confirmation_status) as ManagerBoosterEffect["confirmationStatus"]) ?? "unresolved",
  }));

  const condByLup = new Map<number, Row[]>();
  for (const c of lupCondRows) {
    const k = Number(c.link_up_play_id);
    const arr = condByLup.get(k) ?? [];
    arr.push(c);
    condByLup.set(k, arr);
  }
  const linkUpPlays: LinkUpPlay[] = lupRows.map((lu) => {
    const conds = condByLup.get(Number(lu.id)) ?? [];
    const pick = (role: string) => {
      const c = conds.find((x) => x.role === role);
      if (!c) return null;
      let positions: string[] = [];
      try {
        const p = JSON.parse(String(c.positions_json ?? "[]"));
        if (Array.isArray(p)) positions = p.map(String);
      } catch {
        /* ignore */
      }
      return { role: role as "centerPiece" | "keyMan", playingStyle: str(c.playing_style), positions };
    };
    return {
      name: String(lu.name),
      centerPiece: pick("centerPiece"),
      keyMan: pick("keyMan"),
      confirmationStatus: (str(lu.confirmation_status) as LinkUpPlay["confirmationStatus"]) ?? "provisional",
    };
  });

  const summary = boosters.map((b) => `${b.statNameEn} ${b.delta >= 0 ? "+" : ""}${b.delta}`);

  return {
    ...rowToListItem(mRow, summary),
    boosters,
    linkUpPlays,
    sourceUrl: String(mRow.source_url ?? ""),
    fetchedAt: str(mRow.fetched_at),
  };
}

export async function getManagerCount(): Promise<number> {
  if (getWorldDataSource() === "supabase") return getManagerCountFromSupabase();
  return getManagerCountSqlite();
}

function getManagerCountSqlite(): number {
  ensureManagerTables();
  const db = getDb();
  try {
    return Number((db.prepare("SELECT COUNT(*) n FROM managers").get() as { n: number }).n);
  } catch {
    throw new WorldQueryError();
  }
}
