/**
 * `reference_data.world_player_cards`からのSupabase読み取り(公開参照専用、SELECTのみ)。
 *
 * `efhubCardId`/`hasEfhubLink`/`aiStyles`/`appearance`/`efhubConflicts`は、
 * `world_player_cards`自体に追加した列(`efhub_card_id`/`ai_styles`/`appearance`/
 * `efhub_conflicts`、docs/production-readiness/sql/extend-reference-data-detail-schema.sql
 * で追加)から直接読み取る。`efhub_card_id`は実データの`source_record_links`(653件の
 * 実リンク)から導出した値であり、`player_card_analysis`の19件主キー集合による代替
 * (旧実装、World側IDとeFHUB側IDが異なる648件を見落としていた誤り)は使わない。
 *
 * 既知の制約(推測で埋めない、明示する): これらの列は追加マイグレーション(ALTER TABLE)と
 * 差分データ投入が実Supabaseに対して未実施の間は存在しないか、存在してもNULL/空のままである。
 * その間はこの経路の返り値も null/空配列になる(クラッシュはしないが、SQLite経路とは一致しない)。
 * 実データ完全一致は、差分データ投入完了後にのみ判定する(投入前の一致確認は「事前比較」として扱う)。
 *
 * `stats`(jsonb)は既存の`rowsToStats`、一覧行の変換は既存の`rowToListItem`を
 * そのまま再利用し、SQLite経路とのフィールド形状の乖離を最小化する。`rowToListItem`は
 * 元々`row.efhub_card_id`をそのまま読む設計のため、追加列さえ存在すれば変換関数側の変更は不要。
 */
import type { ReferenceDataClient } from "./supabase-client";
import { rowToListItem, rowsToStats } from "@/lib/world/mappers";
import { WORLD_CARD_ID_RE } from "@/lib/world/schemas";
import type {
  WorldAppearance,
  WorldEfhubConflict,
  WorldFacets,
  WorldListQuery,
  WorldListResult,
  WorldMetricRank,
  WorldPlayerDetail,
  WorldPlayerListItem,
  WorldSortKey,
  WorldSourceMeta,
} from "@/lib/world/types";
import { getReferenceDataClient } from "./supabase-client";
import { normalizeClientError, normalizeQueryError, normalizeSearchQueryFailure } from "./errors";
import type { ReferenceDataOperation } from "./observability";
import { buildSearchOrFilter } from "./postgrest-filter";

/**
 * facetsキャッシュのTTL(ミリ秒、300秒)。
 * 詳細ページの`export const revalidate = 300`(`src/app/players/world/[worldCardId]/page.tsx`)と
 * 値を揃える。Supabase側データ更新後、サーバープロセス再起動までfacetsが無期限に古いまま
 * 残る問題を防ぐため導入する(SQLite側の同名キャッシュ`src/lib/world/repository.ts`は、
 * データがアプリ再デプロイ経由でしか変わらない前提のため今回の対象外)。
 * テストは`vi.useFakeTimers()`で`Date.now()`を制御し、実時間300秒を待たない。
 */
const FACET_CACHE_TTL_MS = 300_000;

type Row = Record<string, unknown>;

const ORDER: Record<WorldSortKey, { field: string; ascending: boolean }[]> = {
  ovr_max_desc: [{ field: "ovr_max", ascending: false }, { field: "ovr_base", ascending: false }, { field: "world_card_id", ascending: true }],
  ovr_max_asc: [{ field: "ovr_max", ascending: true }, { field: "ovr_base", ascending: true }, { field: "world_card_id", ascending: true }],
  ovr_base_desc: [{ field: "ovr_base", ascending: false }, { field: "ovr_max", ascending: false }, { field: "world_card_id", ascending: true }],
  ovr_base_asc: [{ field: "ovr_base", ascending: true }, { field: "ovr_max", ascending: true }, { field: "world_card_id", ascending: true }],
  // `name_en`ではなく`name_sort_key`でソートする。PostgresのデフォルトcollationはSQLiteの
  // COLLATE NOCASEと、ダイアクリティカルマーク付き文字(例: "Aarón")の並び順が異なることが
  // Phase Dのシャドー比較で実測確認された(13,009件中12,868件で順序がずれる)。
  // `name_sort_key`はSQLiteのCOLLATE NOCASEと同じ規則(ASCII大文字だけ畳み込み、それ以外は
  // 無変更)で事前計算し、"C"照合順序(バイト単位比較)を列に明示指定した列で、
  // ORDER BYだけでSQLite側と完全に一致する順序を再現できる
  // (docs/production-readiness/sql/extend-name-sort-key-schema.sql、
  // src/lib/reference-data/name-sort-key.ts)。
  // 既知の制約: この列は追加migrationの適用と差分データ投入が完了するまで存在しないため、
  // それまでは"name"ソートを指定するとPostgRESTがエラーを返す(sqlite経路は既定のまま無変更)。
  name: [{ field: "name_sort_key", ascending: true }, { field: "world_card_id", ascending: true }],
  updated_desc: [{ field: "appearance_updated_at", ascending: false }, { field: "world_card_id", ascending: true }],
};

