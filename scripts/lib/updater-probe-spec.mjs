/**
 * 自動 Apply の DB ユーザー（reference_data_updater）が持つべき権限（2026-10-07）。
 * `docs/production-readiness/sql/create-reference-data-updater-role.sql` と
 * `src/lib/reference-data/auto-update/updater-role.ts` の UPDATER_COLUMN_GRANTS と同じ（テストで一致を確かめる）。
 * 確認は読み取りだけ（`scripts/lib/db-login-probe.mjs`）。
 */
export const UPDATER_EXPECTED_ROLE = "reference_data_updater";

export const UPDATER_PROBE_SPEC = Object.freeze({
  schema: "reference_data",
  tables: {
    world_player_cards: {
      select: true,
      insert: [
        "world_card_id", "name_en", "name_ja", "card_type", "registered_position", "nationality", "region", "league", "team",
        "ovr_base", "ovr_max", "maximum_level", "card_rating", "playing_style", "playing_style_def", "preferred_foot", "age",
        "height", "weight", "image_url", "mobile_image_url", "boost1", "boost2", "stats", "skills", "ai_styles", "appearance",
        "name_sort_key", "source", "source_url", "appearance_updated_at", "fetched_at", "dataset_version", "import_batch_id",
      ],
      update: [
        "name_en", "name_ja", "card_type", "registered_position", "nationality", "region", "league", "team",
        "ovr_base", "ovr_max", "maximum_level", "card_rating", "playing_style", "playing_style_def", "preferred_foot", "age",
        "height", "weight", "image_url", "mobile_image_url", "boost1", "boost2", "stats", "skills",
        "name_sort_key", "source", "source_url", "appearance_updated_at", "fetched_at", "dataset_version", "import_batch_id", "updated_at",
      ],
    },
    managers: {
      select: true,
      insert: [
        "internal_manager_id", "source", "source_manager_id", "name_en", "released_at", "possession_game", "quick_counter",
        "long_ball_counter", "out_wide", "long_ball", "overload", "has_booster", "has_link_up_play", "booster_confirmation",
        "boosters", "link_up_plays", "name_sort_key", "source_url", "fetched_at", "dataset_version", "import_batch_id",
      ],
      update: [
        "name_en", "released_at", "possession_game", "quick_counter", "long_ball_counter", "out_wide", "long_ball", "overload",
        "has_booster", "has_link_up_play", "booster_confirmation", "boosters", "link_up_plays", "name_sort_key", "source_url",
        "fetched_at", "dataset_version", "import_batch_id", "updated_at",
      ],
    },
    import_batches: {
      select: true,
      insert: ["batch_id", "dataset_version", "target_table", "source", "source_row_count", "inserted_row_count", "payload_hash", "status", "approved_by", "notes"],
      update: ["status", "verified_at", "rolled_back_at"],
    },
  },
});
