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

const ORDER_BY: Record<ManagerSortKey, string> = {
  name: "m.name_en COLLATE NOCASE ASC, m.internal_manager_id ASC",
  released_desc: "m.released_at DESC, m.name_en COLLATE NOCASE ASC",
  released_asc: "m.released_at ASC, m.name_en COLLATE NOCASE ASC",
  possession_desc: "m.possession_game DESC, m.name_en COLLATE NOCASE ASC",
  quick_counter_desc: "m.quick_counter DESC, m.name_en COLLATE NOCASE ASC",
  long_ball_counter_desc: "m.long_ball_counter DESC, m.name_en COLLATE NOCASE ASC",
  out_wide_desc: "m.out_wide DESC, m.name_en COLLATE NOCASE ASC",
  long_ball_desc: "m.long_ball DESC, m.name_en COLLATE NOCASE ASC",
  overload_desc: "m.overload DESC, m.name_en COLLATE NOCASE ASC",
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

export function listManagers(q: ManagerListQuery): ManagerListResult {
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

export function getManagerById(internalManagerId: string | number): ManagerDetail | null {
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

export function getManagerCount(): number {
  ensureManagerTables();
  const db = getDb();
  try {
    return Number((db.prepare("SELECT COUNT(*) n FROM managers").get() as { n: number }).n);
  } catch {
    throw new WorldQueryError();
  }
}
