-- ============================================================================
-- READ ONLY — NO DDL — NO DML — NO GRANT OR REVOKE — DOES NOT READ USER ROW DATA
-- SAFE TO RUN MANUALLY IN SUPABASE SQL EDITOR
-- ============================================================================
--
-- 目的: Production Supabase上の実DB構造が、このリポジトリの設計(reference_data
-- スキーマの実装済みDDL、reference_data_opsスキーマの未適用DDL案)と一致しているかを、
-- 書き込みを一切行わずに確認する。
--
-- このSQL全体は SELECT / WITH だけで構成されており、CREATE/ALTER/DROP/TRUNCATE/
-- INSERT/UPDATE/DELETE/MERGE/GRANT/REVOKE/COPY/CALL/DO/EXECUTE/SET ROLEは
-- 一切含まない(`production-ops-sql-audit.ts`の静的監査で機械的に確認済み)。
--
-- user data(auth.users・my_team_snapshots・rls_probe_records)の行・列内容は
-- 一切読み取らない。public/authスキーマは「存在するかどうか」だけを確認し、
-- テーブル一覧・カラム・RLS詳細等は一切参照しない。
--
-- reference_data_ops(staging/job/approval管理schema)は、2026-09-20時点で
-- Productionへまだ適用していない設計案である。このSQLは、reference_data_opsが
-- 存在しない状態でも失敗しないよう、実テーブルへの直接SELECTではなく
-- information_schema/pg_catalogの参照(対象が存在しなければ単に0行を返すだけで、
-- エラーにはならない)だけでreference_data_opsの状態を確認する。
--
-- reference_data(確定済み参照データ、既に実装・投入済みの前提)の4テーブル
-- (world_player_cards, managers, player_card_analysis, import_batches)については、
-- 件数取得のため直接COUNT(*)を実行する。**この部分が「relation does not exist」で
-- 失敗した場合は、想定外の重大な構造差異としてこのSQL全体の実行を中断し、
-- 実行結果をそのまま報告すること(推測で読み替えない)。**
--
-- Supabaseの「Exposed schemas」(PostgRESTのAPI公開設定)は、DBカタログ内には
-- 保存されないSupabase Dashboard側の設定であり、このSQLでは確認できない
-- (別途Dashboardの Project Settings → API 画面での目視確認が必要)。
-- ============================================================================

