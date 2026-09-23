-- ============================================================================
-- READ ONLY
-- METADATA ONLY
-- SAFE TO RUN MANUALLY IN SUPABASE SQL EDITOR BEFORE APPLYING THE POLICIES
-- DOES NOT READ USER ROW DATA
-- DOES NOT READ REFERENCE_DATA ROW DATA
-- ============================================================================
--
-- create-reference-data-backup-reader-rls-policies.sqlを適用する前に、本人が
-- Production(Supabase SQL Editor)で現状を確認するための、metadataだけを読むSQL。
--
-- pg_catalog(pg_roles・pg_class・pg_policies)・to_regrole/to_regnamespace/to_regclass・
-- has_*_privilegeだけを使い、いかなるテーブルの行データもFROM参照しない。
-- 存在しないrole/schema/tableは例外にせず、`*_exists`フィールドでfalseとして返す
-- (OIDがNULLの場合、has_*_privilegeはNULLを返し、coalesceでfalseとして記録する)。
--
-- 適用してよい目安(本人が目視確認する):
--   role_exists=true、superuser/createdb/createrole/replication/bypassrls=すべてfalse
--   対象4テーブルすべてtable_exists=true・rls_enabled=true・rls_forced=true・
--   owner_is_backup_role=false・backup_role_can_select=true・write権限すべてfalse
--   reference_data_policiesが想定の3件(anon/authenticated向けSELECT・USING true)だけ
--   new_policy_name_conflicts=[]、policies_targeting_backup_role=[]
--   import_batchesにpolicy無し・anon/authenticatedのSELECTがfalse
--   user_data_table_privilegesのcan_selectがすべてfalse
--
-- このSQLはこのセッションでは実行していない。
-- ============================================================================

with backup_role as (
  select r.rolname, r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls
  from pg_catalog.pg_roles r
  where r.oid = to_regrole('reference_data_backup_reader')
),
target_tables(table_name) as (
  values ('world_player_cards'), ('managers'), ('player_card_analysis'), ('import_batches')
),
table_state as (
  select
    t.table_name,
    to_regclass('reference_data.' || t.table_name) is not null as table_exists,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    coalesce(c.relforcerowsecurity, false) as rls_forced,
    pg_catalog.pg_get_userbyid(c.relowner) as table_owner,
    coalesce(c.relowner = to_regrole('reference_data_backup_reader'), false) as owner_is_backup_role,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'select'), false) as backup_role_can_select,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'insert'), false) as backup_role_can_insert,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'update'), false) as backup_role_can_update,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'delete'), false) as backup_role_can_delete,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'truncate'), false) as backup_role_can_truncate,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'references'), false) as backup_role_can_references,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'trigger'), false) as backup_role_can_trigger,
    coalesce(has_table_privilege(to_regrole('anon'), to_regclass('reference_data.' || t.table_name), 'select'), false) as anon_can_select,
    coalesce(has_table_privilege(to_regrole('authenticated'), to_regclass('reference_data.' || t.table_name), 'select'), false) as authenticated_can_select
  from target_tables t
  left join pg_catalog.pg_class c on c.oid = to_regclass('reference_data.' || t.table_name)
),
reference_data_policies as (
  select p.tablename, p.policyname, p.permissive, p.cmd, p.roles::text[] as roles, p.qual, p.with_check
  from pg_catalog.pg_policies p
  where p.schemaname = 'reference_data'
),
new_policy_name_conflicts as (
  select p.schemaname, p.tablename, p.policyname
  from pg_catalog.pg_policies p
  where p.policyname in (
    'world_player_cards_backup_reader_select',
    'managers_backup_reader_select',
    'player_card_analysis_backup_reader_select',
    'import_batches_backup_reader_select'
  )
),
policies_targeting_backup_role as (
  select p.tablename, p.policyname
  from pg_catalog.pg_policies p
  where p.schemaname = 'reference_data'
    and p.roles @> array['reference_data_backup_reader']::name[]
),
similar_policies as (
  select p.tablename, p.policyname
  from pg_catalog.pg_policies p
  where p.schemaname = 'reference_data'
    and p.policyname like '%backup%'
),
user_data_tables(schema_name, table_name) as (
  values ('public', 'my_team_snapshots'), ('auth', 'users')
),
user_data_table_privileges as (
  select
    u.schema_name,
    u.table_name,
    to_regclass(u.schema_name || '.' || u.table_name) is not null as table_exists,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass(u.schema_name || '.' || u.table_name), 'select'), false) as can_select
  from user_data_tables u
)
select jsonb_build_object(
  'current_database', current_database(),
  'current_user', current_user,
  'session_user', session_user,
  'role_exists', exists (select 1 from backup_role),
  'login', (select rolcanlogin from backup_role),
  'superuser', (select rolsuper from backup_role),
  'createdb', (select rolcreatedb from backup_role),
  'createrole', (select rolcreaterole from backup_role),
  'replication', (select rolreplication from backup_role),
  'bypassrls', (select rolbypassrls from backup_role),
  'reference_data_exists', to_regnamespace('reference_data') is not null,
  'backup_role_reference_data_usage', coalesce(has_schema_privilege(to_regrole('reference_data_backup_reader'), to_regnamespace('reference_data'), 'usage'), false),
  'tables', coalesce((select jsonb_agg(to_jsonb(table_state) order by table_state.table_name) from table_state), '[]'::jsonb),
  'reference_data_policies', coalesce((select jsonb_agg(to_jsonb(reference_data_policies) order by reference_data_policies.tablename, reference_data_policies.policyname) from reference_data_policies), '[]'::jsonb),
  'import_batches_policy_count', (select count(*) from reference_data_policies where tablename = 'import_batches'),
  'new_policy_name_conflicts', coalesce((select jsonb_agg(to_jsonb(new_policy_name_conflicts)) from new_policy_name_conflicts), '[]'::jsonb),
  'policies_targeting_backup_role', coalesce((select jsonb_agg(to_jsonb(policies_targeting_backup_role)) from policies_targeting_backup_role), '[]'::jsonb),
  'similar_policies', coalesce((select jsonb_agg(to_jsonb(similar_policies)) from similar_policies), '[]'::jsonb),
  'user_data_table_privileges', coalesce((select jsonb_agg(to_jsonb(user_data_table_privileges)) from user_data_table_privileges), '[]'::jsonb)
) as backup_reader_rls_pre_apply_result;
