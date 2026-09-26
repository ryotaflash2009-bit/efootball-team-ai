-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- CREATES A SELECT-ONLY ROLE FOR THE AUTOMATED PLAN (one-approval pipeline)
-- ============================================================================
--
-- reference_data_plan_reader: 自動更新パイプラインの Plan が Production の現在状態を読むためだけの role
-- (docs/production-readiness/automated-update-pipeline.md)。
--
-- - LOGIN(パスワードはこのSQLでは設定しない。本人が別途 ALTER ROLE ... PASSWORD で設定し、
--   接続情報を reference-data-automation Environment の REFERENCE_DATA_PLAN_READ_DB_URL に登録する)
-- - NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
-- - 権限: reference_data schema の USAGE、world_player_cards・managers・import_batches の SELECT だけ
--   (player_card_analysis・auth・public の利用者データには権限を与えない)
-- - RLS: 上記3 table に、この role だけを対象とする SELECT 専用・PERMISSIVE の policy(USING (true))
--
-- この role を作るまでは、同じ読み取り専用の reference_data_backup_reader の接続情報を
-- REFERENCE_DATA_PLAN_READ_DB_URL に設定して運用できる(Plan の preflight はどちらの role も許可する)。
-- 事前確認で想定外の状態を検出した場合は例外で停止し、transaction 全体が取り消される。
-- ============================================================================

begin;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'reference_data_plan_reader') then
    raise exception 'reference_data_plan_reader already exists; refusing to modify an existing role';
  end if;
  if to_regclass('reference_data.world_player_cards') is null
     or to_regclass('reference_data.managers') is null
     or to_regclass('reference_data.import_batches') is null then
    raise exception 'reference_data tables are missing';
  end if;
end
$$;

create role reference_data_plan_reader login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;

grant usage on schema reference_data to reference_data_plan_reader;
grant select on reference_data.world_player_cards to reference_data_plan_reader;
grant select on reference_data.managers to reference_data_plan_reader;
grant select on reference_data.import_batches to reference_data_plan_reader;

create policy reference_data_plan_reader_select_world_player_cards on reference_data.world_player_cards as permissive for select to reference_data_plan_reader using (true);
create policy reference_data_plan_reader_select_managers on reference_data.managers as permissive for select to reference_data_plan_reader using (true);
create policy reference_data_plan_reader_select_import_batches on reference_data.import_batches as permissive for select to reference_data_plan_reader using (true);

commit;