/**
 * PostgrestFilterBuilderの実際の型は再帰的なジェネリクスを持ち、汎用的な型制約を
 * 付けようとするとTypeScriptが"Type instantiation is excessively deep"を報告するため、
 * ここでは意図的に`any`で受け渡す(supabase-jsとの境界だけに閉じた実装詳細)。
 */
function applyWorldFilters(builder: any, q: WorldListQuery): any {
  let b = builder;
  if (q.query) {
    // 検索語はPostgRESTの値として引用・LIKEエスケープする(構文破壊・条件注入を防ぎ、SQLite経路と同じく文字どおり一致)。
    b = b.or(buildSearchOrFilter({ likeColumns: ["name_en", "name_ja"], exact: { column: "world_card_id", pattern: /^[0-9]{1,20}$/ } }, q.query));
  }
  if (q.position) b = b.eq("registered_position", q.position);
  if (q.cardType) b = b.eq("card_type", q.cardType);
  if (q.playingStyle) b = b.eq("playing_style", q.playingStyle);
  if (q.playingStyleDefensive) b = b.eq("playing_style_def", q.playingStyleDefensive);
  if (q.minOvr != null) b = b.gte("ovr_max", q.minOvr);
  if (q.maxOvr != null) b = b.lte("ovr_max", q.maxOvr);
  if (q.hasBooster === true) b = b.or("boost1.neq.0,boost2.neq.0");
  else if (q.hasBooster === false) b = b.eq("boost1", "0").eq("boost2", "0");
  return b;
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

async function getClient(operation: ReferenceDataOperation, client?: ReferenceDataClient): Promise<ReferenceDataClient> {
  try {
    return client ?? getReferenceDataClient();
  } catch (err) {
    throw normalizeClientError(err, { operation });
  }
}

/**
 * `appearance`(jsonb)を`WorldAppearance`へ検証しながら変換する。
 * このjsonbは`detail-extension-transform.ts`の`AppearanceValue`と同じcamelCase形状で
 * 投入する設計のため、フィールド名の変換は不要。ただし他経路からの汚染を想定し、
 * 型が期待と異なる場合はnull/空扱いにする(推測で埋めない)。
 */
function normalizeMetricRank(value: unknown): WorldMetricRank | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const rank = typeof o.rank === "number" && Number.isFinite(o.rank) ? o.rank : null;
  const total = typeof o.total === "number" && Number.isFinite(o.total) ? o.total : null;
  if (rank == null || total == null || total <= 0) return null;
  const topPercent = typeof o.topPercent === "number" && Number.isFinite(o.topPercent) ? o.topPercent : 0;
  return { rank, total, topPercent };
}

function normalizeAppearance(value: unknown): WorldAppearance | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const str = (x: unknown): string | null => (typeof x === "string" ? x : null);
  let ranks: WorldAppearance["ranks"] = null;
  if (v.ranks && typeof v.ranks === "object") {
    const out: NonNullable<WorldAppearance["ranks"]> = {};
    for (const [key, side] of Object.entries(v.ranks as Record<string, unknown>)) {
      if (!side || typeof side !== "object") continue;
      const s = side as Record<string, unknown>;
      out[key] = { overall: normalizeMetricRank(s.overall), position: normalizeMetricRank(s.position) };
    }
    ranks = Object.keys(out).length > 0 ? out : null;
  }
  return {
    position: str(v.position),
    legCoverageRadius: num(v.legCoverageRadius),
    armCoverageRadius: num(v.armCoverageRadius),
    torsoCollision: num(v.torsoCollision),
    jumpingHeight: num(v.jumpingHeight),
    dribbleHeight: num(v.dribbleHeight),
    legLength: num(v.legLength),
    ranks,
    updatedAt: str(v.updatedAt),
  };
}

/** `efhub_conflicts`(jsonb配列)を`WorldEfhubConflict[]`へ検証しながら変換する。形が不正な要素は除外する。 */
function normalizeEfhubConflicts(value: unknown): WorldEfhubConflict[] {
  if (!Array.isArray(value)) return [];
  const str = (x: unknown): string | null => (typeof x === "string" ? x : null);
  const out: WorldEfhubConflict[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.fieldName !== "string") continue;
    out.push({ fieldName: r.fieldName, efhubValue: str(r.efhubValue), worldValue: str(r.worldValue) });
  }
  return out;
}

