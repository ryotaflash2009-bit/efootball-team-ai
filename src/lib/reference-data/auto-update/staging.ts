/**
 * Phase 2: staging領域のスキーマ設計(合成環境向けDDL文字列のみ)。
 *
 * **重要**: このファイルはDDL文字列を保持するだけであり、いかなる実行コードも含まない。
 * 実Supabase/実Productionへは一切適用しない。利用可能な実行経路は
 * `scripts/migration/reference-data-auto-update-apply.mjs`が開くローカルの一時SQLite
 * ファイルだけであり、そこでも本ファイルの定数を明示的に渡した場合のみ使われる。
 *
 * 対象スキーマは、利用者データ(auth.users・my_team_snapshots・rls_probe_records等)とは
 * 完全に分離した、参照データ更新ジョブ専用の管理領域を想定する
 * (`real-import-guards.ts`の`ALLOWED_TARGET_TABLES`許可リストと同じ多層防御の考え方を踏襲)。
 *
 * Production設計案(将来のPhase 2実装向け、今回は未実装・未適用):
 *   Supabase上に`reference_data_ops`のような専用スキーマを新設し、本DDLのPostgreSQL版を
 *   そこへ配置する。`public`・`auth`・利用者データスキーマとは物理的に分離する。
 */

/** ローカル合成SQLite環境専用のstagingスキーマ(SQLite方言)。Productionへは適用しない。 */
export const SQLITE_STAGING_SCHEMA_DDL = `
create table if not exists update_jobs (
  job_id text primary key,
  table_name text not null,
  source text not null,
  schema_version text not null,
  dataset_checksum text not null,
  previous_checksum text,
  status text not null,
  started_at text,
  completed_at text,
  expected_tables text not null,
  fetched_tables text not null,
  added_count integer,
  updated_count integer,
  removed_candidate_count integer,
  unchanged_count integer
);

create table if not exists applied_checksums (
  dataset_checksum text primary key,
  job_id text not null,
  applied_at text not null
);

create table if not exists audit_events (
  id integer primary key autoincrement,
  job_id text not null,
  phase text not null,
  logged_at text not null,
  detail_json text not null
);

create table if not exists advisory_locks (
  lock_key text primary key,
  locked_by text,
  locked_at text
);

create table if not exists target_records (
  record_id text primary key,
  fields_json text not null
);
`;

/** 対象テーブル(`target_records`)は、参照データレコードだけを保持する合成テーブルであり、
 * 利用者データ(user_id列・認証情報等)を一切含まない設計である。実際のPhase 2実装では
 * テーブルごとに専用スキーマを持つが、合成検証ではこの汎用1テーブルで代替する。 */
export const ADVISORY_LOCK_KEY_ROW = "reference_data_update";
