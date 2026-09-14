import { createHash } from "node:crypto";
import { isAllowedWorldImageUrl, isValidWorldCardId } from "../world/player-image";

/**
 * SQLite(正本 data/efootball.db)から取得した参照データ行を、
 * `docs/production-readiness/sql/create-reference-data-schema.sql`が定義する
 * PostgreSQL用の形へ変換・検証する純関数群。
 *
 * - 実Supabase・実PostgreSQLへは一切接続しない(呼び出し側の責務)。
 * - ここでの関数はすべて「読み取り済みのプレーンオブジェクト → 変換後オブジェクト」
 *   の純粋な変換であり、副作用(ファイル書込み・ネットワーク通信)を持たない。
 */

export interface WorldPlayerCardSqliteRow {
  world_card_id: string;
  name_en: string;
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
  boost1: string | null;
  boost2: string | null;
  source: string | null;
  source_url: string | null;
  appearance_updated_at: string | null;
  fetched_at: string;
}

export interface WorldPlayerStatRow {
  world_card_id: string;
  stat_key: string;
  value: number;
}

export interface WorldPlayerSkillRow {
  world_card_id: string;
  skill_name: string;
  display_order: number;
}

export interface WorldPlayerCardPgRow {
  world_card_id: string;
  name_en: string;
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
  boost1: string | null;
  boost2: string | null;
  stats: Record<string, number>;
  skills: string[];
  source: string;
  source_url: string | null;
  appearance_updated_at: string | null;
  fetched_at: string;
  dataset_version: string;
  import_batch_id: string;
}

