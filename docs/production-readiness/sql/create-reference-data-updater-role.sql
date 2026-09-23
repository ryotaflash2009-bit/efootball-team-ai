-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- DOES NOT CREATE OR STORE A PASSWORD
-- DOES NOT GRANT USER-DATA ACCESS
-- DOES NOT GRANT DELETE OR TRUNCATE
-- ============================================================================
--
-- 参照データ自動更新のProduction書込み専用role(reference_data_updater)の作成SQL案(Phase G準備)。
--
-- このSQLはProductionでは実行していない(使い捨てPostgreSQLでだけ検証済み)。実行する場合は、
-- 本人による独立した承認(Stage 2: Production updater role/policy設定)を経てから、本人が手動で
-- Supabase SQL Editorから実行すること。Claude Code自身はProductionでこのSQLを実行しない。
--
-- password: このSQLはパスワードを生成・設定・保存しない(LOGINだけを付与する)。パスワードの設定と
-- GitHub Environment Secretへの登録は、本人が別操作として実施する。
--
-- 権限の要点(src/lib/reference-data/auto-update/updater-role.ts のUPDATER_COLUMN_GRANTSと一致させる):
--   - reference_dataのworld_player_cards・managers・import_batchesだけ。player_card_analysis・
--     reference_data_ops・auth・public・Storage・Vaultへは何も付与しない。
--   - SELECTはtable単位。INSERT/UPDATEは列単位で、保持列(World ai_styles・appearance、eFHUB由来の
--     efhub_card_id・efhub_conflicts、managersのinsert時のみの列)・identity・主キーはUPDATEできない。
--   - DELETE・TRUNCATE・REFERENCES・TRIGGERは付与しない(物理削除はDB権限の上でも不可能)。
--   - RLSはFORCEのまま。対象roleをreference_data_updaterに限定したpolicyを別SQL
--     (create-reference-data-updater-rls-policies.sql)で追加する。
-- ============================================================================

-- 0. 前提確認(満たさなければ何も変更せずに停止する)。
do $$
declare
  v_table text;
begin
  if to_regrole('reference_data_updater') is not null then
    raise exception 'blocked: role reference_data_updater already exists';
  end if;
  foreach v_table in array array['world_player_cards', 'managers', 'import_batches'] loop
    if to_regclass('reference_data.' || v_table) is null then
      raise exception 'blocked: reference_data.% does not exist', v_table;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'reference_data' and c.relname = v_table and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'blocked: reference_data.% must have row level security enabled and forced', v_table;
    end if;
  end loop;
end
$$;

-- 1. role(LOGINのみ・パスワードなし・特権なし・継承なし・同時接続1)。
create role reference_data_updater with
  login
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls
  noinherit
  connection limit 1;

comment on role reference_data_updater is
  '参照データ自動更新のProduction書込み専用role。world_player_cards・managers・import_batchesへの列単位INSERT/UPDATEだけを許可する。DELETE/TRUNCATEなし。このSQLではパスワードを設定しない。';

-- 2. schema usage。
grant usage on schema reference_data to reference_data_updater;

-- 3. world_player_cards。
grant select on table reference_data.world_player_cards to reference_data_updater;
grant insert (
  world_card_id, name_en, name_ja, card_type, registered_position, nationality, region, league, team,
  ovr_base, ovr_max, maximum_level, card_rating, playing_style, playing_style_def, preferred_foot, age,
  height, weight, image_url, mobile_image_url, boost1, boost2, stats, skills, ai_styles, appearance,
  name_sort_key, source, source_url, appearance_updated_at, fetched_at, dataset_version, import_batch_id
) on table reference_data.world_player_cards to reference_data_updater;
grant update (
  name_en, name_ja, card_type, registered_position, nationality, region, league, team,
  ovr_base, ovr_max, maximum_level, card_rating, playing_style, playing_style_def, preferred_foot, age,
  height, weight, image_url, mobile_image_url, boost1, boost2, stats, skills,
  name_sort_key, source, source_url, appearance_updated_at, fetched_at, dataset_version, import_batch_id, updated_at
) on table reference_data.world_player_cards to reference_data_updater;

-- 4. managers。
grant select on table reference_data.managers to reference_data_updater;
grant insert (
  internal_manager_id, source, source_manager_id, name_en, released_at, possession_game, quick_counter,
  long_ball_counter, out_wide, long_ball, overload, has_booster, has_link_up_play, booster_confirmation,
  boosters, link_up_plays, name_sort_key, source_url, fetched_at, dataset_version, import_batch_id
) on table reference_data.managers to reference_data_updater;
grant update (
  name_en, released_at, possession_game, quick_counter, long_ball_counter, out_wide, long_ball, overload,
  has_booster, has_link_up_play, booster_confirmation, boosters, link_up_plays, name_sort_key, source_url,
  fetched_at, dataset_version, import_batch_id, updated_at
) on table reference_data.managers to reference_data_updater;

-- 5. import_batches(追記と、pending行のstatus遷移だけ。pendingへの限定はRLS policyで行う)。
grant select on table reference_data.import_batches to reference_data_updater;
grant insert (
  batch_id, dataset_version, target_table, source, source_row_count, inserted_row_count, payload_hash,
  status, approved_by, notes
) on table reference_data.import_batches to reference_data_updater;
grant update (status, verified_at, rolled_back_at) on table reference_data.import_batches to reference_data_updater;

-- 6. session既定値(長時間lock・放置transactionを防ぐ)。
alter role reference_data_updater set statement_timeout = '120s';
alter role reference_data_updater set lock_timeout = '5s';
alter role reference_data_updater set idle_in_transaction_session_timeout = '60s';
alter role reference_data_updater set search_path = reference_data;
