import { createHash } from "node:crypto";
import { isAllowedWorldImageUrl } from "../../world/player-image";
import { computeNameSortKey } from "../name-sort-key";
import { buildSourceRequest, type SourceRequest } from "./source-transport";
import { normalizeTimestamp, worldCardIdentity } from "./update-contract";

/**
 * 自動更新 Phase B: eFootball World players search APIの parser・normalizer・incremental planner。
 *
 * normalizeWorldPlayerRecordは既存 scripts/sqlite/world.mjs の normalizeWorldPlayer と同じ出力を
 * 返す(characterization testで固定)。toWorldSourceRowはその結果を reference_data.world_player_cards
 * のupstream由来列へ変換し、DDLの制約(world_card_idは数字のみ・整数列・画像URL許可ホスト)を
 * 満たさない行は黙って補正せず rejected として返す。
 *
 * このmoduleはネットワークへアクセスしない(requestの組み立てと、受け取った本文の解析だけ)。
 */

export const WORLD_SOURCE_LABEL = "world";
export const WORLD_SEARCH_URL = "https://efootball-world.com/api/proxy/v1/api/players/search";
export const WORLD_PAGE_SIZE = 500;
/** 既存incremental syncの既定上限(--max-pages 15)。 */
export const WORLD_INCREMENTAL_DEFAULT_MAX_PAGES = 15;

/** players/search レスポンスの26能力値キー(scripts/sqlite/world.mjs と同一)。 */
export const WORLD_STAT_KEYS = Object.freeze([
  "offensiveAwareness", "ballControl", "dribbling", "tightPossession", "lowPass", "loftedPass",
  "finishing", "heading", "setPieceTaking", "curl", "defensiveAwareness", "tackling", "aggression",
  "defensiveEngagement", "gkAwareness", "gkCatching", "gkParrying", "gkReflexes", "gkReach",
  "speed", "acceleration", "kickingPower", "jumping", "physicalContact", "balance", "stamina",
] as const);

const APPEARANCE_RANK_KEYS = ["legCoverageRadius", "armCoverageRadius", "torsoCollision", "jumpingHeight", "dribbleHeight", "legLength"] as const;

export type WorldSortBy = "CREATED_AT" | "UPDATED_AT";

export class WorldSourceParseError extends Error {
  readonly reason: "parse_error" | "schema_drift";
  constructor(reason: "parse_error" | "schema_drift", detail: string) {
    super(`World応答の解析失敗: ${reason}: ${detail}`);
    this.name = "WorldSourceParseError";
    this.reason = reason;
  }
}

/** 既存スクリプトと同じkey順のrequest body。 */
export function buildWorldSearchBody(page: number, sortBy: WorldSortBy): string {
  if (!Number.isInteger(page) || page < 1) throw new Error("pageは1以上の整数");
  return JSON.stringify({ page, size: WORLD_PAGE_SIZE, sortBy, sortOrder: "DESC" });
}

export function buildWorldSearchRequest(page: number, sortBy: WorldSortBy): SourceRequest {
  return buildSourceRequest("efootball-world", buildWorldSearchBody(page, sortBy));
}

export interface WorldSearchPage {
  readonly players: readonly unknown[];
  readonly totalCount: number | null;
  readonly totalPages: number | null;
  readonly pageSize: number | null;
  readonly hasNext: boolean | null;
  /** 応答本文のSHA-256(既存スクリプトのcontent hashと同じ)。 */
  readonly contentHash: string;
  readonly bodyBytes: number;
}

function optionalCount(value: unknown, label: string): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new WorldSourceParseError("schema_drift", `${label}が0以上の整数ではない`);
  return value;
}

