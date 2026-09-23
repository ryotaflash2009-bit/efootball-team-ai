/**
 * `reference_data.managers`からのSupabase読み取り(公開参照専用、SELECTのみ)。
 *
 * `boosterSummary`/`boosters`/`linkUpPlays`は、`managers`自体に追加した列
 * (`boosters`/`link_up_plays`、docs/production-readiness/sql/extend-reference-data-detail-schema.sql
 * で追加)から直接読み取る。
 *
 * 既知の制約(推測で埋めない、明示する): これらの列は追加マイグレーション(ALTER TABLE)と
 * 差分データ投入が実Supabaseに対して未実施の間は存在しないか、存在してもNULL/空のままである。
 * その間はこの経路の返り値も空配列になる(クラッシュはしないが、SQLite経路とは一致しない)。
 * 実データ完全一致は、差分データ投入完了後にのみ判定する(投入前の一致確認は「事前比較」として扱う)。
 */
import type { ReferenceDataClient } from "./supabase-client";
import type {
  LinkUpCondition,
  LinkUpPlay,
  ManagerBoosterEffect,
  ManagerDetail,
  ManagerListItem,
  ManagerListQuery,
  ManagerListResult,
  ManagerSortKey,
  TacticalProficiencies,
} from "@/lib/managers/types";
import { MANAGER_ID_RE } from "@/lib/managers/schemas";
import { getReferenceDataClient } from "./supabase-client";
import { normalizeClientError, normalizeQueryError, normalizeSearchQueryFailure } from "./errors";
import { buildSearchOrFilter } from "./postgrest-filter";

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function bool(v: unknown): boolean {
  return v === true || v === "true" || v === "t";
}

/**
 * `boosters`(jsonb配列)を`ManagerBoosterEffect[]`へ検証しながら変換する。
 * このjsonbは`detail-extension-transform.ts`の`ManagerBoosterValue`と同じcamelCase形状で
 * 投入する設計のため、フィールド名の変換は不要。形が不正な要素は除外する(推測で埋めない)。
 */
function normalizeBoosters(value: unknown): ManagerBoosterEffect[] {
  if (!Array.isArray(value)) return [];
  const out: ManagerBoosterEffect[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.statNameEn !== "string" || typeof r.rawValue !== "string") continue;
    out.push({
      statNameEn: r.statNameEn,
      statKey: str(r.statKey),
      delta: num(r.delta) ?? 0,
      rawValue: r.rawValue,
      applicationCondition: str(r.applicationCondition),
      confirmationStatus: (str(r.confirmationStatus) as ManagerBoosterEffect["confirmationStatus"]) ?? "unresolved",
    });
  }
  return out;
}

function normalizeLinkUpCondition(value: unknown, role: "centerPiece" | "keyMan"): LinkUpCondition | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  return {
    role,
    playingStyle: str(r.playingStyle),
    positions: Array.isArray(r.positions) ? r.positions.filter((p): p is string => typeof p === "string") : [],
  };
}

/** `link_up_plays`(jsonb配列)を`LinkUpPlay[]`へ検証しながら変換する。形が不正な要素は除外する。 */
function normalizeLinkUpPlays(value: unknown): LinkUpPlay[] {
  if (!Array.isArray(value)) return [];
  const out: LinkUpPlay[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.name !== "string") continue;
    out.push({
      name: r.name,
      centerPiece: normalizeLinkUpCondition(r.centerPiece, "centerPiece"),
      keyMan: normalizeLinkUpCondition(r.keyMan, "keyMan"),
      confirmationStatus: (str(r.confirmationStatus) as LinkUpPlay["confirmationStatus"]) ?? "provisional",
    });
  }
  return out;
}

/** 一覧向けのブースター要約文字列("能力名 +n"の配列、booster順)。既存SQLite経路と同じ組み立て方。 */
function boosterSummaryFromBoosters(boosters: readonly ManagerBoosterEffect[]): string[] {
  return boosters.map((b) => `${b.statNameEn} ${b.delta >= 0 ? "+" : ""}${b.delta}`);
}

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

