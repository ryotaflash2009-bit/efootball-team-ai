import { createHash } from "node:crypto";
import { ALLOWED_TARGET_TABLES, REFERENCE_SCHEMA } from "../real-import-guards";
import { computeRecordChecksum } from "./diff";

/**
 * Production参照データ自動更新の中核契約(Phase A)。
 *
 * このモジュールは純粋な定数・型・関数だけを持ち、DB・ネットワーク・環境変数へ一切触れない。
 * 自動更新パイプライン(Phase B以降)は、table分類・identity・canonicalization・checksum・
 * diff category・idempotency・concurrency・Secret境界・Evidenceについて、必ずここを
 * 単一の真実源として参照する。設計の全体像は
 * docs/production-readiness/reference-data-auto-update-architecture-v2.md を参照。
 *
 * 既存moduleとの関係:
 * - テーブルの許可リストは`real-import-guards.ts`の`ALLOWED_TARGET_TABLES`を再利用する
 *   (ここで別のallowlistを作らない。テストで両者の一致を固定する)。
 * - 行checksumは既存の`computeRecordChecksum`(diff.ts)をそのまま使う。Backup(Run #7を含む)の
 *   checksumはこの関数に依存しているため、関数自体は変更しない。代わりに、自動更新では
 *   checksum計算の「前に」値を`canonicalizeUpdateRow`で正規化する(PostgreSQLのjsonbが返す
 *   キー順序と一致させ、upstream由来の値とDB読み戻し値のchecksumを一致させるため)。
 */

export const AUTO_UPDATE_CONTRACT_VERSION = "1";

// ---------------------------------------------------------------------------
// 1. Table contracts
// ---------------------------------------------------------------------------

export type ReferenceTable = "world_player_cards" | "managers" | "player_card_analysis" | "import_batches";

export type UpdateTableClass =
  | "upstream_direct_with_local_computed_fields"
  | "upstream_direct"
  | "audit_metadata"
  | "frozen_internal_manual_dataset";

export type AutomaticOperation = "insert" | "update" | "append";

export type IdentityKind = "world_card_id" | "manager_source_identity" | "batch_uuid";

export interface UpdateTableContract {
  readonly table: ReferenceTable;
  readonly tableClass: UpdateTableClass;
  readonly upstream: "efootball-world" | "managers-json" | "none" | "internal";
  readonly automaticUpdateTarget: boolean;
  readonly identity: IdentityKind;
  /** Productionの主キー列(managersはupstream identityと異なる点に注意)。 */
  readonly primaryKeyColumn: string;
  readonly allowedAutomaticOperations: readonly AutomaticOperation[];
  /** 物理削除は全tableで禁止(removedはtombstone候補として人のreviewへ回す)。 */
  readonly physicalDeleteAllowed: false;
  readonly removalHandling: "tombstone_candidate_manual_review" | "forbidden";
  /** リポジトリ内DDL基準のProduction列(Backup specより広い。差分は KNOWN_BACKUP_COLUMN_GAPS)。 */
  readonly productionColumns: readonly string[];
  /** 自動更新時にローカルで計算する列。preserveまたはrecomputeし、黙って空にしない。 */
  readonly locallyComputedColumns: readonly string[];
  /** upstreamで更新しない(insert時のみ設定・curated)列。更新時は既存値を保持する。 */
  readonly preserveOnUpdateColumns: readonly string[];
  /** 比較・checksumから除外する列(取得時刻・監査用メタデータ等)。 */
  readonly volatileColumns: readonly string[];
  readonly jsonbColumns: readonly string[];
  readonly textArrayColumns: readonly string[];
  readonly timestampColumns: readonly string[];
  /** 後続Phaseで解決すべき要件(Phase AではProductionを変更しない)。 */
  readonly unresolvedRequirements: readonly string[];
}

const WORLD_COLUMNS = [
  "world_card_id", "name_en", "name_ja", "card_type", "registered_position", "nationality", "region",
  "league", "team", "ovr_base", "ovr_max", "maximum_level", "card_rating", "playing_style",
  "playing_style_def", "preferred_foot", "age", "height", "weight", "image_url", "mobile_image_url",
  "boost1", "boost2", "stats", "skills", "ai_styles", "appearance", "efhub_card_id", "efhub_conflicts",
  "name_sort_key", "source", "source_url", "appearance_updated_at", "fetched_at", "dataset_version",
  "import_batch_id", "created_at", "updated_at",
] as const;

const MANAGER_COLUMNS = [
  "internal_manager_id", "source", "source_manager_id", "name_en", "name_ja", "team_name", "nationality",
  "age", "released_at", "possession_game", "quick_counter", "long_ball_counter", "out_wide", "long_ball",
  "overload", "manager_rating", "coaching_affinity", "formation", "has_booster", "has_link_up_play",
  "booster_confirmation", "boosters", "link_up_plays", "name_sort_key", "source_url", "fetched_at",
  "dataset_version", "import_batch_id", "created_at", "updated_at",
] as const;

const ANALYSIS_COLUMNS = [
  "world_card_id", "weak_foot_usage", "weak_foot_accuracy", "form", "condition_value", "injury_resistance",
  "player_model", "positions", "com_skills", "player_skills", "efhub_name_en", "source", "source_url",
  "fetched_at", "dataset_version", "import_batch_id", "created_at", "updated_at",
] as const;

const IMPORT_BATCH_COLUMNS = [
  "batch_id", "dataset_version", "target_table", "source", "source_row_count", "inserted_row_count",
  "payload_hash", "status", "approved_by", "notes", "created_at", "verified_at", "rolled_back_at",
] as const;