/** players/search の本文を解析する。players配列が無い・型が違う場合は schema_drift で停止する。 */
export function parseWorldSearchPage(bodyText: string): WorldSearchPage {
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new WorldSourceParseError("parse_error", "JSONとして解析できない");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new WorldSourceParseError("schema_drift", "objectではない");
  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.players)) throw new WorldSourceParseError("schema_drift", "players配列がない");
  if (obj.hasNext != null && typeof obj.hasNext !== "boolean") throw new WorldSourceParseError("schema_drift", "hasNextがbooleanではない");
  return Object.freeze({
    players: Object.freeze([...obj.players]),
    totalCount: optionalCount(obj.totalCount, "totalCount"),
    totalPages: optionalCount(obj.totalPages, "totalPages"),
    pageSize: optionalCount(obj.pageSize, "pageSize"),
    hasNext: (obj.hasNext as boolean | undefined) ?? null,
    contentHash: createHash("sha256").update(bodyText).digest("hex"),
    bodyBytes: Buffer.byteLength(bodyText, "utf8"),
  });
}

// ---------------------------------------------------------------------------
// Normalizer (port of scripts/sqlite/world.mjs normalizeWorldPlayer)
// ---------------------------------------------------------------------------

export interface WorldNormalizedAppearance {
  position: string | null;
  leg_coverage_radius: number | null;
  arm_coverage_radius: number | null;
  torso_collision: number | null;
  jumping_height: number | null;
  dribble_height: number | null;
  leg_length: number | null;
  ranks_json: string;
  updated_at: string | null;
}

export interface WorldNormalizedPlayer {
  world_card_id: string | null;
  name_en: string | null;
  name_ja: string | null;
  card_type: string | null;
  registered_position: string | null;
  nationality: string | null;
  region: string | null;
  league: string | null;
  team: string | null;
  ovr_base: number | null;
  ovr_max: number | null;
  maximum_level: number | null;
  card_rating: string | null;
  playing_style: string | null;
  playing_style_def: string | null;
  preferred_foot: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  image_url: string | null;
  mobile_image_url: string | null;
  boost1: number | null;
  boost2: number | null;
  likes_count: number | null;
  view_count: number | null;
  average_rating: number | null;
  total_ratings: number | null;
  appearance_updated_at: string | null;
  stats: Record<string, number | null>;
  skills: string[];
  aiStyles: string[];
  appearance: WorldNormalizedAppearance | null;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : v == null ? null : String(v));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

/** players/search の1件を既存スクリプトと同じ形へ正規化する(未検証。検証はtoWorldSourceRowで行う)。 */
export function normalizeWorldPlayerRecord(raw: unknown): WorldNormalizedPlayer {
  const p: Record<string, unknown> = isObj(raw) ? raw : {};
  const ap = isObj(p.appearance) ? p.appearance : null;
  const apVal = (k: string): number | null => {
    if (!ap) return null;
    const v = ap[k];
    return isObj(v) && "value" in v ? num(v.value) : num(v);
  };
  const apRanks = ap
    ? Object.fromEntries(
        APPEARANCE_RANK_KEYS.filter((k) => {
          const v = ap[k];
          return isObj(v) && (v.overall || v.position);
        }).map((k) => {
          const v = ap[k] as Record<string, unknown>;
          return [k, { overall: v.overall ?? null, position: v.position ?? null }];
        }),
      )
    : {};

  return {
    world_card_id: str(p.id ?? p.playerId),
    name_en: str(p.name),
    name_ja: str(p.nameJp),
    card_type: str(p.type),
    registered_position: str(p.position),
    nationality: str(p.nationality),
    region: str(p.region),
    league: str(p.league),
    team: str(p.team),
    ovr_base: num(p.overallRating),
    ovr_max: num(p.maxOverall),
    maximum_level: num(p.maximumLevel),
    card_rating: str(p.rating),
    playing_style: str(p.playingStyle),
    playing_style_def: str(p.playingStyleDef),
    preferred_foot: str(p.foot),
    age: num(p.age),
    height: num(p.height),
    weight: num(p.weight),
    image_url: str(p.imageUrl),
    mobile_image_url: str(p.mobileImageUrl),
    boost1: num(p.boost1),
    boost2: num(p.boost2),
    likes_count: num(p.likesCount),
    view_count: num(p.viewCount),
    average_rating: num(p.averageRating),
    total_ratings: num(p.totalRatings),
    appearance_updated_at: ap ? str(ap.updatedAt) : null,
    stats: Object.fromEntries(WORLD_STAT_KEYS.map((k) => [k, num(p[k])])),
    skills: Array.isArray(p.skills) ? p.skills.filter((x): x is string => typeof x === "string") : [],
    aiStyles: Array.isArray(p.aiStyles) ? p.aiStyles.filter((x): x is string => typeof x === "string") : [],
    appearance: ap
      ? {
          position: str(ap.position),
          leg_coverage_radius: apVal("legCoverageRadius"),
          arm_coverage_radius: apVal("armCoverageRadius"),
          torso_collision: apVal("torsoCollision"),
          jumping_height: apVal("jumpingHeight"),
          dribble_height: apVal("dribbleHeight"),
          leg_length: apVal("legLength"),
          ranks_json: JSON.stringify(apRanks),
          updated_at: str(ap.updatedAt),
        }
      : null,
  };
}

