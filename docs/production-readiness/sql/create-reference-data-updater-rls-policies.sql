-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- ADDS POLICIES FOR reference_data_updater ONLY
-- NO DELETE POLICY
-- ============================================================================
--
-- reference_data_updater用のRLS policy案(Phase G準備)。RLSはFORCEのまま、対象roleを
-- reference_data_updaterだけに限定したpolicyを9件追加する。DELETE policyは作らない。
-- import_batchesのUPDATEはstatus='pending'の行だけ(既存のverified/rolled_back行は不変)。
-- 既存の公開SELECT policy・Backup reader policyは変更しない。
-- ============================================================================

do $$
declare
  v_role oid := to_regrole('reference_data_updater');
begin
  if v_role is null then
    raise exception 'blocked: role reference_data_updater does not exist';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where oid = v_role and (rolsuper or rolbypassrls)) then
    raise exception 'blocked: reference_data_updater must be NOSUPERUSER and NOBYPASSRLS';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'reference_data' and policyname like '%\_updater\_%' escape '\'
  ) then
    raise exception 'blocked: updater policies already exist';
  end if;
end
$$;

create policy world_player_cards_updater_select on reference_data.world_player_cards
  as permissive for select to reference_data_updater using (true);
create policy world_player_cards_updater_insert on reference_data.world_player_cards
  as permissive for insert to reference_data_updater with check (true);
create policy world_player_cards_updater_update on reference_data.world_player_cards
  as permissive for update to reference_data_updater using (true) with check (true);

create policy managers_updater_select on reference_data.managers
  as permissive for select to reference_data_updater using (true);
create policy managers_updater_insert on reference_data.managers
  as permissive for insert to reference_data_updater with check (true);
create policy managers_updater_update on reference_data.managers
  as permissive for update to reference_data_updater using (true) with check (true);

create policy import_batches_updater_select on reference_data.import_batches
  as permissive for select to reference_data_updater using (true);
create policy import_batches_updater_insert on reference_data.import_batches
  as permissive for insert to reference_data_updater with check (status = 'pending');
create policy import_batches_updater_update_pending on reference_data.import_batches
  as permissive for update to reference_data_updater
  using (status = 'pending')
  with check (status in ('pending', 'verified', 'rolled_back'));
