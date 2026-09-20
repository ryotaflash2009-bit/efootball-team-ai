-- ============================================================================
-- READ ONLY
-- METADATA ONLY
-- SAFE TO RUN MANUALLY IN SUPABASE SQL EDITOR AFTER ROLE CREATION
-- DOES NOT READ USER ROW DATA
-- DOES NOT READ REFERENCE_DATA ROW DATA
-- ============================================================================
--
-- Backup専用role(reference_data_backup_reader)が、設計どおりの最小権限で
-- 作成されていることを確認するための、metadataだけを参照するSQL。
--
-- 対象4テーブルを含め、いかなるテーブルの行データも一切取得しない
-- (`has_table_privilege`/`has_schema_privilege`/`pg_roles`/`pg_db_role_setting`と
-- いったカタログ関数・カタログビューだけを使用する。`SELECT ... FROM
-- reference_data.<table>`のような実データへのFROM参照は一切含まない)。
--
-- このSQLはこのセッションでは実行していない。role作成後に本人が手動で
-- Supabase SQL Editorから実行し、結果を確認すること。
-- ============================================================================

with target_role as (
  select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
         rolbypassrls, rolinherit, rolconnlimit, rolvaliduntil
  from pg_roles
  where rolname = 'reference_data_backup_reader'
),
role_settings as (
  select unnest(coalesce(drs.setconfig, array[]::text[])) as setting
  from pg_roles r
  left join pg_db_role_setting drs on drs.setrole = r.oid
  where r.rolname = 'reference_data_backup_reader'
),
schema_usage as (
  select
    has_schema_privilege('reference_data_backup_reader', 'reference_data', 'usage') as reference_data_usage,
    has_schema_privilege('reference_data_backup_reader', 'reference_data_ops', 'usage') as reference_data_ops_usage,
    has_schema_privilege('reference_data_backup_reader', 'public', 'usage') as public_usage,
    has_schema_privilege('reference_data_backup_reader', 'auth', 'usage') as auth_usage
),
target_tables(table_name) as (
  values ('world_player_cards'), ('managers'), ('player_card_analysis'), ('import_batches')
),
table_privileges as (
  select
    t.table_name,
    has_table_privilege('reference_data_backup_reader', 'reference_data.' || t.table_name, 'select') as can_select,
    has_table_privilege('reference_data_backup_reader', 'reference_data.' || t.table_name, 'insert') as can_insert,
    has_table_privilege('reference_data_backup_reader', 'reference_data.' || t.table_name, 'update') as can_update,
    has_table_privilege('reference_data_backup_reader', 'reference_data.' || t.table_name, 'delete') as can_delete,
    has_table_privilege('reference_data_backup_reader', 'reference_data.' || t.table_name, 'truncate') as can_truncate,
    has_table_privilege('reference_data_backup_reader', 'reference_data.' || t.table_name, 'references') as can_references,
    has_table_privilege('reference_data_backup_reader', 'reference_data.' || t.table_name, 'trigger') as can_trigger
  from target_tables t
),
ops_schema_table_check as (
  -- reference_data_opsが未適用の場合でも失敗しないよう、実テーブルへの直接
  -- has_table_privilegeではなく、information_schema.tablesの存在確認だけを行う。
  select count(*) as ops_table_count
  from information_schema.tables
  where table_schema = 'reference_data_ops'
)
select jsonb_build_object(
  'role_exists', exists(select 1 from target_role),
  'login', (select rolcanlogin from target_role),
  'superuser', (select rolsuper from target_role),
  'createdb', (select rolcreatedb from target_role),
  'createrole', (select rolcreaterole from target_role),
  'replication', (select rolreplication from target_role),
  'bypassrls', (select rolbypassrls from target_role),
  'inherit', (select rolinherit from target_role),
  'connection_limit', (select rolconnlimit from target_role),
  'valid_until', (select rolvaliduntil::text from target_role),
  'role_settings', coalesce((select jsonb_agg(setting) from role_settings), '[]'::jsonb),
  'schema_usage', (select to_jsonb(schema_usage) from schema_usage),
  'table_privileges', coalesce((select jsonb_agg(to_jsonb(table_privileges)) from table_privileges), '[]'::jsonb),
  'reference_data_ops_table_count_visible', (select ops_table_count from ops_schema_table_check)
) as role_verification_result;