const NAIVE_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;

/**
 * upstreamのappearance.updatedAtはタイムゾーンを持たない(例: 2026-04-28T17:17:02.021292)。
 * Productionのtimestamptz列はUTCのsessionでこの値を保存しているため、タイムゾーン無しの
 * ISO形式(日付とTで区切った時刻)だけをUTCとして解釈する。空白区切り等の別形式は補正しない(reject)。
 * 解釈の妥当性はBackup v2(appearance_updated_atを収録)で確認する。
 */
export function assumeUtcIfNaiveIso(value: string): string {
  return NAIVE_ISO_RE.test(value) ? `${value}Z` : value;
}

// ---------------------------------------------------------------------------
// Source row (reference_data.world_player_cards upstream-derived columns)
// ---------------------------------------------------------------------------

/**
 * sourceから決まる列(Production列 − volatile − eFHUB由来のlocally computed列)。
 * name_sort_keyはname_enから再計算する。ai_styles・appearanceはsearch応答に含まれることを
 * 既存sync(world_player_ai_styles/world_player_appearancesへの書込み)で確認済み。ただし
 * 更新時に上書きするかは契約(preserveOnUpdateColumns)に従い、Phase Dで決める。
 */
export const WORLD_SOURCE_COLUMNS = Object.freeze([
  "world_card_id", "name_en", "name_ja", "card_type", "registered_position", "nationality", "region",
  "league", "team", "ovr_base", "ovr_max", "maximum_level", "card_rating", "playing_style",
  "playing_style_def", "preferred_foot", "age", "height", "weight", "image_url", "mobile_image_url",
  "boost1", "boost2", "stats", "skills", "ai_styles", "appearance", "name_sort_key", "source",
  "source_url", "appearance_updated_at",
] as const);

export type WorldSourceColumn = (typeof WORLD_SOURCE_COLUMNS)[number];

export interface WorldAppearanceValue {
  position: string | null;
  legCoverageRadius: number | null;
  armCoverageRadius: number | null;
  torsoCollision: number | null;
  jumpingHeight: number | null;
  dribbleHeight: number | null;
  legLength: number | null;
  ranks: unknown | null;
  updatedAt: string | null;
}

export type WorldSourceRow = Record<WorldSourceColumn, unknown> & { fetched_at: string };

export interface WorldRowRejection {
  /** 数字だけの正しいidが取れた場合だけ設定する。 */
  readonly identity: string | null;
  readonly reasons: readonly string[];
}

export type WorldRowResult = { readonly ok: true; readonly row: WorldSourceRow } | { readonly ok: false; readonly rejection: WorldRowRejection };

const INTEGER_COLUMNS = ["ovr_base", "ovr_max", "maximum_level", "age", "height", "weight"] as const;

