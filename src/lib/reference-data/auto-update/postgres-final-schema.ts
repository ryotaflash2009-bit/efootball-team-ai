/**
 * Phase 3(promotion検証): PostgreSQL隔離検証専用の「確定参照テーブル相当」schema設計。
 *
 * **重要**: このファイルはDDL文字列を保持するだけであり、いかなる実行コードも含まない。
 * 実Supabase/実Production reference_dataへは一切適用しない。想定される唯一の実行先は、
 * GitHub ActionsのGitHub-hosted Ubuntuランナー上で、当該ジョブの間だけ存在し
 * ジョブ終了後に破棄されるPostgreSQL service container(公式`postgres`イメージ)である。
 *
 * `docs/production-readiness/sql/create-reference-data-schema.sql`
 * (実`reference_data`スキーマの正式設計)の列構造・型を忠実に再現しているが、次の点を
 * 意図的に単純化している(promotion処理の正しさの検証には不要なため):
 *   - RLS(Row Level Security)・SELECTポリシー・GRANT/REVOKEは設定しない
 *     (このschemaにanon/authenticatedロールという概念は関係しない、内部検証専用)。
 *   - `updated_at`自動更新トリガーは作成しない(promotion処理側が明示的に値を設定する)。
 *   - `import_batches`への外部キー(import_batch_id)は持たない(promotionのjob/approval/
 *     checksum管理は`reference_data_ops_test`側で行うため、二重の管理にしない)。
 *   - 検索用GINインデックス(全文検索)は省略する(promotionの正しさとは無関係)。
 *
 * `public`スキーマへは一切作成しない。`auth`スキーマ・拡張機能・ロール変更・GRANT・RLS・
 * SECURITY DEFINER・Event Trigger・Cronはこのファイルに一切含まない。
 */

export const POSTGRES_FINAL_TEST_SCHEMA = "reference_data_test";

export const POSTGRES_FINAL_SCHEMA_DDL = `
create schema if not exists ${POSTGRES_FINAL_TEST_SCHEMA};

create table if not exists ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards (
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

create table if not exists ${POSTGRES_FINAL_TEST_SCHEMA}.managers (
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

create table if not exists ${POSTGRES_FINAL_TEST_SCHEMA}.player_card_analysis (
  world_card_id text primary key references ${POSTGRES_FINAL_TEST_SCHEMA}.world_player_cards (world_card_id) on delete cascade,
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

-- テーブルごとの「現在確定している元データ由来」メタ情報(promotion成功時に更新する)。
-- reference_data_ops_test.source_metadata_test(job単位の履歴)とは別物で、こちらは
-- 確定テーブル側の「最新1件」の状態を保持する。
create table if not exists ${POSTGRES_FINAL_TEST_SCHEMA}.source_metadata (
  table_name text primary key,
  last_job_id text not null,
  last_applied_at timestamptz not null,
  source text not null,
  schema_version text not null
);
`;

/** promotionが読み書きしてよい確定テーブルの許可リスト(このモジュール内で完結、外部入力からは生成しない)。 */
export const POSTGRES_FINAL_TABLES = ["world_player_cards", "managers", "player_card_analysis"] as const;