/** dataset_versionの命名規則。例: world-2026-09-14 */
export function computeDatasetVersion(prefix: string, now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${prefix}-${iso}`;
}

/** バッチの内容から決定的なSHA-256(小文字16進64桁)を計算する。 */
export function computePayloadHash(rows: readonly unknown[]): string {
  const canonical = JSON.stringify(rows);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function transformWorldPlayerCard(
  row: WorldPlayerCardSqliteRow,
  stats: readonly WorldPlayerStatRow[],
  skills: readonly WorldPlayerSkillRow[],
  datasetVersion: string,
  importBatchId: string,
): WorldPlayerCardPgRow {
  const statsObj: Record<string, number> = {};
  for (const s of stats) statsObj[s.stat_key] = s.value;
  const skillNames = [...skills].sort((a, b) => a.display_order - b.display_order).map((s) => s.skill_name);
  return {
    world_card_id: row.world_card_id,
    name_en: row.name_en,
    name_ja: row.name_ja,
    card_type: row.card_type,
    registered_position: row.registered_position,
    nationality: row.nationality,
    region: row.region,
    league: row.league,
    team: row.team,
    ovr_base: row.ovr_base,
    ovr_max: row.ovr_max,
    maximum_level: row.maximum_level,
    card_rating: row.card_rating,
    playing_style: row.playing_style,
    playing_style_def: row.playing_style_def,
    preferred_foot: row.preferred_foot,
    age: row.age,
    height: row.height,
    weight: row.weight,
    image_url: row.image_url,
    mobile_image_url: row.mobile_image_url,
    boost1: row.boost1,
    boost2: row.boost2,
    stats: statsObj,
    skills: skillNames,
    source: row.source ?? "efootball-world.com",
    source_url: row.source_url,
    appearance_updated_at: row.appearance_updated_at,
    fetched_at: row.fetched_at,
    dataset_version: datasetVersion,
    import_batch_id: importBatchId,
  };
}

export interface RowValidationResult {
  ok: boolean;
  errors: string[];
}

/** 1件のworld_player_cards変換結果を検証する(DB制約と同じ基準をアプリ側でも事前確認)。 */
export function validateWorldPlayerCard(row: WorldPlayerCardPgRow): RowValidationResult {
  const errors: string[] = [];
  if (!isValidWorldCardId(row.world_card_id)) errors.push(`world_card_id形式が不正: ${row.world_card_id}`);
  if (!row.name_en || row.name_en.trim() === "") errors.push(`name_enが空: ${row.world_card_id}`);
  if (row.ovr_base != null && (row.ovr_base < 0 || row.ovr_base > 130)) errors.push(`ovr_baseが範囲外: ${row.world_card_id}`);
  if (row.ovr_max != null && (row.ovr_max < 0 || row.ovr_max > 130)) errors.push(`ovr_maxが範囲外: ${row.world_card_id}`);
  if (row.image_url && !isAllowedWorldImageUrl(row.image_url)) {
    errors.push(`image_urlが許可ホスト外またはURLとして不正: ${row.world_card_id}`);
  }
  if (row.mobile_image_url && !isAllowedWorldImageUrl(row.mobile_image_url)) {
    errors.push(`mobile_image_urlが許可ホスト外またはURLとして不正: ${row.world_card_id}`);
  }
  if (!row.dataset_version || row.dataset_version.trim() === "") errors.push(`dataset_versionが空: ${row.world_card_id}`);
  return { ok: errors.length === 0, errors };
}

export interface ManagerSqliteRow {
  internal_manager_id: number;
  source: string;
  source_manager_id: string;
  name_en: string;
  name_ja: string | null;
  team_name: string | null;
  nationality: string | null;
  age: number | null;
  released_at: string | null;
  possession_game: number | null;
  quick_counter: number | null;
  long_ball_counter: number | null;
  out_wide: number | null;
  long_ball: number | null;
  overload: number | null;
  manager_rating: string | null;
  coaching_affinity: string | null;
  formation: string | null;
  has_booster: number | boolean;
  has_link_up_play: number | boolean;
  booster_confirmation: string | null;
  source_url: string | null;
  fetched_at: string;
}

export interface ManagerPgRow extends Omit<ManagerSqliteRow, "has_booster" | "has_link_up_play"> {
  has_booster: boolean;
  has_link_up_play: boolean;
  dataset_version: string;
  import_batch_id: string;
}

export function transformManager(row: ManagerSqliteRow, datasetVersion: string, importBatchId: string): ManagerPgRow {
  return {
    ...row,
    has_booster: Boolean(row.has_booster),
    has_link_up_play: Boolean(row.has_link_up_play),
    dataset_version: datasetVersion,
    import_batch_id: importBatchId,
  };
}

export function validateManager(row: ManagerPgRow): RowValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(row.internal_manager_id)) errors.push(`internal_manager_idが整数でない: ${row.internal_manager_id}`);
  if (!row.name_en || row.name_en.trim() === "") errors.push(`name_enが空: ${row.internal_manager_id}`);
  if (!row.source || row.source.trim() === "") errors.push(`sourceが空: ${row.internal_manager_id}`);
  if (!row.dataset_version || row.dataset_version.trim() === "") errors.push(`dataset_versionが空: ${row.internal_manager_id}`);
  return { ok: errors.length === 0, errors };
}

export interface PlayerCardAnalysisSqliteRow {
  efhub_card_id: string;
  weak_foot_usage: number | null;
  weak_foot_accuracy: number | null;
  form: number | null;
  condition_value: number | null;
  injury_resistance: number | null;
  player_model: Record<string, number>;
  positions: { code: string; familiarity: number | null; isRegistered: boolean }[];
  com_skills: string[];
  player_skills: string[];
  fetched_at: string;
}

export interface PlayerCardAnalysisPgRow {
  world_card_id: string;
  weak_foot_usage: number | null;
  weak_foot_accuracy: number | null;
  form: number | null;
  condition_value: number | null;
  injury_resistance: number | null;
  player_model: Record<string, number>;
  positions: { code: string; familiarity: number | null; isRegistered: boolean }[];
  com_skills: string[];
  player_skills: string[];
  source: string;
  fetched_at: string;
  dataset_version: string;
  import_batch_id: string;
}

export function transformPlayerCardAnalysis(
  row: PlayerCardAnalysisSqliteRow,
  datasetVersion: string,
  importBatchId: string,
): PlayerCardAnalysisPgRow {
  return {
    world_card_id: row.efhub_card_id,
    weak_foot_usage: row.weak_foot_usage,
    weak_foot_accuracy: row.weak_foot_accuracy,
    form: row.form,
    condition_value: row.condition_value,
    injury_resistance: row.injury_resistance,
    player_model: row.player_model,
    positions: row.positions,
    com_skills: row.com_skills,
    player_skills: row.player_skills,
    source: "efhub",
    fetched_at: row.fetched_at,
    dataset_version: datasetVersion,
    import_batch_id: importBatchId,
  };
}

/** world_player_cardsに存在しないIDを参照しているplayer_card_analysis行を検出する(外部キー相当の事前確認)。 */
export function findOrphanAnalysisRows(
  analysisRows: readonly PlayerCardAnalysisPgRow[],
  worldCardIds: ReadonlySet<string>,
): string[] {
  return analysisRows.filter((r) => !worldCardIds.has(r.world_card_id)).map((r) => r.world_card_id);
}

/** 主キー重複を検出する(投入前にDBの一意制約違反を予測できるようにする)。 */
export function findDuplicateIds<T>(rows: readonly T[], idOf: (row: T) => string): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const row of rows) {
    const id = idOf(row);
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

export interface ImportManifest {
  targetTable: string;
  datasetVersion: string;
  importBatchId: string;
  source: string;
  sourceRowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateIdCount: number;
  payloadHash: string;
  generatedAt: string;
}

export function buildManifest(params: {
  targetTable: string;
  datasetVersion: string;
  importBatchId: string;
  source: string;
  sourceRowCount: number;
  validRows: readonly unknown[];
  invalidRowCount: number;
  duplicateIdCount: number;
  now?: Date;
}): ImportManifest {
  return {
    targetTable: params.targetTable,
    datasetVersion: params.datasetVersion,
    importBatchId: params.importBatchId,
    source: params.source,
    sourceRowCount: params.sourceRowCount,
    validRowCount: params.validRows.length,
    invalidRowCount: params.invalidRowCount,
    duplicateIdCount: params.duplicateIdCount,
    payloadHash: computePayloadHash(params.validRows),
    generatedAt: (params.now ?? new Date()).toISOString(),
  };
}