function rowToListItem(r: Row): ManagerListItem {
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
    hasBooster: bool(r.has_booster),
    hasLinkUpPlay: bool(r.has_link_up_play),
    boosterConfirmation: (str(r.booster_confirmation) as ManagerListItem["boosterConfirmation"]) ?? "unresolved",
    boosterSummary: boosterSummaryFromBoosters(normalizeBoosters(r.boosters)),
  };
}

/**
 * 正式なタイブレーク規則(Phase Dで確定): 主ソートキー → name_sort_key → internal_manager_id ASC。
 * SQLite側(managers/repository.tsのORDER_BY)と対になる設計で、同じ規則を適用する。
 *
 * `name_en`ではなく`name_sort_key`を使う理由: PostgresのデフォルトcollationはSQLiteの
 * COLLATE NOCASEと、ダイアクリティカルマーク付き文字(例: "Ståle Solbakken")の並び順が異なることが
 * Phase Dのシャドー比較で実測確認された。`name_sort_key`はSQLiteのCOLLATE NOCASEと同じ規則で
 * 事前計算し、"C"照合順序を列に明示指定した列で、ORDER BYだけでSQLite側と一致する順序を再現できる
 * (docs/production-readiness/sql/extend-name-sort-key-schema.sql、
 * src/lib/reference-data/name-sort-key.ts)。
 *
 * `internal_manager_id ASC`を主ソートの方向によらず常に最終タイブレークへ追加する理由:
 * 66件中16グループ(各2〜3件)で監督名が完全重複しており、一部は主ソート値・name_enまで
 * 完全一致する(例: internal_manager_id 51/58の「Johan Cruyff」)。この最終タイブレークが
 * 無いと、SQLiteは非公開のrowid等へ、PostgreSQLは別の内部順序へ依存する未定義動作になり、
 * エンジン間で順序が一致しないことが実測で確認された(world_player_cards側で既に採用済みの
 * 「world_card_id ASCで固定」と同じ設計)。
 *
 * `nullsFirst`を主ソート列(released_at・overload等、NULLを含みうる列)へ明示する理由:
 * SQLiteの既定はNULLを常に最小値として扱う(ASCで先頭、DESCで末尾)が、PostgreSQLの既定は
 * 逆(明示指定が無い場合、ASCで末尾、DESCで先頭)。この差を埋めるため、SQLite側の実際の挙動
 * (`ASC`→`nullsFirst: true`、`DESC`→`nullsFirst: false`)をPostgREST側へ明示的に指定する
 * (name_sort_key/internal_manager_idはNOT NULL列のためnullsFirstの指定は不要)。
 *
 * 既知の制約: name_sort_key列は追加migrationの適用と差分データ投入が完了するまで
 * 存在しないため、それまではいずれのソートキーを指定してもPostgRESTがエラーを返す
 * (sqlite経路は既定のまま無変更)。
 */
