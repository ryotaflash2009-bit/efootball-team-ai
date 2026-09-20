/**
 * Phase 2: PostgreSQL隔離検証専用のstagingスキーマ設計(DDL文字列のみ)。
 *
 * **重要**: このファイルはDDL文字列を保持するだけであり、いかなる実行コードも含まない。
 * 実Supabase/実Productionへは一切適用しない。想定される唯一の実行先は、
 * GitHub ActionsのGitHub-hosted Ubuntuランナー上で、当該ジョブの間だけ存在し
 * ジョブ終了後に破棄されるPostgreSQL service container(公式`postgres`イメージ)である。
 *
 * schema名(`reference_data_ops_test`)・テーブル名にすべて`_test`を含めず統一しているのは
 * 命名規約上の判断だが、コメントで繰り返しテスト専用であることを明記し、Production用
 * DDLと誤って混同されないようにしている。`public`スキーマへは一切作成しない。
 * `auth`スキーマ・拡張機能・ロール変更・GRANT・RLS・SECURITY DEFINER・Event Trigger・
 * Cronはこのファイルに一切含まない。
 */

export const POSTGRES_TEST_SCHEMA = "reference_data_ops_test";

export const POSTGRES_STAGING_SCHEMA_DDL = `
create schema if not exists ${POSTGRES_TEST_SCHEMA};

create table if not exists ${POSTGRES_TEST_SCHEMA}.update_jobs (
  job_id text primary key,
  table_name text not null,
  source text not null,
  schema_version text not null,
  dataset_checksum text not null,
  previous_checksum text,
  -- 実装済みの job.ts の状態機械(pending→running→completed/failed→(completedのみ)rolled_back)と
  -- 一致させる。タスク側で例示された validated/approved/applying/applied という中間状態は、
  -- 現時点のapply-orchestrator.ts/job.tsには存在しないため採用していない(将来の拡張時に
  -- migrationとして追加する想定)。
  status text not null check (status in ('pending','running','completed','failed','rolled_back')),
  started_at timestamptz,
  completed_at timestamptz,
  expected_tables jsonb not null,
  fetched_tables jsonb not null,
  added_count integer,
  updated_count integer,
  removed_candidate_count integer,
  unchanged_count integer
);

create table if not exists ${POSTGRES_TEST_SCHEMA}.applied_checksums (
  dataset_checksum text primary key,
  job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  applied_at timestamptz not null
);
create index if not exists idx_applied_checksums_job_id
  on ${POSTGRES_TEST_SCHEMA}.applied_checksums(job_id);

create table if not exists ${POSTGRES_TEST_SCHEMA}.audit_events (
  id bigserial primary key,
  job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  phase text not null,
  logged_at timestamptz not null,
  detail_json jsonb not null
);
create index if not exists idx_audit_events_job_id
  on ${POSTGRES_TEST_SCHEMA}.audit_events(job_id);

create table if not exists ${POSTGRES_TEST_SCHEMA}.staging_records (
  job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  record_id text not null,
  fields_json jsonb not null,
  primary key (job_id, record_id)
);

create table if not exists ${POSTGRES_TEST_SCHEMA}.before_snapshots (
  job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  record_id text not null,
  fields_json jsonb not null,
  primary key (job_id, record_id)
);

create table if not exists ${POSTGRES_TEST_SCHEMA}.rollback_jobs (
  rollback_job_id text primary key,
  target_job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  status text not null check (status in ('pending','applied','failed')),
  requested_at timestamptz not null,
  completed_at timestamptz,
  restored_count integer,
  removed_count integer
);
create index if not exists idx_rollback_jobs_target
  on ${POSTGRES_TEST_SCHEMA}.rollback_jobs(target_job_id);
-- 二重rollback防止: 同一target_job_idに対して、failed以外のrollbackは1件までしか許可しない
-- (Production設計のrollback_jobs_target_job_id_keyと同じ方針)。
create unique index if not exists idx_rollback_jobs_target_unique_active
  on ${POSTGRES_TEST_SCHEMA}.rollback_jobs(target_job_id)
  where status <> 'failed';

-- job単位のsource metadata履歴(promotion検証用、複数回の昇格ジョブを蓄積する)。
create table if not exists ${POSTGRES_TEST_SCHEMA}.source_metadata_test (
  table_name text not null,
  last_job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  last_applied_at timestamptz not null,
  source text not null,
  schema_version text not null,
  primary key (table_name, last_job_id)
);

-- promotion専用: 確定テーブル側source_metadataの「昇格前の状態」保存(明示rollbackでの復元用)。
create table if not exists ${POSTGRES_TEST_SCHEMA}.promotion_source_metadata_before (
  job_id text primary key references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  table_name text not null,
  before_json jsonb
);

create table if not exists ${POSTGRES_TEST_SCHEMA}.target_records (
  record_id text primary key,
  fields_json jsonb not null
);

-- ----------------------------------------------------------------------------
-- Phase 3(promotion検証)専用: 確定相当テーブル名と一致する3本のstagingテーブル。
-- 実Production設計(create-reference-data-ops-schema.sql)のstaging_*と同じ命名・
-- 構造(job_id + 対象idカラム + fields_json)にしている。Phase 2の汎用target_records/
-- staging_recordsとは独立しており、promotion検証だけがこれらを使う。
-- ----------------------------------------------------------------------------
create table if not exists ${POSTGRES_TEST_SCHEMA}.staging_world_player_cards (
  job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  world_card_id text not null,
  fields_json jsonb not null,
  primary key (job_id, world_card_id)
);

create table if not exists ${POSTGRES_TEST_SCHEMA}.staging_managers (
  job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  internal_manager_id text not null,
  fields_json jsonb not null,
  primary key (job_id, internal_manager_id)
);

create table if not exists ${POSTGRES_TEST_SCHEMA}.staging_player_card_analysis (
  job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  world_card_id text not null,
  fields_json jsonb not null,
  primary key (job_id, world_card_id)
);

-- promotion専用のbefore snapshot(insert/update区別・beforeChecksum・source metadataを保持)。
-- Phase 2の汎用before_snapshotsとは別テーブルにして、既存のPhase 2検証へ影響しない。
create table if not exists ${POSTGRES_TEST_SCHEMA}.promotion_before_snapshots (
  job_id text not null references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  table_name text not null,
  record_id text not null,
  operation text not null check (operation in ('insert', 'update')),
  before_fields_json jsonb,
  before_checksum text,
  source_meta_json jsonb not null,
  created_at timestamptz not null,
  primary key (job_id, table_name, record_id)
);
`;
