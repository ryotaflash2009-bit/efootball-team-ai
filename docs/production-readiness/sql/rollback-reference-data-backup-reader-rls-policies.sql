-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- REMOVES ONLY THE FOUR reference_data_backup_reader SELECT POLICIES
-- DOES NOT GRANT, REVOKE, ALTER ROLE, DROP ROLE, OR CHANGE TABLE RLS SETTINGS
-- ============================================================================
--
-- create-reference-data-backup-reader-rls-policies.sqlで追加した専用SELECT policy
-- 4件だけを削除するrollback SQL。
--
-- 削除対象は固定の4件(policy名とtableの組)だけで、既存のanon/authenticated向け
-- policy・role・table・GRANT・RLS設定(有効/FORCE)には一切触れない。
-- 4件が想定どおりの定義(SELECT・PERMISSIVE・reference_data_backup_readerだけ・
-- USING (true)・WITH CHECK無し)で、想定どおりのtableに存在する場合だけ削除する。
-- 1件でも欠けている・定義が異なる場合は、何も削除せず例外で停止する
-- (transaction全体が取り消される)。CASCADEやIF EXISTSは使わない。
--
-- rollback後は、このroleからは再びRLSの既定拒否で0行に見える状態に戻り、
-- Backupはsource preflightで安全にblockedになる。
--
-- このSQLはこのセッションでは実行していない。実行する場合は、rollbackについて
-- 別途明示承認を得てから本人がSupabase SQL Editorで実行し、
-- verify-reference-data-backup-reader-rls-policies-post-apply.sqlの結果
-- (new_policy_count=0、既存policy不変)で確認する。
-- ============================================================================

begin;

-- 1. 事前確認: 削除対象4件が想定どおりの定義・tableに存在すること
do $$
begin
  if (
    select count(*) from pg_catalog.pg_policies p
    where p.policyname in (
      'world_player_cards_backup_reader_select',
      'managers_backup_reader_select',
      'player_card_analysis_backup_reader_select',
      'import_batches_backup_reader_select'
    )
  ) <> 4 then
    raise exception 'blocked: expected exactly four backup reader policies (none removed)';
  end if;
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
    raise exception 'blocked: backup reader policies differ from the expected definition (none removed)';
  end if;
end
$$;

-- 2. 専用policy 4件だけを削除する
drop policy world_player_cards_backup_reader_select on reference_data.world_player_cards;
drop policy managers_backup_reader_select on reference_data.managers;
drop policy player_card_analysis_backup_reader_select on reference_data.player_card_analysis;
drop policy import_batches_backup_reader_select on reference_data.import_batches;

-- 3. 事後確認: 4件が消え、既存のanon/authenticated向けpolicy 3件は残っていること
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'reference_data'
      and p.roles @> array['reference_data_backup_reader']::name[]
  ) then
    raise exception 'blocked: a policy targeting reference_data_backup_reader still exists';
  end if;
  if (
    select count(*) from pg_catalog.pg_policies p
    where p.schemaname = 'reference_data'
      and (p.tablename, p.policyname) in (
        ('world_player_cards', 'world_player_cards_select_all'),
        ('managers', 'managers_select_all'),
        ('player_card_analysis', 'player_card_analysis_select_all')
      )
  ) <> 3 then
    raise exception 'blocked: existing anon/authenticated policies are not all present after rollback';
  end if;
end
$$;

commit;
