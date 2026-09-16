-- ============================================================================
-- reference_data 詳細フィールド追加のロールバック(2026-09-15)
-- ============================================================================
--
-- 用途: extend-reference-data-detail-schema.sql で追加した列だけを安全に削除する。
--   reference_data スキーマ自体・既存3テーブル(world_player_cards・managers・
--   player_card_analysis)・import_batches・行データは削除しない。列の削除のみ。
--
-- 影響範囲: reference_data.world_player_cards の efhub_card_id/ai_styles/
--   appearance/efhub_conflicts列、reference_data.managers の boosters/
--   link_up_plays列。それ以外の列・行・他テーブル・他スキーマは一切変更しない。
--
-- 注意: DROP COLUMN は当該列のデータを削除する(この操作自体は取り消せない)。
--   ローカルのSQLite(data/efootball.db)には一切影響しない
--   (この参照データは正本SQLiteから都度再投入できる設計のため)。
--
--   実行前に、本当に不要になったこと・再投入できる状態にあることを確認すること。
-- ============================================================================

alter table reference_data.world_player_cards
  drop constraint if exists world_player_cards_efhub_card_id_format,
  drop constraint if exists world_player_cards_efhub_card_id_unique,
  drop constraint if exists world_player_cards_appearance_is_object,
  drop constraint if exists world_player_cards_efhub_conflicts_is_array;

alter table reference_data.world_player_cards
  drop column if exists efhub_card_id,
  drop column if exists ai_styles,
  drop column if exists appearance,
  drop column if exists efhub_conflicts;

alter table reference_data.managers
  drop constraint if exists managers_boosters_is_array,
  drop constraint if exists managers_link_up_plays_is_array;

alter table reference_data.managers
  drop column if exists boosters,
  drop column if exists link_up_plays;

-- reference_dataスキーマ自体・既存3テーブル・import_batches・GRANT/RLSポリシーは
-- ここでは変更しない(create-reference-data-schema.sql / rollback-reference-data-schema.sql
-- のスキーマ全体ロールバックとは別の、この拡張だけを対象にした部分ロールバック)。
