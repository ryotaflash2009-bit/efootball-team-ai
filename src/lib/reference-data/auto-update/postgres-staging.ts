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

create table if not exists ${POSTGRES_TEST_SCHEMA}.source_metadata_test (
  table_name text primary key,
  last_job_id text references ${POSTGRES_TEST_SCHEMA}.update_jobs(job_id),
  last_applied_at timestamptz,
  source text,
  schema_version text
);

create table if not exists ${POSTGRES_TEST_SCHEMA}.target_records (
  record_id text primary key,
  fields_json jsonb not null
);
`;