/** 取得時刻・監査メタデータ。appearance_updated_atはupstreamの更新シグナルなので含めない。 */
const ROW_VOLATILE_COLUMNS = ["fetched_at", "created_at", "updated_at", "dataset_version", "import_batch_id"] as const;

export const UPDATE_TABLE_CONTRACTS: Readonly<Record<ReferenceTable, UpdateTableContract>> = Object.freeze({
  world_player_cards: Object.freeze({
    table: "world_player_cards",
    tableClass: "upstream_direct_with_local_computed_fields",
    upstream: "efootball-world",
    automaticUpdateTarget: true,
    identity: "world_card_id",
    primaryKeyColumn: "world_card_id",
    allowedAutomaticOperations: Object.freeze(["insert", "update"] as const),
    physicalDeleteAllowed: false,
    removalHandling: "tombstone_candidate_manual_review",
    productionColumns: Object.freeze([...WORLD_COLUMNS]),
    locallyComputedColumns: Object.freeze(["efhub_card_id", "efhub_conflicts", "name_sort_key"]),
    // ai_styles/appearanceはdetail extensionでSQLiteから投入された列で、upstream上の正確な
    // 対応はPhase Bで確認するまで既存値を保持する(黙って上書き・空にしない)。
    preserveOnUpdateColumns: Object.freeze(["ai_styles", "appearance"]),
    volatileColumns: Object.freeze([...ROW_VOLATILE_COLUMNS]),
    jsonbColumns: Object.freeze(["stats", "appearance", "efhub_conflicts"]),
    textArrayColumns: Object.freeze(["skills", "ai_styles"]),
    timestampColumns: Object.freeze(["appearance_updated_at", "fetched_at", "created_at", "updated_at"]),
    unresolvedRequirements: Object.freeze([
      "Backupがappearance_updated_at・import_batch_idを収録していない(Phase Fで修正)",
      "ai_styles・appearanceのupstream対応の確認(Phase B)",
    ]),
  }),
  managers: Object.freeze({
    table: "managers",
    tableClass: "upstream_direct",
    upstream: "managers-json",
    automaticUpdateTarget: true,
    identity: "manager_source_identity",
    primaryKeyColumn: "internal_manager_id",
    allowedAutomaticOperations: Object.freeze(["insert", "update"] as const),
    physicalDeleteAllowed: false,
    removalHandling: "tombstone_candidate_manual_review",
    productionColumns: Object.freeze([...MANAGER_COLUMNS]),
    locallyComputedColumns: Object.freeze(["name_sort_key"]),
    // 既存sync-managersのON CONFLICT DO UPDATEが更新しない(insert時のみ設定される)列。
    preserveOnUpdateColumns: Object.freeze([
      "internal_manager_id", "name_ja", "team_name", "nationality", "age", "manager_rating", "coaching_affinity", "formation",
    ]),
    volatileColumns: Object.freeze([...ROW_VOLATILE_COLUMNS]),
    jsonbColumns: Object.freeze(["boosters", "link_up_plays"]),
    textArrayColumns: Object.freeze([]),
    timestampColumns: Object.freeze(["fetched_at", "created_at", "updated_at"]),
    unresolvedRequirements: Object.freeze([
      "(source, source_manager_id)のDB unique constraintが無い(Phase Gまたは別Production migration)",
      "Backupがimport_batch_idを収録していない(Phase Fで修正)",
    ]),
  }),
  player_card_analysis: Object.freeze({
    table: "player_card_analysis",
    tableClass: "frozen_internal_manual_dataset",
    upstream: "none",
    automaticUpdateTarget: false,
    identity: "world_card_id",
    primaryKeyColumn: "world_card_id",
    allowedAutomaticOperations: Object.freeze([]),
    physicalDeleteAllowed: false,
    removalHandling: "forbidden",
    productionColumns: Object.freeze([...ANALYSIS_COLUMNS]),
    locallyComputedColumns: Object.freeze([]),
    preserveOnUpdateColumns: Object.freeze([...ANALYSIS_COLUMNS]),
    volatileColumns: Object.freeze([]),
    jsonbColumns: Object.freeze(["player_model", "positions"]),
    textArrayColumns: Object.freeze(["com_skills", "player_skills"]),
    timestampColumns: Object.freeze(["fetched_at", "created_at", "updated_at"]),
    unresolvedRequirements: Object.freeze([
      "world_player_cardsの削除がon delete cascadeでこのtableへ波及するため、World cardの物理削除は禁止",
      "Backupがimport_batch_idを収録していない(Phase Fで修正)",
    ]),
  }),
  import_batches: Object.freeze({
    table: "import_batches",
    tableClass: "audit_metadata",
    upstream: "internal",
    automaticUpdateTarget: true,
    identity: "batch_uuid",
    primaryKeyColumn: "batch_id",
    allowedAutomaticOperations: Object.freeze(["append"] as const),
    physicalDeleteAllowed: false,
    removalHandling: "forbidden",
    productionColumns: Object.freeze([...IMPORT_BATCH_COLUMNS]),
    locallyComputedColumns: Object.freeze([]),
    preserveOnUpdateColumns: Object.freeze([]),
    volatileColumns: Object.freeze([]),
    jsonbColumns: Object.freeze([]),
    textArrayColumns: Object.freeze([]),
    timestampColumns: Object.freeze(["created_at", "verified_at", "rolled_back_at"]),
    unresolvedRequirements: Object.freeze(["status遷移の実書込みはPhase G(Phase Aは型契約のみ)"]),
  }),
});