function parseRanks(json: string): unknown | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** detail extension(buildAppearanceMap)と同じcamelCase形へ変換する。 */
export function toWorldAppearanceValue(a: WorldNormalizedAppearance | null): WorldAppearanceValue | null {
  if (!a) return null;
  return {
    position: a.position,
    legCoverageRadius: a.leg_coverage_radius,
    armCoverageRadius: a.arm_coverage_radius,
    torsoCollision: a.torso_collision,
    jumpingHeight: a.jumping_height,
    dribbleHeight: a.dribble_height,
    legLength: a.leg_length,
    ranks: parseRanks(a.ranks_json),
    updatedAt: a.updated_at,
  };
}

/** 数値のboostはPGのtext列へ、既存移行と同じ十進表記で格納する。 */
function boostText(v: number | null): string | null {
  return v == null ? null : String(v);
}

/**
 * 正規化済みの1件をsource rowへ変換する。DDL制約違反・不正な時刻は補正せず理由付きでrejectする。
 */
export function toWorldSourceRow(n: WorldNormalizedPlayer, fetchedAt: string): WorldRowResult {
  const reasons: string[] = [];
  let identity: string | null = null;
  try {
    identity = worldCardIdentity(n.world_card_id);
  } catch {
    reasons.push("world_card_idが数字だけの文字列ではない");
  }
  if (n.name_en == null || n.name_en.trim() === "") reasons.push("name_enが空");
  for (const col of INTEGER_COLUMNS) {
    const v = n[col];
    if (v != null && (!Number.isInteger(v) || v < 0)) reasons.push(`${col}が0以上の整数ではない`);
  }
  for (const col of ["ovr_base", "ovr_max"] as const) {
    const v = n[col];
    if (v != null && v > 130) reasons.push(`${col}が範囲外`);
  }
  for (const col of ["image_url", "mobile_image_url"] as const) {
    const v = n[col];
    if (v != null && v !== "" && !isAllowedWorldImageUrl(v)) reasons.push(`${col}が許可ホスト外またはURLとして不正`);
  }
  let appearanceUpdatedAt: string | null = null;
  if (n.appearance_updated_at != null) {
    try {
      appearanceUpdatedAt = normalizeTimestamp(assumeUtcIfNaiveIso(n.appearance_updated_at), "appearance.updatedAt");
    } catch {
      reasons.push("appearance.updatedAtがISO 8601ではない");
    }
  }
  let fetched: string | null = null;
  try {
    fetched = normalizeTimestamp(fetchedAt, "fetched_at");
  } catch {
    reasons.push("fetched_atが不正");
  }
  if (reasons.length > 0 || identity == null || fetched == null) return { ok: false, rejection: { identity, reasons } };

  const stats: Record<string, number> = {};
  for (const k of WORLD_STAT_KEYS) {
    const v = n.stats[k];
    if (typeof v === "number") stats[k] = v; // 既存syncと同じく数値だけを保存する
  }
  const row: WorldSourceRow = {
    world_card_id: identity,
    name_en: n.name_en,
    name_ja: n.name_ja,
    card_type: n.card_type,
    registered_position: n.registered_position,
    nationality: n.nationality,
    region: n.region,
    league: n.league,
    team: n.team,
    ovr_base: n.ovr_base,
    ovr_max: n.ovr_max,
    maximum_level: n.maximum_level,
    card_rating: n.card_rating,
    playing_style: n.playing_style,
    playing_style_def: n.playing_style_def,
    preferred_foot: n.preferred_foot,
    age: n.age,
    height: n.height,
    weight: n.weight,
    image_url: n.image_url,
    mobile_image_url: n.mobile_image_url,
    boost1: boostText(n.boost1),
    boost2: boostText(n.boost2),
    stats,
    skills: [...n.skills],
    ai_styles: [...n.aiStyles],
    appearance: toWorldAppearanceValue(n.appearance),
    name_sort_key: computeNameSortKey(n.name_en),
    source: WORLD_SOURCE_LABEL,
    source_url: WORLD_SEARCH_URL,
    appearance_updated_at: appearanceUpdatedAt,
    fetched_at: fetched,
  };
  return { ok: true, row };
}

// ---------------------------------------------------------------------------
// Incremental planner (port of scripts/sync-world-players-incremental.mjs)
// ---------------------------------------------------------------------------

