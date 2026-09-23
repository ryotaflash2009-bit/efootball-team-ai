-- ============================================================================
-- READ ONLY
-- METADATA ONLY
-- SAFE TO RUN MANUALLY IN SUPABASE SQL EDITOR AFTER APPLYING (OR ROLLING BACK) THE POLICIES
-- DOES NOT READ USER ROW DATA
-- DOES NOT READ REFERENCE_DATA ROW DATA
-- ============================================================================
--
-- create-reference-data-backup-reader-rls-policies.sqlの適用後(または
-- rollback-reference-data-backup-reader-rls-policies.sqlの実行後)に、本人が
-- metadataだけで結果を確認するためのSQL。行データは一切読まない。
--
-- 適用後の合格条件: `all_checks_pass=true`(各項目の真偽値も併せて出力する)。
-- rollback後の期待値: `new_policy_count=0`・`policies_targeting_backup_role_count=0`・
-- `existing_policies_unchanged=true`・その他のrole/権限/RLS項目はtrueのまま
-- (`new_policies_exact`はfalse、`all_checks_pass`はfalseになるのが正常)。
--
-- このSQLはこのセッションでは実行していない。
-- ============================================================================

with backup_role as (
  select r.rolsuper, r.rolbypassrls
  from pg_catalog.pg_roles r
  where r.oid = to_regrole('reference_data_backup_reader')
),
target_tables(table_name) as (
  values ('world_player_cards'), ('managers'), ('player_card_analysis'), ('import_batches')
),
table_state as (
  select
    t.table_name,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    coalesce(c.relforcerowsecurity, false) as rls_forced,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'select'), false) as can_select,
    coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'insert'), false)
      or coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'update'), false)
      or coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'delete'), false)
      or coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'truncate'), false)
      or coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'references'), false)
      or coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('reference_data.' || t.table_name), 'trigger'), false) as has_write_privilege
  from target_tables t
  left join pg_catalog.pg_class c on c.oid = to_regclass('reference_data.' || t.table_name)
),
new_policies as (
  select p.tablename, p.policyname
  from pg_catalog.pg_policies p
  where p.policyname in (
    'world_player_cards_backup_reader_select',
    'managers_backup_reader_select',
    'player_card_analysis_backup_reader_select',
    'import_batches_backup_reader_select'
  )
),
new_policies_exact as (
  select p.tablename
  from pg_catalog.pg_policies p
  where p.schemaname = 'reference_data'
    and (p.tablename, p.policyname) in (
      ('world_player_cards', 'world_player_cards_backup_reader_select'),
      ('managers', 'managers_backup_reader_select'),
      ('player_card_analysis', 'player_card_analysis_backup_reader_select'),
      ('import_batches', 'import_batches_backup_reader_select')
    )
    and p.permissive = 'PERMISSIVE'
    and p.cmd = 'SELECT'
    and p.roles = array['reference_data_backup_reader']::name[]
    and p.qual = 'true'
    and p.with_check is null
),
policies_targeting_backup_role as (
  select p.policyname
  from pg_catalog.pg_policies p
  where p.roles @> array['reference_data_backup_reader']::name[]
),
existing_policies_exact as (
  select p.policyname
  from pg_catalog.pg_policies p
  where p.schemaname = 'reference_data'
    and (p.tablename, p.policyname) in (
      ('world_player_cards', 'world_player_cards_select_all'),
      ('managers', 'managers_select_all'),
      ('player_card_analysis', 'player_card_analysis_select_all')
    )
    and p.permissive = 'PERMISSIVE'
    and p.cmd = 'SELECT'
    and p.roles @> array['anon', 'authenticated']::name[]
    and p.roles <@ array['anon', 'authenticated']::name[]
    and p.qual = 'true'
    and p.with_check is null
),
import_batches_public_policies as (
  select p.policyname
  from pg_catalog.pg_policies p
  where p.schemaname = 'reference_data'
    and p.tablename = 'import_batches'
    and (p.roles && array['anon', 'authenticated', 'public']::name[])
),
checks as (
  select
    (select count(*) from new_policies) as new_policy_count,
    (select count(*) from new_policies_exact) = 4 and (select count(*) from new_policies) = 4 as new_policies_exact,
    (select count(*) from policies_targeting_backup_role) as policies_targeting_backup_role_count,
    (select count(*) from existing_policies_exact) = 3 as existing_policies_unchanged,
    (select count(*) from import_batches_public_policies) = 0
      and not coalesce(has_table_privilege(to_regrole('anon'), to_regclass('reference_data.import_batches'), 'select'), false)
      and not coalesce(has_table_privilege(to_regrole('authenticated'), to_regclass('reference_data.import_batches'), 'select'), false) as import_batches_private,
    coalesce((select not rolsuper and not rolbypassrls from backup_role), false) as backup_role_not_privileged,
    (select bool_and(can_select) and not bool_or(has_write_privilege) from table_state) as backup_role_select_only,
    (select bool_and(rls_enabled and rls_forced) from table_state) as rls_enabled_and_forced,
    not coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('auth.users'), 'select'), false)
      and not coalesce(has_table_privilege(to_regrole('reference_data_backup_reader'), to_regclass('public.my_team_snapshots'), 'select'), false) as no_user_data_access
)
select jsonb_build_object(
  'new_policy_count', c.new_policy_count,
  'new_policies_exact', c.new_policies_exact,
  'policies_targeting_backup_role_count', c.policies_targeting_backup_role_count,
  'existing_policies_unchanged', c.existing_policies_unchanged,
  'import_batches_private', c.import_batches_private,
  'backup_role_not_privileged', c.backup_role_not_privileged,
  'backup_role_select_only', c.backup_role_select_only,
  'rls_enabled_and_forced', c.rls_enabled_and_forced,
  'no_user_data_access', c.no_user_data_access,
  'all_checks_pass',
    c.new_policies_exact
    and c.policies_targeting_backup_role_count = 4
    and c.existing_policies_unchanged
    and c.import_batches_private
    and c.backup_role_not_privileged
    and c.backup_role_select_only
    and c.rls_enabled_and_forced
    and c.no_user_data_access,
  'tables', (select jsonb_agg(to_jsonb(table_state) order by table_state.table_name) from table_state)
) as backup_reader_rls_post_apply_result
from checks c;