/** 自動更新の対象table(固定順序。table checksum・Evidenceの並び順もこの順)。 */
export const AUTO_UPDATE_TARGET_TABLES: readonly ReferenceTable[] = Object.freeze(["world_player_cards", "managers", "import_batches"]);
export const AUTO_UPDATE_EXCLUDED_TABLES: readonly ReferenceTable[] = Object.freeze(["player_card_analysis"]);

/** リポジトリ内DDL基準で、Production列のうちBackup(backup-schema.ts)が収録していない列。Phase Fで解消する。 */
export const KNOWN_BACKUP_COLUMN_GAPS: Readonly<Record<ReferenceTable, readonly string[]>> = Object.freeze({
  world_player_cards: Object.freeze(["appearance_updated_at", "import_batch_id"]),
  managers: Object.freeze(["import_batch_id"]),
  player_card_analysis: Object.freeze(["import_batch_id"]),
  import_batches: Object.freeze([]),
});

/** import_batchesの行status(DDLのcheck制約と一致)。当該batch自身の行だけがこの順に一方向で遷移できる。 */
export type ImportBatchStatus = "pending" | "verified" | "rolled_back";
export const IMPORT_BATCH_STATUS_TRANSITIONS: Readonly<Record<ImportBatchStatus, readonly ImportBatchStatus[]>> = Object.freeze({
  pending: Object.freeze(["verified", "rolled_back"] as const),
  verified: Object.freeze(["rolled_back"] as const),
  rolled_back: Object.freeze([]),
});

export function canTransitionImportBatchStatus(from: ImportBatchStatus, to: ImportBatchStatus): boolean {
  return IMPORT_BATCH_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * tableを契約へ解決する。スキーマ修飾はreference_dataだけを許可し、auth.*・public.*・未知tableは
 * すべて例外にする(fail closed)。
 */
export function getUpdateTableContract(table: string): UpdateTableContract {
  if (typeof table !== "string" || table.length === 0) throw new Error("tableが指定されていない(blocked)");
  let name = table;
  const dot = table.indexOf(".");
  if (dot !== -1) {
    const schema = table.slice(0, dot);
    if (schema !== REFERENCE_SCHEMA) throw new Error(`reference_data以外のschemaは扱えない: ${schema}(blocked)`);
    name = table.slice(dot + 1);
  }
  if (!ALLOWED_TARGET_TABLES.includes(name) || !Object.prototype.hasOwnProperty.call(UPDATE_TABLE_CONTRACTS, name)) {
    throw new Error(`契約に存在しないtable: ${name}(blocked)`);
  }
  return UPDATE_TABLE_CONTRACTS[name as ReferenceTable];
}

/** 自動更新の対象tableだけを許可する(player_card_analysis・auth・user dataはblocked)。 */
export function assertAutoUpdateTargetTable(table: string): ReferenceTable {
  const contract = getUpdateTableContract(table);
  if (!contract.automaticUpdateTarget) throw new Error(`${contract.table}は自動更新の対象外(blocked)`);
  return contract.table;
}

/** table集合を検証し、契約の固定順序へ並べ替えて返す。1件でも不正ならblocked。 */
export function normalizeTargetTableSet(tables: readonly string[]): ReferenceTable[] {
  if (!Array.isArray(tables) || tables.length === 0) throw new Error("target tableが空(blocked)");
  const resolved = new Set(tables.map((t) => assertAutoUpdateTargetTable(t)));
  if (resolved.size !== tables.length) throw new Error("target tableが重複している(blocked)");
  return AUTO_UPDATE_TARGET_TABLES.filter((t) => resolved.has(t));
}

// ---------------------------------------------------------------------------
// 2. Identity contracts
// ---------------------------------------------------------------------------

const WORLD_CARD_ID_RE = /^[0-9]{1,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

/** World cardのidentity。数字だけの文字列(DDLのcheck制約と一致)。trimやfallbackは行わない。 */
export function worldCardIdentity(value: unknown): string {
  if (typeof value !== "string" || !WORLD_CARD_ID_RE.test(value)) {
    throw new Error("world_card_idが数字だけの文字列ではない(blocked)");
  }
  return value;
}

/**
 * Managerのupstream identity。sourceとsource_manager_idの組をJSON配列として符号化するため、
 * 区切り文字を含む値でも曖昧にならない(例: "a:b"+"c" と "a"+"b:c" は別identity)。
 * internal_manager_idはProductionの主キーであり、upstream identityではない。
 */
export function managerIdentity(source: unknown, sourceManagerId: unknown): string {
  if (typeof source !== "string" || typeof sourceManagerId !== "string") {
    throw new Error("managerのsource/source_manager_idが文字列ではない(blocked)");
  }
  const s = source.trim();
  const id = sourceManagerId.trim();
  if (s.length === 0 || id.length === 0) throw new Error("managerのsource/source_manager_idが空(blocked)");
  if (CONTROL_CHARS_RE.test(s) || CONTROL_CHARS_RE.test(id)) throw new Error("managerのidentityに制御文字が含まれている(blocked)");
  return JSON.stringify([s, id]);
}

/** import_batchesのidentity(UUID、小文字の正規形だけを許可)。 */
export function importBatchIdentity(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) throw new Error("batch_idが正規形のUUIDではない(blocked)");
  return value;
}

/** tableの行からidentityを取り出す(表示名・行番号・manager名だけ等は使わない)。 */
export function rowIdentity(table: ReferenceTable, row: Readonly<Record<string, unknown>>): string {
  switch (UPDATE_TABLE_CONTRACTS[table].identity) {
    case "world_card_id":
      return worldCardIdentity(row.world_card_id);
    case "manager_source_identity":
      return managerIdentity(row.source, row.source_manager_id);
    case "batch_uuid":
      return importBatchIdentity(row.batch_id);
  }
}

/** 同一集合内で重複しているidentityを返す(空配列なら重複なし)。 */
export function findDuplicateIdentities(identities: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of identities) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup].sort(compareCanonicalStrings);
}