const ORDER: Record<ManagerSortKey, { field: string; ascending: boolean; nullsFirst?: boolean }[]> = {
  name: [
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
  released_desc: [
    { field: "released_at", ascending: false, nullsFirst: false },
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
  released_asc: [
    { field: "released_at", ascending: true, nullsFirst: true },
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
  possession_desc: [
    { field: "possession_game", ascending: false, nullsFirst: false },
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
  quick_counter_desc: [
    { field: "quick_counter", ascending: false, nullsFirst: false },
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
  long_ball_counter_desc: [
    { field: "long_ball_counter", ascending: false, nullsFirst: false },
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
  out_wide_desc: [
    { field: "out_wide", ascending: false, nullsFirst: false },
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
  long_ball_desc: [
    { field: "long_ball", ascending: false, nullsFirst: false },
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
  overload_desc: [
    { field: "overload", ascending: false, nullsFirst: false },
    { field: "name_sort_key", ascending: true },
    { field: "internal_manager_id", ascending: true },
  ],
};

/**
 * PostgrestFilterBuilderの実際の型は再帰的なジェネリクスを持ち、汎用的な型制約を
 * 付けようとするとTypeScriptが"Type instantiation is excessively deep"を報告するため、
 * ここでは意図的に`any`で受け渡す(supabase-jsとの境界だけに閉じた実装詳細)。
 */
function applyManagerFilters(builder: any, q: ManagerListQuery): any {
  let b = builder;
  if (q.query) {
    // 検索語はPostgRESTの値として引用・LIKEエスケープする(構文破壊・条件注入を防ぎ、SQLite経路と同じく文字どおり一致)。
    b = b.or(buildSearchOrFilter({ likeColumns: ["name_en", "team_name"], exact: { column: "source_manager_id", pattern: /^[A-Za-z0-9_-]{1,64}$/ } }, q.query));
  }
  if (q.hasBooster === true) b = b.eq("has_booster", true);
  else if (q.hasBooster === false) b = b.eq("has_booster", false);
  if (q.hasLinkUpPlay === true) b = b.eq("has_link_up_play", true);
  else if (q.hasLinkUpPlay === false) b = b.eq("has_link_up_play", false);
  return b;
}

export async function listManagersFromSupabase(q: ManagerListQuery, client?: ReferenceDataClient): Promise<ManagerListResult> {
  let c: ReferenceDataClient;
  try {
    c = client ?? getReferenceDataClient();
  } catch (err) {
    throw normalizeClientError(err, { operation: "managers.list" });
  }

  // 件数を先に確認してからページ範囲を決める(既存SQLite実装のtotalCount先行方式に合わせる)。
  // フィルタは本クエリと同じ条件を適用する(適用し忘れると件数がズレるため)。
  let countResult: { count: number | null; error: unknown; status?: number };
  try {
    const countBuilder = applyManagerFilters(c.from("managers").select("internal_manager_id", { count: "exact", head: true }), q);
    countResult = await countBuilder;
  } catch (err) {
    throw normalizeQueryError(err, { operation: "managers.list" });
  }
  const probe = () => applyManagerFilters(c.from("managers").select("internal_manager_id", { count: "exact", head: true }), { ...q, query: "" });
  if (countResult.error) throw await normalizeSearchQueryFailure(countResult.error, { operation: "managers.list", status: countResult.status }, q.query, probe);

  const totalCount = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / q.pageSize));
  const page = Math.min(q.page, totalPages);
  const offset = (page - 1) * q.pageSize;

  let dataBuilder = applyManagerFilters(c.from("managers").select("*"), q);
  for (const key of ORDER[q.sort]) dataBuilder = dataBuilder.order(key.field, { ascending: key.ascending, nullsFirst: key.nullsFirst });
  const { data, error, status } = await dataBuilder.range(offset, offset + q.pageSize - 1);
  if (error) throw await normalizeSearchQueryFailure(error, { operation: "managers.list", status }, q.query, probe);

  const rows = (data ?? []) as Row[];
  return {
    managers: rows.map(rowToListItem),
    page,
    pageSize: q.pageSize,
    totalCount,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
    source: "amine250/efootball-managers",
  };
}

export async function getManagerByIdFromSupabase(internalManagerId: string | number, client?: ReferenceDataClient): Promise<ManagerDetail | null> {
  const idStr = String(internalManagerId);
  if (!MANAGER_ID_RE.test(idStr)) return null;

  let c: ReferenceDataClient;
  try {
    c = client ?? getReferenceDataClient();
  } catch (err) {
    throw normalizeClientError(err, { operation: "managers.detail" });
  }

  const { data, error, status } = await c.from("managers").select("*").eq("internal_manager_id", Number(idStr)).maybeSingle();
  if (error) throw normalizeQueryError(error, { operation: "managers.detail", status });
  if (!data) return null;

  const row = data as Row;
  return {
    ...rowToListItem(row),
    boosters: normalizeBoosters(row.boosters),
    linkUpPlays: normalizeLinkUpPlays(row.link_up_plays),
    sourceUrl: String(row.source_url ?? ""),
    fetchedAt: str(row.fetched_at),
  };
}

export async function getManagerCountFromSupabase(client?: ReferenceDataClient): Promise<number> {
  let c: ReferenceDataClient;
  try {
    c = client ?? getReferenceDataClient();
  } catch (err) {
    throw normalizeClientError(err, { operation: "managers.count" });
  }
  const { count, error, status } = await c.from("managers").select("internal_manager_id", { count: "exact", head: true });
  if (error) throw normalizeQueryError(error, { operation: "managers.count", status });
  return count ?? 0;
}