/** `ai_styles`(postgresのtext[])を`string[]`へ検証しながら変換する。 */
function normalizeAiStyles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export async function listPlayersFromSupabase(q: WorldListQuery, client?: ReferenceDataClient): Promise<WorldListResult> {
  const c = await getClient("world.list", client);

  let countResult: { count: number | null; error: unknown; status?: number };
  try {
    countResult = await applyWorldFilters(c.from("world_player_cards").select("world_card_id", { count: "exact", head: true }), q);
  } catch (err) {
    throw normalizeQueryError(err, { operation: "world.list" });
  }
  const probe = () => applyWorldFilters(c.from("world_player_cards").select("world_card_id", { count: "exact", head: true }), { ...q, query: "" });
  if (countResult.error) throw await normalizeSearchQueryFailure(countResult.error, { operation: "world.list", status: countResult.status }, q.query, probe);

  const totalCount = countResult.count ?? 0;
  const totalPages = q.pageSize > 0 ? Math.max(1, Math.ceil(totalCount / q.pageSize)) : 1;
  const page = Math.min(q.page, totalPages);
  const offset = (page - 1) * q.pageSize;

  let dataBuilder = applyWorldFilters(c.from("world_player_cards").select("*"), q);
  for (const key of ORDER[q.sort] ?? ORDER.ovr_max_desc) dataBuilder = dataBuilder.order(key.field, { ascending: key.ascending });
  const { data, error, status } = await dataBuilder.range(offset, offset + q.pageSize - 1);
  if (error) throw await normalizeSearchQueryFailure(error, { operation: "world.list", status }, q.query, probe);

  const rows = (data ?? []) as Row[];
  const players = rows.map((r) => rowToListItem(r));

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

export async function getPlayerByWorldIdFromSupabase(worldCardId: string, client?: ReferenceDataClient): Promise<WorldPlayerDetail | null> {
  if (!WORLD_CARD_ID_RE.test(worldCardId)) return null;
  const c = await getClient("world.detail", client);

  const { data, error, status } = await c.from("world_player_cards").select("*").eq("world_card_id", worldCardId).maybeSingle();
  if (error) throw normalizeQueryError(error, { operation: "world.detail", status });
  if (!data) return null;
  const row = data as Row;
  const base = rowToListItem(row);

  const statsObj = (row.stats && typeof row.stats === "object" ? (row.stats as Record<string, unknown>) : {}) as Record<string, number>;
  const statsRows = Object.entries(statsObj).map(([stat_key, value]) => ({ stat_key, value }));

  return {
    ...base,
    stats: rowsToStats(statsRows),
    playerSkills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    aiStyles: normalizeAiStyles(row.ai_styles),
    appearance: normalizeAppearance(row.appearance),
    efhubConflicts: normalizeEfhubConflicts(row.efhub_conflicts),
    source: typeof row.source === "string" ? row.source : "efootball-world.com",
    sourceUrl: String(row.source_url ?? "https://efootball-world.com/api/proxy/v1/api/players/search"),
    fetchedAt: row.fetched_at == null ? null : String(row.fetched_at),
  };
}

export async function getPlayersByWorldIdsFromSupabase(ids: string[], client?: ReferenceDataClient): Promise<WorldPlayerListItem[]> {
  const clean = Array.from(new Set(ids.filter((id) => WORLD_CARD_ID_RE.test(id)))).slice(0, 500);
  if (clean.length === 0) return [];
  const c = await getClient("world.byIds", client);

  const { data, error, status } = await c.from("world_player_cards").select("*").in("world_card_id", clean);
  if (error) throw normalizeQueryError(error, { operation: "world.byIds", status });

  const rows = (data ?? []) as Row[];
  const byId = new Map(rows.map((r) => [String(r.world_card_id), rowToListItem(r)]));
  return clean.map((id) => byId.get(id)).filter((p): p is WorldPlayerListItem => p != null);
}

export async function getWorldImageUrlsFromSupabase(
  worldCardId: string,
  client?: ReferenceDataClient,
): Promise<{ imageUrl: string | null; mobileImageUrl: string | null } | null> {
  if (!WORLD_CARD_ID_RE.test(worldCardId)) return null;
  const c = await getClient("world.image", client);
  const { data, error, status } = await c.from("world_player_cards").select("image_url,mobile_image_url").eq("world_card_id", worldCardId).maybeSingle();
  if (error) throw normalizeQueryError(error, { operation: "world.image", status });
  if (!data) return null;
  const row = data as Row;
  return {
    imageUrl: typeof row.image_url === "string" && row.image_url !== "" ? row.image_url : null,
    mobileImageUrl: typeof row.mobile_image_url === "string" && row.mobile_image_url !== "" ? row.mobile_image_url : null,
  };
}

interface FacetCacheEntry {
  value: WorldFacets;
  expiresAt: number;
}
let facetCacheEntry: FacetCacheEntry | null = null;

function addNonEmpty(set: Set<string>, v: unknown): void {
  if (typeof v === "string" && v !== "") set.add(v);
}
function sortedArray(set: Set<string>): string[] {
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * PostgRESTは明示的なRange指定が無いと既定で先頭1,000件までしか返さない
 * (実測で確認済み: 13,009件のworld_player_cardsに対しRangeヘッダー無しだと
 * `Content-Range: 0-999/*`しか返らない)。facetsは全13,009件から算出する必要があるため、
 * ここでは`.range()`によるページングで全件を巡回してから集計する
 * (実際に、先頭1,000件だけでは出現しない稀少なcardType/playingStyleが
 * 欠落する不具合が過去にあったため、意図的に全件走査する設計にしている)。
 */
const FACET_PAGE_SIZE = 1000;

export async function getFacetsFromSupabase(client?: ReferenceDataClient): Promise<WorldFacets> {
  if (facetCacheEntry && facetCacheEntry.expiresAt > Date.now()) return facetCacheEntry.value;
  const c = await getClient("world.facets", client);
  const positions = new Set<string>();
  const cardTypes = new Set<string>();
  const playingStyles = new Set<string>();
  const playingStyleDefensives = new Set<string>();

  let offset = 0;
  let pageIndex = 0;
  for (;;) {
    const { data, error, count, status } = await c
      .from("world_player_cards")
      .select("registered_position,card_type,playing_style,playing_style_def", { count: "exact" })
      .range(offset, offset + FACET_PAGE_SIZE - 1);
    // TTL経過後の再取得に失敗した場合も含め、期限切れの値を黙って返さずここで伝播させる
    // (fail closed。facetCacheEntryは成功時にしか更新しないため、失敗時は古いまま=次回も
    // 期限切れ扱いになり、また再取得を試みる)。
    if (error) throw normalizeQueryError(error, { operation: "world.facets", status, pageIndex });
    const rows = (data ?? []) as Row[];
    for (const r of rows) {
      addNonEmpty(positions, r.registered_position);
      addNonEmpty(cardTypes, r.card_type);
      addNonEmpty(playingStyles, r.playing_style);
      addNonEmpty(playingStyleDefensives, r.playing_style_def);
    }
    offset += rows.length;
    pageIndex += 1;
    if (rows.length === 0 || (count != null && offset >= count)) break;
  }

  const value: WorldFacets = {
    positions: sortedArray(positions),
    cardTypes: sortedArray(cardTypes),
    playingStyles: sortedArray(playingStyles),
    playingStyleDefensives: sortedArray(playingStyleDefensives),
  };
  facetCacheEntry = { value, expiresAt: Date.now() + FACET_CACHE_TTL_MS };
  return value;
}

export function _resetFacetCacheForSupabase(): void {
  facetCacheEntry = null;
}

export async function getSourceMetaFromSupabase(client?: ReferenceDataClient): Promise<WorldSourceMeta> {
  const c = await getClient("world.sourceMeta", client);
  const { count, error, status } = await c.from("world_player_cards").select("world_card_id", { count: "exact", head: true });
  if (error) throw normalizeQueryError(error, { operation: "world.sourceMeta", status });

  // 既知の制約: world_sync_state/world_sync_runs相当は未移行のため、syncFinishedAt/syncStatusは
  // 各行が持つdataset_version/fetched_atの最新値から代替する(推測ではなく実データの範囲で分かる情報のみ使う)。
  const {
    data: latest,
    error: latestError,
    status: latestStatus,
  } = await c.from("world_player_cards").select("fetched_at").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  if (latestError) throw normalizeQueryError(latestError, { operation: "world.sourceMeta", status: latestStatus });

  return {
    source: "eFootball World",
    sourceUrl: "https://efootball-world.com/api/proxy/v1/api/players/search",
    totalCount: count ?? 0,
    syncFinishedAt: latest && typeof (latest as Row).fetched_at === "string" ? ((latest as Row).fetched_at as string) : null,
    syncStatus: null,
  };
}