// ---------------------------------------------------------------------------
// 3. Canonicalization and checksums
// ---------------------------------------------------------------------------

/** UTF-8バイト列の辞書順で比較する(ロケール非依存の決定的な順序)。 */
export function compareCanonicalStrings(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** PostgreSQL jsonbのobject key順序(UTF-8バイト長が短い順、同じ長さならバイト順)。 */
export function compareJsonbKeys(a: string, b: string): number {
  const la = Buffer.byteLength(a, "utf8");
  const lb = Buffer.byteLength(b, "utf8");
  return la !== lb ? la - lb : compareCanonicalStrings(a, b);
}

function assertCanonicalString(value: string, label: string): void {
  if (value.includes("\u0000")) throw new Error(`${label}にNUL文字が含まれている(PostgreSQLが拒否するためblocked)`);
}

function canonicalNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label}が有限の数値ではない(NaN/Infinityはblocked)`);
  return Object.is(value, -0) ? 0 : value; // 負のゼロは0へ正規化する(JSON表現・jsonbとも区別しない)
}

/**
 * jsonb値を再帰的に正規化する。objectのkeyはPostgreSQL jsonbと同じ順序へ並べ、配列は順序を保持する。
 * undefined・関数・symbol・bigint・Date・非有限数・NUL文字はblocked(暗黙変換しない)。
 */
export function canonicalizeJsonbValue(value: unknown, label = "jsonb"): unknown {
  if (value === null) return null;
  if (typeof value === "string") {
    assertCanonicalString(value, label);
    return value;
  }
  if (typeof value === "number") return canonicalNumber(value, label);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v, i) => canonicalizeJsonbValue(v, `${label}[${i}]`));
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort(compareJsonbKeys)) {
      assertCanonicalString(key, `${label} key`);
      if (src[key] === undefined) throw new Error(`${label}.${key}がundefined(blocked)`);
      out[key] = canonicalizeJsonbValue(src[key], `${label}.${key}`);
    }
    return out;
  }
  throw new Error(`${label}にjsonbで表現できない値が含まれている(blocked)`);
}

/** text[]を検証する。要素はすべて文字列で、順序はそのまま保持する(並べ替えない)。 */
export function canonicalizeTextArray(value: unknown, label = "text[]"): string[] {
  if (!Array.isArray(value)) throw new Error(`${label}が配列ではない(blocked)`);
  return value.map((v, i) => {
    if (typeof v !== "string") throw new Error(`${label}[${i}]が文字列ではない(blocked)`);
    assertCanonicalString(v, `${label}[${i}]`);
    return v;
  });
}

const ISO_WITH_ZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/;

/** timestampをUTC・ミリ秒付きISO 8601へ正規化する。タイムゾーンの無い文字列・不正値はblocked。 */
export function normalizeTimestamp(value: unknown, label = "timestamp"): string {
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" && ISO_WITH_ZONE_RE.test(value)) {
    date = new Date(value);
  } else {
    throw new Error(`${label}がタイムゾーン付きISO 8601ではない(blocked)`);
  }
  if (Number.isNaN(date.getTime())) throw new Error(`${label}が不正な日時(blocked)`);
  return date.toISOString();
}

function canonicalScalar(value: unknown, label: string): unknown {
  if (value === null) return null;
  if (typeof value === "string") {
    assertCanonicalString(value, label);
    return value;
  }
  if (typeof value === "number") return canonicalNumber(value, label);
  if (typeof value === "boolean") return value;
  throw new Error(`${label}が想定外の型(blocked)`);
}

/**
 * checksum比較用に1行を正規化する。契約の比較列(productionColumns − volatileColumns)がすべて
 * 存在することを要求し(undefinedは許可しない、SQL NULLはnull)、列種別ごとに正規化する。
 * 契約に無い列が含まれていればschema driftとしてblocked。
 */
export function canonicalizeUpdateRow(table: ReferenceTable, row: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const contract = UPDATE_TABLE_CONTRACTS[table];
  const known = new Set(contract.productionColumns);
  for (const key of Object.keys(row)) {
    if (!known.has(key)) throw new Error(`${table}に契約外の列がある: ${key}(schema drift、blocked)`);
  }
  const volatile = new Set(contract.volatileColumns);
  const out: Record<string, unknown> = {};
  for (const col of contract.productionColumns) {
    if (volatile.has(col)) continue;
    if (!(col in row) || row[col] === undefined) throw new Error(`${table}.${col}が欠落している(blocked)`);
    const value = row[col];
    const label = `${table}.${col}`;
    if (value === null) out[col] = null;
    else if (contract.jsonbColumns.includes(col)) out[col] = canonicalizeJsonbValue(value, label);
    else if (contract.textArrayColumns.includes(col)) out[col] = canonicalizeTextArray(value, label);
    else if (contract.timestampColumns.includes(col)) out[col] = normalizeTimestamp(value, label);
    else out[col] = canonicalScalar(value, label);
  }
  return out;
}

/** 正規化済みの行のchecksum(SHA-256、既存computeRecordChecksumを再利用)。 */
export function computeUpdateRowChecksum(table: ReferenceTable, row: Readonly<Record<string, unknown>>): string {
  return computeRecordChecksum(canonicalizeUpdateRow(table, row));
}

export interface IdentifiedRowChecksum {
  identity: string;
  checksum: string;
}

/** identityのバイト順でrowを並べ、table checksumを計算する(入力順序に依存しない)。重複identityはblocked。 */
export function computeUpdateTableChecksum(table: ReferenceTable, rows: readonly Readonly<Record<string, unknown>>[]): string {
  const entries: IdentifiedRowChecksum[] = rows.map((r) => ({ identity: rowIdentity(table, r), checksum: computeUpdateRowChecksum(table, r) }));
  const dup = findDuplicateIdentities(entries.map((e) => e.identity));
  if (dup.length > 0) throw new Error(`${table}に重複identityがある(${dup.length}件、blocked)`);
  entries.sort((a, b) => compareCanonicalStrings(a.identity, b.identity));
  return sha256Hex(JSON.stringify(entries.map((e) => [e.identity, e.checksum])));
}

/** 複数tableのchecksumを、契約の固定table順で結合したtotal checksum。 */
export function computeUpdateTotalChecksum(tableChecksums: Readonly<Partial<Record<ReferenceTable, string>>>): string {
  const present = Object.keys(tableChecksums);
  const ordered = normalizeTargetTableSet(present);
  return sha256Hex(JSON.stringify(ordered.map((t) => [t, tableChecksums[t]])));
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX_RE.test(value);
}

/** Evidence・ログ用の短縮表示(先頭12文字)。完全値は内部artifactだけに持つ。 */
export function shortChecksum(value: string): string {
  if (!isSha256Hex(value)) throw new Error("checksumがSHA-256 hexではない(blocked)");
  return value.slice(0, 12);
}

// ---------------------------------------------------------------------------
// 4. Diff categories and diff report
// ---------------------------------------------------------------------------

export type DiffCategory =
  | "added"
  | "changed"
  | "unchanged"
  | "removed"
  | "resurrected"
  | "duplicate"
  | "invalid"
  | "schema_drift"
  | "source_missing";

export type PolicySeverity = "pass" | "warning" | "manual_review" | "hard_block";

export interface DiffCategoryDefinition {
  readonly meaning: string;
  /** Policyを通す前の既定の扱い(added/changedはtable別Policyが最終判定する)。 */
  readonly defaultSeverity: PolicySeverity;
  readonly appliesAutomatically: boolean;
}

export const DIFF_CATEGORIES: Readonly<Record<DiffCategory, DiffCategoryDefinition>> = Object.freeze({
  added: Object.freeze({ meaning: "upstreamに新しく現れたidentity", defaultSeverity: "pass", appliesAutomatically: true }),
  changed: Object.freeze({ meaning: "既存identityの比較列checksumが変化", defaultSeverity: "pass", appliesAutomatically: true }),
  unchanged: Object.freeze({ meaning: "既存identityの比較列checksumが同一", defaultSeverity: "pass", appliesAutomatically: false }),
  removed: Object.freeze({ meaning: "Productionに存在するがupstream snapshotに無い。tombstone候補であり物理削除を意味しない", defaultSeverity: "manual_review", appliesAutomatically: false }),
  resurrected: Object.freeze({ meaning: "tombstone履歴にあるidentityの再出現", defaultSeverity: "manual_review", appliesAutomatically: false }),
  duplicate: Object.freeze({ meaning: "同一snapshot内で同じidentityが複数", defaultSeverity: "hard_block", appliesAutomatically: false }),
  invalid: Object.freeze({ meaning: "schema/value validation失敗(不正な数値・jsonb・text[]・timestamp等)", defaultSeverity: "hard_block", appliesAutomatically: false }),
  schema_drift: Object.freeze({ meaning: "未知の列・欠落した列・非互換な型", defaultSeverity: "hard_block", appliesAutomatically: false }),
  source_missing: Object.freeze({ meaning: "page・table・sourceの一部が取得できていない", defaultSeverity: "hard_block", appliesAutomatically: false }),
});

/** 既存diff.ts(DiffReport)の名称との対応。既存moduleは変更しない。 */
export const LEGACY_DIFF_FIELD_MAP = Object.freeze({ added: "added", updated: "changed", removedCandidate: "removed", unchanged: "unchanged" } as const);

export const MAX_SAMPLE_IDENTIFIERS = 20;

export interface UpdateDiffReport {
  table: ReferenceTable;
  beforeCount: number;
  afterCount: number;
  addedCount: number;
  changedCount: number;
  removedCount: number;
  unchangedCount: number;
  resurrectedCount: number;
  duplicateCount: number;
  invalidCount: number;
  schemaDriftCount: number;
  sourceMissingCount: number;
  beforeChecksum: string;
  afterChecksum: string;
  sourceMetadataChecksum: string;
  sampleIdentifiers: readonly string[];
  changedFieldNames: readonly string[];
}

const DIFF_REPORT_KEYS: ReadonlySet<string> = new Set([
  "table", "beforeCount", "afterCount", "addedCount", "changedCount", "removedCount", "unchangedCount", "resurrectedCount",
  "duplicateCount", "invalidCount", "schemaDriftCount", "sourceMissingCount", "beforeChecksum", "afterChecksum",
  "sourceMetadataChecksum", "sampleIdentifiers", "changedFieldNames",
]);

/** diff reportが契約どおりか検証する(行データ・変更値・未知のkeyを含めない)。問題点を列挙して返す。 */
export function validateUpdateDiffReport(report: unknown): string[] {
  const problems: string[] = [];
  if (!report || typeof report !== "object" || Array.isArray(report)) return ["diff reportがobjectではない"];
  const r = report as Record<string, unknown>;
  for (const key of Object.keys(r)) if (!DIFF_REPORT_KEYS.has(key)) problems.push(`契約外のkey: ${key}`);
  let contract: UpdateTableContract | null = null;
  try {
    contract = getUpdateTableContract(String(r.table));
  } catch {
    problems.push("tableが契約外");
  }
  for (const key of ["beforeCount", "afterCount", "addedCount", "changedCount", "removedCount", "unchangedCount", "resurrectedCount", "duplicateCount", "invalidCount", "schemaDriftCount", "sourceMissingCount"]) {
    const v = r[key];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) problems.push(`${key}が0以上の整数ではない`);
  }
  for (const key of ["beforeChecksum", "afterChecksum", "sourceMetadataChecksum"]) if (!isSha256Hex(r[key])) problems.push(`${key}がSHA-256 hexではない`);
  const samples = r.sampleIdentifiers;
  if (!Array.isArray(samples) || samples.length > MAX_SAMPLE_IDENTIFIERS || samples.some((s) => typeof s !== "string")) {
    problems.push(`sampleIdentifiersは最大${MAX_SAMPLE_IDENTIFIERS}件の文字列配列`);
  } else if (contract) {
    for (const s of samples) {
      if (!isValidIdentityForTable(contract.table, s)) {
        problems.push("sampleIdentifiersにidentity形式ではない値がある");
        break;
      }
    }
  }
  const fields = r.changedFieldNames;
  if (!Array.isArray(fields) || fields.some((f) => typeof f !== "string")) problems.push("changedFieldNamesが文字列配列ではない");
  else if (contract && fields.some((f) => !contract!.productionColumns.includes(f as string))) problems.push("changedFieldNamesに契約外の列名がある");
  return problems;
}

function isValidIdentityForTable(table: ReferenceTable, identity: string): boolean {
  try {
    switch (UPDATE_TABLE_CONTRACTS[table].identity) {
      case "world_card_id":
        worldCardIdentity(identity);
        return true;
      case "batch_uuid":
        importBatchIdentity(identity);
        return true;
      case "manager_source_identity": {
        const parsed = JSON.parse(identity);
        return Array.isArray(parsed) && parsed.length === 2 && managerIdentity(parsed[0], parsed[1]) === identity;
      }
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 5. Idempotency and concurrency
// ---------------------------------------------------------------------------

export interface IdempotencyInput {
  sourceChecksum: string;
  targetTables: readonly string[];
  updaterVersion: string;
}

function assertVersion(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[0-9A-Za-z._-]{1,64}$/.test(value)) throw new Error(`${label}が不正(blocked)`);
  return value;
}

/**
 * update batchのidempotency key。source snapshot checksum・target table集合(契約順へ正規化)・
 * updater version・contract versionを、区切り文字ではなくcanonical JSONで符号化してSHA-256を取る。
 */
export function computeUpdateIdempotencyKey(input: IdempotencyInput): string {
  if (!isSha256Hex(input.sourceChecksum)) throw new Error("sourceChecksumがSHA-256 hexではない(blocked)");
  const payload = {
    contractVersion: AUTO_UPDATE_CONTRACT_VERSION,
    sourceChecksum: input.sourceChecksum,
    targetTables: normalizeTargetTableSet(input.targetTables),
    updaterVersion: assertVersion(input.updaterVersion, "updaterVersion"),
  };
  return sha256Hex(JSON.stringify(payload));
}

export function computeBackupIdempotencyKey(updateIdempotencyKey: string): string {
  if (!isSha256Hex(updateIdempotencyKey)) throw new Error("idempotency keyが不正(blocked)");
  return sha256Hex(JSON.stringify({ kind: "pre-apply-backup", updateIdempotencyKey }));
}

export function computeApplyIdempotencyKey(updateIdempotencyKey: string, backupRunId: string): string {
  if (!isSha256Hex(updateIdempotencyKey)) throw new Error("idempotency keyが不正(blocked)");
  if (typeof backupRunId !== "string" || !/^[0-9]{1,20}$/.test(backupRunId)) throw new Error("backupRunIdが不正(blocked)");
  return sha256Hex(JSON.stringify({ kind: "production-apply", updateIdempotencyKey, backupRunId }));
}

/** GitHub Actions concurrency group(Phase AではWorkflowへ追加しない、名前の契約だけを固定する)。 */
export const CONCURRENCY_GROUPS = Object.freeze({
  detection: "reference-data-update-detection",
  productionWrite: "reference-data-production-write",
} as const);

export type PipelineStage =
  | "detection"
  | "source_fetch"
  | "dry_run"
  | "backup"
  | "production_apply"
  | "rollback";

export interface StageConcurrencyContract {
  readonly scope: "parallel_allowed" | "per_source" | "per_candidate" | "global_production_write";
  readonly group: string | null;
}

export const STAGE_CONCURRENCY: Readonly<Record<PipelineStage, StageConcurrencyContract>> = Object.freeze({
  detection: Object.freeze({ scope: "parallel_allowed", group: CONCURRENCY_GROUPS.detection }),
  source_fetch: Object.freeze({ scope: "per_source", group: null }),
  dry_run: Object.freeze({ scope: "per_candidate", group: null }),
  backup: Object.freeze({ scope: "global_production_write", group: CONCURRENCY_GROUPS.productionWrite }),
  production_apply: Object.freeze({ scope: "global_production_write", group: CONCURRENCY_GROUPS.productionWrite }),
  rollback: Object.freeze({ scope: "global_production_write", group: CONCURRENCY_GROUPS.productionWrite }),
});

// ---------------------------------------------------------------------------
// 6. Secret boundaries (names only; no values exist in this repository)
// ---------------------------------------------------------------------------

export const BACKUP_SECRET_NAMES = Object.freeze([
  "REFERENCE_DATA_BACKUP_DB_URL",
  "REFERENCE_DATA_BACKUP_DB_CA_CERT",
  "REFERENCE_DATA_BACKUP_AGE_RECIPIENT",
  "REFERENCE_DATA_BACKUP_R2_ACCESS_KEY_ID",
  "REFERENCE_DATA_BACKUP_R2_SECRET_ACCESS_KEY",
  "REFERENCE_DATA_BACKUP_R2_ENDPOINT",
  "REFERENCE_DATA_BACKUP_R2_BUCKET",
] as const);

/** 候補名(未作成・未登録)。Phase Gで本人承認を経て作成する。 */
export const APPLY_SECRET_NAMES = Object.freeze(["REFERENCE_DATA_APPLY_DB_URL", "REFERENCE_DATA_APPLY_DB_CA_CERT"] as const);

export type PipelineComponent = "detection" | "dry_run" | "backup" | "production_apply" | "notification";

export interface SecretBoundary {
  readonly requiredSecrets: readonly string[];
  readonly forbiddenSecrets: readonly string[];
  readonly environment: string | null;
  readonly dbRole: string | null;
  readonly logPolicy: "never_log_secret_values";
  readonly rotationOwner: "project_owner";
  readonly revocation: string;
}

const ALL_PRIVILEGED_SECRETS = [...BACKUP_SECRET_NAMES, ...APPLY_SECRET_NAMES];

export const SECRET_BOUNDARIES: Readonly<Record<PipelineComponent, SecretBoundary>> = Object.freeze({
  detection: Object.freeze({
    requiredSecrets: Object.freeze([]),
    forbiddenSecrets: Object.freeze([...ALL_PRIVILEGED_SECRETS]),
    environment: null,
    dbRole: null,
    logPolicy: "never_log_secret_values",
    rotationOwner: "project_owner",
    revocation: "Secretを持たない(公開sourceと公開anon read設定だけを使う)",
  }),
  dry_run: Object.freeze({
    requiredSecrets: Object.freeze([]),
    forbiddenSecrets: Object.freeze([...ALL_PRIVILEGED_SECRETS]),
    environment: null,
    dbRole: null,
    logPolicy: "never_log_secret_values",
    rotationOwner: "project_owner",
    revocation: "Secretを持たない(使い捨てPostgreSQLの一時資格情報はjob内で生成・破棄)",
  }),
  backup: Object.freeze({
    requiredSecrets: Object.freeze([...BACKUP_SECRET_NAMES]),
    forbiddenSecrets: Object.freeze([...APPLY_SECRET_NAMES]),
    environment: "production-backup-approval",
    dbRole: "reference_data_backup_reader",
    logPolicy: "never_log_secret_values",
    rotationOwner: "project_owner",
    revocation: "reference-data-production-backup-role-revocation.mdの手順",
  }),
  production_apply: Object.freeze({
    requiredSecrets: Object.freeze([...APPLY_SECRET_NAMES]),
    forbiddenSecrets: Object.freeze([...BACKUP_SECRET_NAMES]),
    environment: "reference-data-production-apply",
    dbRole: "reference_data_updater",
    logPolicy: "never_log_secret_values",
    rotationOwner: "project_owner",
    revocation: "roleをNOLOGIN化し、Environment Secretを削除する(Phase Gで手順化)",
  }),
  notification: Object.freeze({
    requiredSecrets: Object.freeze([]),
    forbiddenSecrets: Object.freeze([...ALL_PRIVILEGED_SECRETS]),
    environment: null,
    dbRole: null,
    logPolicy: "never_log_secret_values",
    rotationOwner: "project_owner",
    revocation: "GITHUB_TOKEN(job単位で自動発行・自動失効)だけを使う",
  }),
});

/** 将来のapply用DB role契約(未作成)。Backup roleとは分離する。 */
export const UPDATER_ROLE_CONTRACT = Object.freeze({
  roleName: "reference_data_updater",
  bypassRls: false,
  tableOwner: false,
  sharedWithBackupRole: false,
  writableTables: Object.freeze(["world_player_cards", "managers", "import_batches"] as const),
  forbiddenAccess: Object.freeze(["auth.*", "public.my_team_snapshots", "player_card_analysis (write)"]),
});

// ---------------------------------------------------------------------------
// 7. Evidence contract
// ---------------------------------------------------------------------------

export interface UpdateEvidence {
  batchId: string;
  idempotencyKey: string;
  sourceChecksum: string;
  sourceTimestamp: string | null;
  detectedAt: string;
  updaterVersion: string;
  contractVersion: string;
  commitSha: string;
  targetTables: readonly ReferenceTable[];
  beforeCounts: Readonly<Partial<Record<ReferenceTable, number>>>;
  afterCounts: Readonly<Partial<Record<ReferenceTable, number>>>;
  diffCounts: Readonly<Partial<Record<ReferenceTable, Readonly<Partial<Record<DiffCategory, number>>>>>>;
  beforeChecksums: Readonly<Partial<Record<ReferenceTable, string>>>;
  afterChecksums: Readonly<Partial<Record<ReferenceTable, string>>>;
  sourceMetadataChecksum: string;
  policyResult: PolicySeverity;
  policyReasons: readonly string[];
  sampleIdentifiers: Readonly<Partial<Record<ReferenceTable, readonly string[]>>>;
  backupRunId: string | null;
  backupValidity: "valid" | "invalid" | "not_checked";
  dryRunResult: "verified" | "failed" | "not_run";
  approvalTimestamp: string | null;
  applyTimestamp: string | null;
  postVerifyResult: "passed" | "failed" | "not_run";
  finalStatus: string;
}

const EVIDENCE_KEYS: ReadonlySet<string> = new Set([
  "batchId", "idempotencyKey", "sourceChecksum", "sourceTimestamp", "detectedAt", "updaterVersion", "contractVersion",
  "commitSha", "targetTables", "beforeCounts", "afterCounts", "diffCounts", "beforeChecksums", "afterChecksums",
  "sourceMetadataChecksum", "policyResult", "policyReasons", "sampleIdentifiers", "backupRunId", "backupValidity",
  "dryRunResult", "approvalTimestamp", "applyTimestamp", "postVerifyResult", "finalStatus",
]);

/** Evidenceへ出してはならない値のパターン(URL・接続文字列・秘密鍵・token・Project Ref様の識別子・object key)。 */
const FORBIDDEN_EVIDENCE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/[a-z][a-z0-9+.-]*:\/\//i, "URL/接続文字列"],
  [/supabase\.(co|com|net)|pooler\.|r2\.cloudflarestorage/i, "private endpoint"],
  [/AGE-SECRET-KEY|-----BEGIN/i, "秘密鍵"],
  [/eyJ[A-Za-z0-9_-]{10,}/, "token"],
  [/password|passwd|secret_access_key|access_key_id/i, "credential"],
  [/\.age\b|\.manifest\.json\b|(pre-apply|daily|weekly|monthly)\//i, "object key"],
  [/@[a-z0-9-]+\.[a-z]{2,}/i, "email"],
];

function scanEvidenceString(value: string, path: string, problems: string[]): void {
  for (const [re, label] of FORBIDDEN_EVIDENCE_PATTERNS) {
    if (re.test(value)) {
      problems.push(`${path}に${label}らしき値がある`);
      return;
    }
  }
  if (/\b[0-9a-f]{64}\b/i.test(value) && !path.endsWith("sourceChecksum") && !path.endsWith("idempotencyKey") && !path.endsWith("sourceMetadataChecksum")) {
    problems.push(`${path}に完全なchecksumがある(Evidenceでは短縮表示を使う)`);
  }
}

function walkEvidence(value: unknown, path: string, problems: string[]): void {
  if (value === null || typeof value === "number" || typeof value === "boolean") return;
  if (typeof value === "string") return scanEvidenceString(value, path, problems);
  if (Array.isArray(value)) return value.forEach((v, i) => walkEvidence(v, `${path}[${i}]`, problems));
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) walkEvidence(v, `${path}.${k}`, problems);
    return;
  }
  problems.push(`${path}に想定外の型がある`);
}

/**
 * Evidenceが契約どおりか検証する。許可されたkeyだけ・table別mapのkeyは契約table・counts/diffCountsは
 * 数値・checksumは短縮表示(sourceChecksum/idempotencyKey/sourceMetadataChecksumは完全値)・
 * sampleIdentifiersは上限以下かつidentity形式・URL/Secret/object key/email様の値なし。
 */
export function validateUpdateEvidence(evidence: unknown): string[] {
  const problems: string[] = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return ["Evidenceがobjectではない"];
  const e = evidence as Record<string, unknown>;
  for (const key of Object.keys(e)) if (!EVIDENCE_KEYS.has(key)) problems.push(`契約外のkey: ${key}`);
  for (const key of EVIDENCE_KEYS) if (!(key in e)) problems.push(`必須keyが無い: ${key}`);

  for (const key of ["sourceChecksum", "idempotencyKey", "sourceMetadataChecksum"]) if (key in e && !isSha256Hex(e[key])) problems.push(`${key}がSHA-256 hexではない`);

  const tableMaps = ["beforeCounts", "afterCounts", "diffCounts", "beforeChecksums", "afterChecksums", "sampleIdentifiers"];
  for (const mapKey of tableMaps) {
    const map = e[mapKey];
    if (map === undefined) continue;
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      problems.push(`${mapKey}がtable別objectではない`);
      continue;
    }
    for (const [table, value] of Object.entries(map as Record<string, unknown>)) {
      let contract: UpdateTableContract;
      try {
        contract = getUpdateTableContract(table);
      } catch {
        problems.push(`${mapKey}に契約外のtable: ${table}`);
        continue;
      }
      if (mapKey === "beforeCounts" || mapKey === "afterCounts") {
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0) problems.push(`${mapKey}.${table}が0以上の整数ではない`);
      } else if (mapKey === "diffCounts") {
        if (!value || typeof value !== "object") problems.push(`diffCounts.${table}がobjectではない`);
        else for (const [cat, n] of Object.entries(value as Record<string, unknown>)) {
          if (!(cat in DIFF_CATEGORIES)) problems.push(`diffCounts.${table}に未知のcategory: ${cat}`);
          if (typeof n !== "number" || !Number.isInteger(n) || n < 0) problems.push(`diffCounts.${table}.${cat}が0以上の整数ではない`);
        }
      } else if (mapKey === "beforeChecksums" || mapKey === "afterChecksums") {
        if (typeof value !== "string" || !/^[0-9a-f]{12}$/.test(value)) problems.push(`${mapKey}.${table}は12桁の短縮checksumにする`);
      } else if (mapKey === "sampleIdentifiers") {
        if (!Array.isArray(value) || value.length > MAX_SAMPLE_IDENTIFIERS) problems.push(`sampleIdentifiers.${table}は最大${MAX_SAMPLE_IDENTIFIERS}件`);
        else if (value.some((v) => typeof v !== "string" || !isValidIdentityForTable(contract.table, v))) problems.push(`sampleIdentifiers.${table}にidentity形式ではない値がある`);
      }
    }
  }
  if (Array.isArray(e.policyReasons) && e.policyReasons.some((r) => typeof r !== "string")) problems.push("policyReasonsが文字列配列ではない");
  walkEvidence(e, "evidence", problems);
  return problems;
}
