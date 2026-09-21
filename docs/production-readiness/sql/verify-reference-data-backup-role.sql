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
--
-- 2026-09-21追記(不具合修正): Production実行時に
-- `ERROR: 3F000: schema "reference_data_ops" does not exist`で停止する不具合を
-- 修正した。`has_schema_privilege(role, 'schema_name'::text, priv)`の
-- 「名前」引数版は、対象schemaが実際に存在しない場合、権限なし(false)を
-- 返すのではなく例外を送出する(`has_table_privilege`の名前引数版も同様に
-- 対象tableが存在しない場合は例外を送出する)。修正後は、`to_regnamespace`/
-- `to_regclass`で対象schema/tableのOIDを先に安全に解決し(存在しなければ
-- SQL NULLを返すだけで例外にならない)、そのOIDを`has_schema_privilege`/
-- `has_table_privilege`へ渡す(OIDが NULL の場合、これらの関数は例外ではなく
-- NULLを返す)。NULLは`coalesce(..., false)`で「アクセスなし」として明示的に
-- 記録するが、それとは別に`_exists`/`table_exists`列で「schemaやtableが
-- そもそも存在しない」という事実自体も区別して残す(存在しないことを
-- 無条件に「合格」で握りつぶさない)。
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
    to_regnamespace('reference_data') is not null as reference_data_exists,
    coalesce(has_schema_privilege('reference_data_backup_reader', to_regnamespace('reference_data'), 'usage'), false) as reference_data_usage,
    to_regnamespace('reference_data_ops') is not null as reference_data_ops_exists,
    coalesce(has_schema_privilege('reference_data_backup_reader', to_regnamespace('reference_data_ops'), 'usage'), false) as reference_data_ops_usage,
    to_regnamespace('public') is not null as public_exists,
    coalesce(has_schema_privilege('reference_data_backup_reader', to_regnamespace('public'), 'usage'), false) as public_usage,
    to_regnamespace('auth') is not null as auth_exists,
    coalesce(has_schema_privilege('reference_data_backup_reader', to_regnamespace('auth'), 'usage'), false) as auth_usage
),
target_tables(table_name) as (
  values ('world_player_cards'), ('managers'), ('player_card_analysis'), ('import_batches')
),
table_privileges as (
  select
    t.table_name,
    to_regclass('reference_data.' || t.table_name) is not null as table_exists,
    coalesce(has_table_privilege('reference_data_backup_reader', to_regclass('reference_data.' || t.table_name), 'select'), false) as can_select,
    coalesce(has_table_privilege('reference_data_backup_reader', to_regclass('reference_data.' || t.table_name), 'insert'), false) as can_insert,
    coalesce(has_table_privilege('reference_data_backup_reader', to_regclass('reference_data.' || t.table_name), 'update'), false) as can_update,
    coalesce(has_table_privilege('reference_data_backup_reader', to_regclass('reference_data.' || t.table_name), 'delete'), false) as can_delete,
    coalesce(has_table_privilege('reference_data_backup_reader', to_regclass('reference_data.' || t.table_name), 'truncate'), false) as can_truncate,
    coalesce(has_table_privilege('reference_data_backup_reader', to_regclass('reference_data.' || t.table_name), 'references'), false) as can_references,
    coalesce(has_table_privilege('reference_data_backup_reader', to_regclass('reference_data.' || t.table_name), 'trigger'), false) as can_trigger
  from target_tables t
),
-- 2026-09-21追記: 対象4テーブルとは別に、実際の利用者データテーブル
-- (public.my_team_snapshots・auth.users)へSELECTがそもそも付与されていない
-- ことも、同じ安全な存在確認パターンでmetadataだけから確認する。テーブルが
-- 存在しない環境(例: ローカル検証用の隔離DB)でも例外を出さない。
user_data_tables(schema_name, table_name) as (
  values ('public', 'my_team_snapshots'), ('auth', 'users')
),
user_data_table_privileges as (
  select
    u.schema_name,
    u.table_name,
    to_regclass(u.schema_name || '.' || u.table_name) is not null as table_exists,
    coalesce(has_table_privilege('reference_data_backup_reader', to_regclass(u.schema_name || '.' || u.table_name), 'select'), false) as can_select
  from user_data_tables u
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
  'user_data_table_privileges', coalesce((select jsonb_agg(to_jsonb(user_data_table_privileges)) from user_data_table_privileges), '[]'::jsonb),
  'reference_data_ops_table_count_visible', (select ops_table_count from ops_schema_table_check)
) as role_verification_result;
