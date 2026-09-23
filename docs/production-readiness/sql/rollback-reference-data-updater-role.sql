-- ============================================================================
-- DO NOT RUN
-- DESIGN ONLY
-- REQUIRES SEPARATE APPROVAL
-- PRODUCTION NOT APPLIED
-- REMOVES reference_data_updater POLICIES, GRANTS AND ROLE ONLY
-- DOES NOT TOUCH REFERENCE DATA ROWS
-- ============================================================================
--
-- reference_data_updaterの無効化・削除SQL案(Phase G準備)。行データには触れない。
-- 緊急停止だけなら 1. のnologin化で足りる(その後Environment Secretを削除する)。
-- ============================================================================

-- 1. 直ちにログイン不可にする(既存sessionは別途終了を確認する)。
alter role reference_data_updater nologin;

-- 2. policyを削除する(updater専用の9件だけ)。
drop policy if exists world_player_cards_updater_select on reference_data.world_player_cards;
drop policy if exists world_player_cards_updater_insert on reference_data.world_player_cards;
drop policy if exists world_player_cards_updater_update on reference_data.world_player_cards;
drop policy if exists managers_updater_select on reference_data.managers;
drop policy if exists managers_updater_insert on reference_data.managers;
drop policy if exists managers_updater_update on reference_data.managers;
drop policy if exists import_batches_updater_select on reference_data.import_batches;
drop policy if exists import_batches_updater_insert on reference_data.import_batches;
drop policy if exists import_batches_updater_update_pending on reference_data.import_batches;

-- 3. 権限を取り消す。
revoke all privileges on table
  reference_data.world_player_cards,
  reference_data.managers,
  reference_data.import_batches
from reference_data_updater;
revoke usage on schema reference_data from reference_data_updater;

-- 4. roleを削除する(所有objectがあればPostgreSQLがエラーで止める)。
alter role reference_data_updater reset all;
drop role if exists reference_data_updater;