with
target_schema_names(schema_name) as (
  values ('reference_data'), ('reference_data_ops'), ('public'), ('auth')
),
existing_target_schemas as (
  select s.schema_name
  from information_schema.schemata s
  join target_schema_names t using (schema_name)
),
database_info as (
  select jsonb_build_object(
    'current_database', current_database(),
    'current_user', current_user,
    'session_user', session_user,
    'version', version(),
    'ssl', coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false),
    'transaction_isolation', current_setting('transaction_isolation'),
    'statement_timeout', current_setting('statement_timeout'),
    'lock_timeout', current_setting('lock_timeout')
  ) as info
),
schema_info as (
  select jsonb_build_object(
    'reference_data_exists', exists(select 1 from existing_target_schemas where schema_name = 'reference_data'),
    'reference_data_ops_exists', exists(select 1 from existing_target_schemas where schema_name = 'reference_data_ops'),
    'public_exists', exists(select 1 from existing_target_schemas where schema_name = 'public'),
    'auth_exists', exists(select 1 from existing_target_schemas where schema_name = 'auth'),
    'note', 'public/authはスキーマ存在確認のみ(テーブル一覧・RLS・権限は対象外)'
  ) as info
),
target_ref_tables(table_name) as (
  values ('world_player_cards'), ('managers'), ('player_card_analysis'), ('import_batches')
),
table_owner_rows as (
  select schemaname, tablename, tableowner
  from pg_tables
  where (schemaname = 'reference_data' and tablename in (select table_name from target_ref_tables))
     or schemaname = 'reference_data_ops'
),
table_info as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', schemaname, 'table', tablename, 'owner', tableowner
  ) order by schemaname, tablename), '[]'::jsonb) as info
  from table_owner_rows
),
column_rows as (
  select table_schema, table_name, column_name, ordinal_position, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'reference_data' and table_name in (select table_name from target_ref_tables)
),
column_info as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', table_schema, 'table', table_name, 'column', column_name,
    'data_type', data_type, 'is_nullable', is_nullable, 'default', column_default
  ) order by table_schema, table_name, ordinal_position), '[]'::jsonb) as info
  from column_rows
),
constraint_rows as (
  select tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type
  from information_schema.table_constraints tc
  where tc.table_schema = 'reference_data' and tc.table_name in (select table_name from target_ref_tables)
),
constraint_info as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', table_schema, 'table', table_name, 'constraint_name', constraint_name, 'constraint_type', constraint_type
  ) order by table_schema, table_name, constraint_type, constraint_name), '[]'::jsonb) as info
  from constraint_rows
),
index_rows as (
  select schemaname, tablename, indexname
  from pg_indexes
  where schemaname = 'reference_data' and tablename in (select table_name from target_ref_tables)
),
index_info as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', schemaname, 'table', tablename, 'index_name', indexname
  ) order by schemaname, tablename, indexname), '[]'::jsonb) as info
  from index_rows
),
rls_rows as (
  select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('reference_data', 'reference_data_ops') and c.relkind = 'r'
),
rls_info as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', nspname, 'table', relname, 'rls_enabled', relrowsecurity, 'rls_forced', relforcerowsecurity
  ) order by nspname, relname), '[]'::jsonb) as info
  from rls_rows
),
policy_rows as (
  select schemaname, tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
  where schemaname in ('reference_data', 'reference_data_ops')
),
policy_info as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', schemaname, 'table', tablename, 'policy_name', policyname,
    'command', cmd, 'roles', roles, 'using', qual, 'with_check', with_check
  ) order by schemaname, tablename, policyname), '[]'::jsonb) as info
  from policy_rows
),
table_privilege_rows as (
  select table_schema, table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema in ('reference_data', 'reference_data_ops')
),
schema_usage_rows as (
  select object_schema, grantee, privilege_type
  from information_schema.usage_privileges
  where object_schema in ('reference_data', 'reference_data_ops')
),
privilege_info as (
  select jsonb_build_object(
    'table_grants', coalesce((select jsonb_agg(jsonb_build_object(
      'schema', table_schema, 'table', table_name, 'grantee', grantee, 'privilege', privilege_type
    ) order by table_schema, table_name, grantee, privilege_type) from table_privilege_rows), '[]'::jsonb),
    'schema_usage_grants', coalesce((select jsonb_agg(jsonb_build_object(
      'schema', object_schema, 'grantee', grantee, 'privilege', privilege_type
    ) order by object_schema, grantee, privilege_type) from schema_usage_rows), '[]'::jsonb)
  ) as info
),
row_counts as (
  -- reference_dataは実装・投入済みの前提のため直接COUNT(*)する。この部分が
  -- 「relation does not exist」で失敗した場合は、想定外の重大差異として報告すること。
  select jsonb_build_object(
    'world_player_cards', (select count(*) from reference_data.world_player_cards),
    'managers', (select count(*) from reference_data.managers),
    'player_card_analysis', (select count(*) from reference_data.player_card_analysis),
    'import_batches', (select count(*) from reference_data.import_batches)
  ) as info
),
ops_schema_status as (
  select jsonb_build_object(
    'schema_exists', exists(select 1 from existing_target_schemas where schema_name = 'reference_data_ops'),
    'tables_found', coalesce((select jsonb_agg(table_name order by table_name) from information_schema.tables where table_schema = 'reference_data_ops'), '[]'::jsonb),
    'note', 'reference_data_ops未適用の場合、schema_exists=falseかつtables_found=[]が正しい状態。running jobs/applied checksumsは、存在しないtableへ直接SELECTするとエラーになるため、schema自体が存在することを確認できるまでは意図的に問い合わせていない。'
  ) as info
)
select jsonb_build_object(
  'database_info', (select info from database_info),
  'schema_info', (select info from schema_info),
  'table_info', (select info from table_info),
  'column_info', (select info from column_info),
  'constraint_info', (select info from constraint_info),
  'index_info', (select info from index_info),
  'rls_info', (select info from rls_info),
  'policy_info', (select info from policy_info),
  'privilege_info', (select info from privilege_info),
  'row_counts', (select info from row_counts),
  'ops_schema_status', (select info from ops_schema_status),
  'final_preflight_summary', jsonb_build_object(
    'generated_at', now(),
    'exposed_schemas_note', 'PostgRESTのExposed schemas設定はDBカタログ外(Supabase Dashboard側)のため、この結果には含まれない。Project Settings → APIで別途確認すること。',
    'decision_note', 'このクエリ自体はready/blockedの判定を行わない。結果は本人が設計文書と目視で照合すること。'
  )
) as preflight_result;
