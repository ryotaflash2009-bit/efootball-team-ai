/**
 * Backup/Restore検証専用の列構造定義と、隔離PostgreSQL専用の2schema(source用・
 * restore先用)のDDL。実Supabase/実Production `reference_data`へは一切適用しない。
 *
 * 列構造は`postgres-final-schema.ts`(Promotion検証用)・
 * `docs/production-readiness/sql/create-reference-data-schema.sql`(実schemaの正式設計)と
 * 一致させている。RLS・ポリシー・GRANT/REVOKEは設定しない(このBackup検証はテーブル単位の
 * データ復元可否だけを検証する。RLS/policy自体の検証はPreflight/PoCの別文書が担当する)。
 *
 * schema contract(構造そのもの)はこのリポジトリ内DDLで管理し、Backupファイル自体には
 * スキーマDDLを含めない(データ行だけを対象とする)。
 */

export interface BackupTableSpec {
  table: string;
  primaryKey: string;
  columns: readonly string[];
  /** jsonb型の列(書込み時にJSON.stringifyが必要な列)。それ以外の配列列(text[])はネイティブ配列のまま渡す。 */
  jsonbColumns: readonly string[];
}

export const BACKUP_TABLE_SPECS: readonly BackupTableSpec[] = [
  {
    table: "world_player_cards",
    primaryKey: "world_card_id",
    columns: [
      "world_card_id", "name_en", "name_ja", "card_type", "registered_position", "nationality", "region",
      "league", "team", "ovr_base", "ovr_max", "maximum_level", "card_rating", "playing_style",
      "playing_style_def", "preferred_foot", "age", "height", "weight", "image_url", "mobile_image_url",
      "boost1", "boost2", "stats", "skills", "ai_styles", "appearance", "efhub_card_id", "efhub_conflicts",
      "name_sort_key", "source", "source_url", "fetched_at", "dataset_version", "created_at", "updated_at",
    ],
    jsonbColumns: ["stats", "appearance", "efhub_conflicts"],
  },
  {
    table: "managers",
    primaryKey: "internal_manager_id",
    columns: [
      "internal_manager_id", "source", "source_manager_id", "name_en", "name_ja", "team_name", "nationality",
      "age", "released_at", "possession_game", "quick_counter", "long_ball_counter", "out_wide", "long_ball",
      "overload", "manager_rating", "coaching_affinity", "formation", "has_booster", "has_link_up_play",
      "booster_confirmation", "boosters", "link_up_plays", "name_sort_key", "source_url", "fetched_at",
      "dataset_version", "created_at", "updated_at",
    ],
    jsonbColumns: ["boosters", "link_up_plays"],
  },
  {
    table: "player_card_analysis",
    primaryKey: "world_card_id",
    columns: [
      "world_card_id", "weak_foot_usage", "weak_foot_accuracy", "form", "condition_value", "injury_resistance",
      "player_model", "positions", "com_skills", "player_skills", "efhub_name_en", "source", "source_url",
      "fetched_at", "dataset_version", "created_at", "updated_at",
    ],
    jsonbColumns: ["player_model", "positions"],
  },
  {
    table: "import_batches",
    primaryKey: "batch_id",
    columns: [
      "batch_id", "dataset_version", "target_table", "source", "source_row_count", "inserted_row_count",
      "payload_hash", "status", "approved_by", "notes", "created_at", "verified_at", "rolled_back_at",
    ],
    jsonbColumns: [],
  },
];

export function getBackupTableSpec(table: string): BackupTableSpec {
  const found = BACKUP_TABLE_SPECS.find((s) => s.table === table);
  if (!found) throw new Error(`Backup対象として定義されていないテーブル: ${table}`);
  return found;
}

/** このモジュール内だけで完結する、隔離PostgreSQL検証専用schema名の固定union(外部入力からは拡張不可)。 */
export const BACKUP_SOURCE_TEST_SCHEMA = "reference_data_backup_source_test" as const;
export const BACKUP_RESTORE_TEST_SCHEMA = "reference_data_backup_restore_test" as const;
export type BackupIsolatedSchemaName = typeof BACKUP_SOURCE_TEST_SCHEMA | typeof BACKUP_RESTORE_TEST_SCHEMA;

/** 実Production `reference_data` schema名。`CreateBackupInput.sourceSchema`へ実行時に渡す値であり、DDL生成対象ではない(実schemaはこのリポジトリ側で作成しない)。 */
export const PRODUCTION_REFERENCE_DATA_SCHEMA = "reference_data" as const;