export interface WorldIncrementalContext {
  /** 前回同期で見た最新のappearance.updatedAt(正規化済みISO)。 */
  readonly previousMaxUpdatedAt: string | null;
  /** 前回のUPDATED_AT先頭pageのcontent hash。 */
  readonly previousFirstPageHash: string | null;
  /** 既知のworld_card_id → appearance_updated_at(正規化済みISO、無ければnull)。 */
  readonly knownUpdatedAt: ReadonlyMap<string, string | null>;
  readonly maxPages: number;
}

export type WorldIncrementalDecision =
  | "continue"
  | "stop_no_change"
  | "stop_all_known"
  | "stop_max_pages"
  | "stop_last_page"
  | "blocked_sort_contract";

export interface WorldIncrementalPageResult {
  readonly page: number;
  readonly decision: WorldIncrementalDecision;
  readonly newIds: readonly string[];
  readonly changedIds: readonly string[];
  readonly unchangedCount: number;
  readonly maxUpdatedAtSeen: string | null;
}

/**
 * sortBy=UPDATED_AT が期待どおり機能しているかを先頭pageで確認する
 * (updatedAtの欠損が半数を超える・降順でない場合は、別方式へ自動で切り替えずに停止する)。
 */
export function checkUpdatedAtSortContract(rows: readonly Pick<WorldSourceRow, "appearance_updated_at">[]): boolean {
  const ts = rows.map((r) => r.appearance_updated_at).filter((v): v is string => typeof v === "string");
  if (rows.length === 0 || ts.length < rows.length * 0.5) return false;
  for (let i = 1; i < ts.length; i++) if (ts[i - 1] < ts[i]) return false;
  return true;
}

/** 1 pageぶんの判定。既存incremental syncと同じ規則(新規/updatedAt変化/前回最大より新しい→候補)。 */
export function evaluateWorldIncrementalPage(
  ctx: WorldIncrementalContext,
  page: number,
  meta: Pick<WorldSearchPage, "contentHash" | "totalPages">,
  rows: readonly Pick<WorldSourceRow, "world_card_id" | "appearance_updated_at">[],
  maxSeenSoFar: string | null,
): WorldIncrementalPageResult {
  if (!Number.isInteger(ctx.maxPages) || ctx.maxPages < 1) throw new Error("maxPagesは1以上の整数");
  if (page === 1) {
    if (!checkUpdatedAtSortContract(rows)) {
      return { page, decision: "blocked_sort_contract", newIds: [], changedIds: [], unchangedCount: 0, maxUpdatedAtSeen: maxSeenSoFar };
    }
    if (ctx.previousFirstPageHash != null && ctx.previousFirstPageHash === meta.contentHash) {
      return { page, decision: "stop_no_change", newIds: [], changedIds: [], unchangedCount: rows.length, maxUpdatedAtSeen: maxSeenSoFar };
    }
  }
  const newIds: string[] = [];
  const changedIds: string[] = [];
  let unchanged = 0;
  let maxSeen = maxSeenSoFar;
  const prevMax = ctx.previousMaxUpdatedAt ?? "";
  for (const r of rows) {
    const id = r.world_card_id as string;
    const u = typeof r.appearance_updated_at === "string" ? r.appearance_updated_at : "";
    if (u !== "" && (maxSeen == null || u > maxSeen)) maxSeen = u;
    if (!ctx.knownUpdatedAt.has(id)) newIds.push(id);
    else if ((ctx.knownUpdatedAt.get(id) ?? "") !== u || u > prevMax) changedIds.push(id);
    else unchanged++;
  }
  let decision: WorldIncrementalDecision = "continue";
  if (page > 1 && newIds.length === 0 && changedIds.length === 0) decision = "stop_all_known";
  else if (meta.totalPages != null && page >= meta.totalPages) decision = "stop_last_page";
  else if (page >= ctx.maxPages) decision = "stop_max_pages";
  return { page, decision, newIds, changedIds, unchangedCount: unchanged, maxUpdatedAtSeen: maxSeen };
}
