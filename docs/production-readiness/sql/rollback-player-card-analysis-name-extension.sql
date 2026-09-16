-- ============================================================================
-- extend-player-card-analysis-name-schema.sql のロールバック。
--
-- 追加した制約・列(efhub_name_en)だけを削除する。
-- world_player_cards・managers・import_batches・public/authスキーマ・
-- player_card_analysisの他の列には一切触れない。
-- ============================================================================

alter table reference_data.player_card_analysis drop constraint if exists player_card_analysis_efhub_name_en_not_blank;
alter table reference_data.player_card_analysis drop column if exists efhub_name_en;