/**
 * dump(読み出し専用SELECT)を許可するschema名の集合。隔離検証用2schemaに加え、
 * 実Production `reference_data`からの読み出しだけを許可する(書込み系のRestore/Truncateは
 * 引き続き`BackupIsolatedSchemaName`だけに限定されたまま、この型を一切使わない)。
 */
export type BackupDumpSourceSchemaName = BackupIsolatedSchemaName | typeof PRODUCTION_REFERENCE_DATA_SCHEMA;

function schemaDdlBody(schemaName: string): string {
  return `
create schema if not exists ${schemaName};

create table if not exists ${schemaName}.world_player_cards (
  world_card_id text primary key,
  name_en text not null,
  name_ja text,
  card_type text,
  registered_position text,
  nationality text,
  region text,
  league text,
  team text,
  ovr_base integer,
  ovr_max integer,
  maximum_level integer,
  card_rating text,
  playing_style text,
  playing_style_def text,
  preferred_foot text,
  age integer,
  height integer,
  weight integer,
  image_url text,
  mobile_image_url text,
  boost1 text,
  boost2 text,
  stats jsonb not null default '{}'::jsonb,
  skills text[] not null default '{}',
  ai_styles text[] not null default '{}',
  appearance jsonb,
  efhub_card_id text,
  efhub_conflicts jsonb not null default '[]'::jsonb,
  name_sort_key text collate "C",
  source text not null default 'efootball-world.com',
  source_url text,
  fetched_at timestamptz not null,
  dataset_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ${schemaName}.managers (
  internal_manager_id integer primary key,
  source text not null,
  source_manager_id text not null,
  name_en text not null,
  name_ja text,
  team_name text,
  nationality text,
  age integer,
  released_at text,
  possession_game integer,
  quick_counter integer,
  long_ball_counter integer,
  out_wide integer,
  long_ball integer,
  overload integer,
  manager_rating text,
  coaching_affinity text,
  formation text,
  has_booster boolean not null default false,
  has_link_up_play boolean not null default false,
  booster_confirmation text,
  boosters jsonb not null default '[]'::jsonb,
  link_up_plays jsonb not null default '[]'::jsonb,
  name_sort_key text collate "C",
  source_url text,
  fetched_at timestamptz not null,
  dataset_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ${schemaName}.player_card_analysis (
  world_card_id text primary key references ${schemaName}.world_player_cards (world_card_id) on delete cascade,
  weak_foot_usage integer,
  weak_foot_accuracy integer,
  form integer,
  condition_value integer,
  injury_resistance integer,
  player_model jsonb not null default '{}'::jsonb,
  positions jsonb not null default '[]'::jsonb,
  com_skills text[] not null default '{}',
  player_skills text[] not null default '{}',
  efhub_name_en text,
  source text not null default 'efhub',
  source_url text,
  fetched_at timestamptz not null,
  dataset_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ${schemaName}.import_batches (
  batch_id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  target_table text not null,
  source text not null,
  source_row_count integer not null default 0,
  inserted_row_count integer not null default 0,
  payload_hash text,
  status text not null default 'pending',
  approved_by text,
  notes text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  rolled_back_at timestamptz
);
`;
}

/**
 * source用・restore先用のいずれかのschema名を受け取り、同一構造の4テーブルDDLを生成する。
 * 引数は上記2つの固定リテラルだけを型で許可しており、任意のschema名を渡す設計にはしていない。
 */
export function buildBackupIsolatedSchemaDdl(schemaName: BackupIsolatedSchemaName): string {
  if (schemaName !== BACKUP_SOURCE_TEST_SCHEMA && schemaName !== BACKUP_RESTORE_TEST_SCHEMA) {
    throw new Error(`許可されていない隔離schema名: ${schemaName}`);
  }
  return schemaDdlBody(schemaName);
}

/**
 * 2026-09-21追記(Production実行準備): 隔離CI PostgreSQL(GitHub Actions service container、
 * Productionではない)上に、実Production `reference_data`と同一構造のschemaを再現するための
 * DDL。`run-production-backup.postgres.test.ts`だけが使用し、Productionへは一切適用しない
 * (Production側の実`reference_data`は本人が別途、正式なマイグレーションで管理する)。
 */
export function buildProductionLikeSchemaDdlForIsolatedTesting(): string {
  return schemaDdlBody(PRODUCTION_REFERENCE_DATA_SCHEMA);
}
