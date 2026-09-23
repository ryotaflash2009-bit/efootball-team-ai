-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- ADDS SELECT-ONLY POLICIES FOR reference_data_backup_reader ONLY
-- DOES NOT GRANT, REVOKE, ALTER ROLE, OR CHANGE TABLE RLS SETTINGS
-- ============================================================================
--
-- Backup専用role(reference_data_backup_reader)が、RLS有効(FORCE)の
-- reference_data対象4テーブルの行を読めるようにするための、専用SELECT policy 4件。
--
-- 背景: workflow run #6は、このroleに適用されるSELECT policyが無かったため、
-- RLSの既定拒否によりエラー無しで0行を読み、空Backupになった
-- (reference-data-production-backup-role-runbook.md 10章)。
--
-- このSQLが行うのは`create policy`4件だけ:
--   - SELECT専用・PERMISSIVE・対象roleはreference_data_backup_readerだけ・USING (true)
--   - WITH CHECK無し、INSERT/UPDATE/DELETE/ALLのpolicyは追加しない
--   - anon/authenticated/PUBLIC/service_roleを対象にしない
--   - GRANT/REVOKE・role属性の変更・BYPASSRLSの付与・RLSの無効化・FORCE解除・
--     table ownerの変更は一切行わない
--   - 既存のanon/authenticated向けpolicy(3件)は変更しない
--   - import_batchesはanon/authenticatedへ公開しない(このroleだけが読める)
--
-- 事前確認(下のDOブロック)で想定外の状態を検出した場合は、例外で停止し、
-- transaction全体が取り消される(何も作成されない)。既存の同名policyを上書きしたり、
-- IF NOT EXISTS相当で想定外の状態を黙って通過させたりしない。
--
-- このSQLはこのセッションでは実行していない。実行する場合は、
-- verify-reference-data-backup-reader-rls-policies-pre-apply.sqlの結果を本人が確認し、
-- Production適用について別途明示承認を得てから、本人がSupabase SQL Editorで実行する。
-- 適用後はverify-reference-data-backup-reader-rls-policies-post-apply.sqlで確認する。
-- ============================================================================

begin;

-- 1. 事前確認(metadataだけを読む。想定外の状態なら例外で停止する)
do $$
declare
  v_role oid := to_regrole('reference_data_backup_reader');
  v_table text;
  v_rls boolean;
  v_force boolean;
  v_owner oid;
begin
  if v_role is null then
    raise exception 'blocked: role reference_data_backup_reader does not exist';
  end if;
  if exists (select 1 from pg_catalog.pg_roles r where r.oid = v_role and (r.rolsuper or r.rolbypassrls)) then
    raise exception 'blocked: reference_data_backup_reader must be NOSUPERUSER and NOBYPASSRLS';
  end if;
  if to_regnamespace('reference_data') is null then
    raise exception 'blocked: schema reference_data does not exist';
  end if;

  foreach v_table in array array['world_player_cards', 'managers', 'player_card_analysis', 'import_batches'] loop
    if to_regclass('reference_data.' || v_table) is null then
      raise exception 'blocked: table reference_data.% does not exist', v_table;
    end if;
    select c.relrowsecurity, c.relforcerowsecurity, c.relowner into v_rls, v_force, v_owner
      from pg_catalog.pg_class c
      where c.oid = to_regclass('reference_data.' || v_table);
    if not v_rls or not v_force then
      raise exception 'blocked: reference_data.% must have RLS enabled and forced (enabled=%, forced=%)', v_table, v_rls, v_force;
    end if;
    if v_owner = v_role then
      raise exception 'blocked: reference_data_backup_reader must not own reference_data.%', v_table;
    end if;
  end loop;

  if exists (
    select 1 from pg_catalog.pg_policies p
    where p.policyname in (
      'world_player_cards_backup_reader_select',
      'managers_backup_reader_select',
      'player_card_analysis_backup_reader_select',
      'import_batches_backup_reader_select'
    )
  ) then
    raise exception 'blocked: a policy with one of the new names already exists (not overwritten)';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'reference_data'
      and p.roles @> array['reference_data_backup_reader']::name[]
  ) then
    raise exception 'blocked: an unexpected policy already targets reference_data_backup_reader';
  end if;

  if (select count(*) from pg_catalog.pg_policies p where p.schemaname = 'reference_data') <> 3
     or (
       select count(*) from pg_catalog.pg_policies p
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
     ) <> 3 then
    raise exception 'blocked: existing reference_data policies differ from the expected three anon/authenticated SELECT policies';
  end if;
end
$$;

-- 2. 専用SELECT policy 4件(これ以外の変更は行わない)
create policy world_player_cards_backup_reader_select
  on reference_data.world_player_cards
  as permissive
  for select
  to reference_data_backup_reader
  using (true);

create policy managers_backup_reader_select
  on reference_data.managers
  as permissive
  for select
  to reference_data_backup_reader
  using (true);

create policy player_card_analysis_backup_reader_select
  on reference_data.player_card_analysis
  as permissive
  for select
  to reference_data_backup_reader
  using (true);

create policy import_batches_backup_reader_select
  on reference_data.import_batches
  as permissive
  for select
  to reference_data_backup_reader
  using (true);

-- 3. 事後確認(同じtransaction内。想定と異なれば例外で全体を取り消す)
do $$
begin
  if (
    select count(*) from pg_catalog.pg_policies p
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
  ) <> 4 then
    raise exception 'blocked: the four backup reader policies were not created as expected';
  end if;
  if (select count(*) from pg_catalog.pg_policies p where p.schemaname = 'reference_data') <> 7 then
    raise exception 'blocked: unexpected number of reference_data policies after apply';
  end if;
end
$$;

commit;
