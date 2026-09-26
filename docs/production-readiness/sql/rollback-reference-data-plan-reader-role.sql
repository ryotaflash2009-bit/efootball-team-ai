-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- Rollback of create-reference-data-plan-reader-role.sql (policies, grants, role).
-- ============================================================================

begin;

drop policy if exists reference_data_plan_reader_select_world_player_cards on reference_data.world_player_cards;
drop policy if exists reference_data_plan_reader_select_managers on reference_data.managers;
drop policy if exists reference_data_plan_reader_select_import_batches on reference_data.import_batches;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'reference_data_plan_reader') then
    revoke all on reference_data.world_player_cards from reference_data_plan_reader;
    revoke all on reference_data.managers from reference_data_plan_reader;
    revoke all on reference_data.import_batches from reference_data_plan_reader;
    revoke usage on schema reference_data from reference_data_plan_reader;
    drop role reference_data_plan_reader;
  end if;
end
$$;

commit;
