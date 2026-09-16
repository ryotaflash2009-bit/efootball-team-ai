-- ============================================================================
-- extend-name-sort-key-schema.sql のロールバック。
--
-- 追加した制約・インデックス・列(name_sort_key)だけを削除する。
-- スキーマ自体、既存の3テーブル(world_player_cards/managers/player_card_analysis)の
-- 他の列、import_batches、public/authスキーマには一切触れない。
-- ============================================================================

drop index if exists reference_data.world_player_cards_name_sort_key_idx;
alter table reference_data.world_player_cards drop constraint if exists world_player_cards_name_sort_key_not_blank;
alter table reference_data.world_player_cards drop column if exists name_sort_key;

drop index if exists reference_data.managers_name_sort_key_idx;
alter table reference_data.managers drop constraint if exists managers_name_sort_key_not_blank;
alter table reference_data.managers drop column if exists name_sort_key;
