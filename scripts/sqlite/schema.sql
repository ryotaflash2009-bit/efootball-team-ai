-- eFootball Team AI ローカル SQLite スキーマ（Phase B.5）
-- node:sqlite で適用。すべて IF NOT EXISTS（冪等）。
-- 本番は PostgreSQL へ移行予定。TEXT(iso8601) は将来 TIMESTAMPTZ、INTEGER(bool) は BOOLEAN。

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS parser_versions (
  version    TEXT PRIMARY KEY,
  note       TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_cards (
  efhub_card_id           TEXT PRIMARY KEY,
  parser_version          TEXT NOT NULL,
  source                  TEXT NOT NULL DEFAULT 'efhub',
  source_url              TEXT NOT NULL,
  fetched_at              TEXT NOT NULL,

  slug                    TEXT NOT NULL,
  name_en                 TEXT NOT NULL,
  name_ja                 TEXT NOT NULL,
  name_zh                 TEXT NOT NULL DEFAULT '',

  ovr_base                INTEGER NOT NULL,
  ovr_max                 INTEGER,                 -- player-index.json の o（無ければ NULL）

  player_type_code        INTEGER NOT NULL,        -- 生の数値。名称変換しない
  registered_position     TEXT NOT NULL,
  level_cap               INTEGER NOT NULL,

  playing_style_name      TEXT NOT NULL,
  playing_style_defensive TEXT,                    -- 任意（守備プレースタイル英語名。NULL 可）

  age                     INTEGER NOT NULL,
  height                  INTEGER NOT NULL,
  weight                  INTEGER NOT NULL,
  preferred_foot          TEXT NOT NULL,

  weak_foot_usage         INTEGER NOT NULL,
  weak_foot_accuracy      INTEGER NOT NULL,
  form                    INTEGER NOT NULL,
  condition_value         INTEGER NOT NULL,        -- player.condition
  injury_resistance       INTEGER NOT NULL,

  country_id              INTEGER NOT NULL,
  league_id               INTEGER NOT NULL,
  league_name             TEXT NOT NULL,
  team_id                 TEXT NOT NULL,
  team_name               TEXT NOT NULL,

  boost_id_1              INTEGER NOT NULL DEFAULT 0,
  boost_id_2              INTEGER NOT NULL DEFAULT 0,

  gp_value                REAL NOT NULL DEFAULT 0,
  datapack_id             INTEGER NOT NULL,
  image_url               TEXT NOT NULL,

  player_model_json       TEXT NOT NULL,           -- 体格16項目を JSON 文字列で保持

  FOREIGN KEY (parser_version) REFERENCES parser_versions(version)
);
CREATE INDEX IF NOT EXISTS ix_player_cards_name_ja  ON player_cards(name_ja);
CREATE INDEX IF NOT EXISTS ix_player_cards_name_en  ON player_cards(name_en);
CREATE INDEX IF NOT EXISTS ix_player_cards_pos      ON player_cards(registered_position);
CREATE INDEX IF NOT EXISTS ix_player_cards_type     ON player_cards(player_type_code);

CREATE TABLE IF NOT EXISTS player_card_stats (
  efhub_card_id TEXT NOT NULL REFERENCES player_cards(efhub_card_id),
  stat_key      TEXT NOT NULL,
  stat_kind     TEXT NOT NULL DEFAULT 'base',      -- 'base' | 'max' | 'trained' | 'boosted'
  value         INTEGER NOT NULL,
  PRIMARY KEY (efhub_card_id, stat_key, stat_kind)
);

CREATE TABLE IF NOT EXISTS player_card_skills (
  efhub_card_id TEXT NOT NULL REFERENCES player_cards(efhub_card_id),
  skill_key     TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  PRIMARY KEY (efhub_card_id, skill_key)
);

CREATE TABLE IF NOT EXISTS player_card_com_skills (
  efhub_card_id TEXT NOT NULL REFERENCES player_cards(efhub_card_id),
  skill_key     TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  PRIMARY KEY (efhub_card_id, skill_key)
);

CREATE TABLE IF NOT EXISTS player_card_positions (
  efhub_card_id TEXT NOT NULL REFERENCES player_cards(efhub_card_id),
  position_code TEXT NOT NULL,
  familiarity   INTEGER,                           -- additionalPositions 由来（登録posは NULL）
  is_registered INTEGER NOT NULL DEFAULT 0,        -- 1 = player.position
  PRIMARY KEY (efhub_card_id, position_code)
);

CREATE TABLE IF NOT EXISTS player_card_boosters (
  efhub_card_id TEXT NOT NULL REFERENCES player_cards(efhub_card_id),
  slot          INTEGER NOT NULL,                  -- 1 | 2
  booster_id    INTEGER NOT NULL,                  -- 0 = 空スロット（生値を保持）
  PRIMARY KEY (efhub_card_id, slot)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL,                       -- 'running' | 'done' | 'stopped' | 'failed'
  cursor      TEXT,
  ok_count    INTEGER NOT NULL DEFAULT 0,
  fail_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_errors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        INTEGER REFERENCES sync_runs(id),
  efhub_card_id TEXT,
  http_status   INTEGER,
  error         TEXT NOT NULL,
  attempt       INTEGER NOT NULL DEFAULT 0,
  at            TEXT NOT NULL
);

-- ===== Phase C: 索引（player-index.json 全件） =====
-- player_index_entries = 全索引データ / player_cards = 詳細取得・解析に成功したカード（役割分離）

CREATE TABLE IF NOT EXISTS player_index_entries (
  efhub_card_id      TEXT PRIMARY KEY,       -- player-index.json の i を文字列で保持（精度劣化防止）
  name_en            TEXT,                   -- e
  name_ja            TEXT,                   -- j
  ovr_max_candidate  INTEGER,                -- o（意味は最終確定しない・最大レベルOVR候補）
  source             TEXT NOT NULL DEFAULT 'efhub',
  source_url         TEXT NOT NULL,
  fetched_at         TEXT NOT NULL,
  raw_index_position INTEGER NOT NULL,       -- player-index.json 配列内の位置
  index_sync_run_id  INTEGER REFERENCES sync_runs(id),
  detail_sync_status TEXT NOT NULL DEFAULT 'pending',   -- pending|fetched|failed|anomalous|skipped
  is_anomalous       INTEGER NOT NULL DEFAULT 0,
  anomaly_reason     TEXT,
  first_seen_at      TEXT NOT NULL,
  last_seen_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pie_detail_status ON player_index_entries(detail_sync_status);
CREATE INDEX IF NOT EXISTS ix_pie_anomalous     ON player_index_entries(is_anomalous);
CREATE INDEX IF NOT EXISTS ix_pie_name_ja       ON player_index_entries(name_ja);
CREATE INDEX IF NOT EXISTS ix_pie_name_en       ON player_index_entries(name_en);

CREATE TABLE IF NOT EXISTS sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_run_id    INTEGER REFERENCES sync_runs(id),
  source         TEXT NOT NULL,
  source_url     TEXT NOT NULL,
  fetched_at     TEXT NOT NULL,
  http_status    INTEGER,
  content_length INTEGER,
  record_count   INTEGER,
  content_hash   TEXT,                       -- sha256(生body)。全文は保存しない
  sample_json    TEXT                        -- 先頭3件のみ
);

CREATE TABLE IF NOT EXISTS index_sync_stats (
  sync_run_id        INTEGER PRIMARY KEY REFERENCES sync_runs(id),
  mode               TEXT NOT NULL,          -- 'initial' | 'incremental'
  started_at         TEXT NOT NULL,
  finished_at        TEXT,
  received_count     INTEGER NOT NULL DEFAULT 0,
  new_count          INTEGER NOT NULL DEFAULT 0,
  updated_count      INTEGER NOT NULL DEFAULT 0,
  unchanged_count    INTEGER NOT NULL DEFAULT 0,
  anomaly_count      INTEGER NOT NULL DEFAULT 0,
  fail_count         INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL,
  prev_snapshot_hash TEXT,
  this_snapshot_hash TEXT,
  diff_summary       TEXT,
  next_state_json    TEXT
);

-- ===== eFootball World: players/search 一覧API のフル詳細 =====
-- 既存の eFHUB テーブル（player_cards / player_index_entries 等）とは完全に分離。
-- World ID と eFHUB ID は別体系。同一と仮定しない。

CREATE TABLE IF NOT EXISTS world_player_cards (
  world_card_id         TEXT PRIMARY KEY,       -- players[].id（文字列）
  internal_card_id      INTEGER,               -- 照合後に付与（reconcile）
  name_en               TEXT,                  -- name
  name_ja               TEXT,                  -- nameJp
  card_type             TEXT,                  -- type（"EPIC" 等・文字列）
  registered_position   TEXT,                  -- position
  nationality           TEXT,
  region                TEXT,
  league                TEXT,
  team                  TEXT,
  ovr_base              INTEGER,               -- overallRating
  ovr_max               INTEGER,               -- maxOverall
  maximum_level         INTEGER,               -- maximumLevel
  card_rating           TEXT,                  -- rating（"A"/"B"・意味未確定）
  playing_style         TEXT,                  -- playingStyle
  playing_style_def     TEXT,                  -- playingStyleDef（守備プレースタイル）
  preferred_foot        TEXT,                  -- foot
  age                   INTEGER,
  height                INTEGER,
  weight                INTEGER,
  image_url             TEXT,
  mobile_image_url      TEXT,
  boost1                INTEGER,
  boost2                INTEGER,
  likes_count           INTEGER,
  view_count            INTEGER,
  average_rating        REAL,
  total_ratings         INTEGER,
  appearance_updated_at TEXT,                  -- appearance.updatedAt（差分同期に使用）
  source                TEXT NOT NULL DEFAULT 'world',
  source_url            TEXT NOT NULL,
  fetched_at            TEXT NOT NULL,
  world_sync_run_id     INTEGER REFERENCES world_sync_runs(id)
);
CREATE INDEX IF NOT EXISTS ix_wpc_name_en   ON world_player_cards(name_en);
CREATE INDEX IF NOT EXISTS ix_wpc_name_ja   ON world_player_cards(name_ja);
CREATE INDEX IF NOT EXISTS ix_wpc_type      ON world_player_cards(card_type);
CREATE INDEX IF NOT EXISTS ix_wpc_pos       ON world_player_cards(registered_position);
CREATE INDEX IF NOT EXISTS ix_wpc_internal  ON world_player_cards(internal_card_id);
CREATE INDEX IF NOT EXISTS ix_wpc_updated   ON world_player_cards(appearance_updated_at);
-- UI（一覧の並べ替え・フィルタ）向け（Phase: World UI 接続）
CREATE INDEX IF NOT EXISTS ix_wpc_ovr_max      ON world_player_cards(ovr_max);
CREATE INDEX IF NOT EXISTS ix_wpc_ovr_base     ON world_player_cards(ovr_base);
CREATE INDEX IF NOT EXISTS ix_wpc_playstyle    ON world_player_cards(playing_style);
CREATE INDEX IF NOT EXISTS ix_wpc_playstyledef ON world_player_cards(playing_style_def);
CREATE INDEX IF NOT EXISTS ix_wpc_name_en_nocase ON world_player_cards(name_en COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS world_player_stats (
  world_card_id TEXT NOT NULL REFERENCES world_player_cards(world_card_id),
  stat_key      TEXT NOT NULL,                 -- World の表示名キー（tackling 等）
  stat_kind     TEXT NOT NULL DEFAULT 'base',
  value         INTEGER NOT NULL,
  PRIMARY KEY (world_card_id, stat_key, stat_kind)
);

CREATE TABLE IF NOT EXISTS world_player_skills (
  world_card_id TEXT NOT NULL REFERENCES world_player_cards(world_card_id),
  skill_name    TEXT NOT NULL,                 -- "Chop Turn" 等（読める名称）
  display_order INTEGER NOT NULL,
  PRIMARY KEY (world_card_id, skill_name)
);

CREATE TABLE IF NOT EXISTS world_player_ai_styles (
  world_card_id TEXT NOT NULL REFERENCES world_player_cards(world_card_id),
  style_name    TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  PRIMARY KEY (world_card_id, style_name)
);

CREATE TABLE IF NOT EXISTS world_player_appearances (
  world_card_id       TEXT PRIMARY KEY REFERENCES world_player_cards(world_card_id),
  position            TEXT,
  leg_coverage_radius REAL,
  arm_coverage_radius REAL,
  torso_collision     REAL,
  jumping_height      REAL,
  dribble_height      REAL,
  leg_length          REAL,
  ranks_json          TEXT,                    -- 各項目の overall/position 順位・パーセンタイル
  updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS world_source_snapshots (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  world_sync_run_id INTEGER REFERENCES world_sync_runs(id),
  page              INTEGER NOT NULL,
  size              INTEGER NOT NULL,
  record_count      INTEGER NOT NULL,
  content_hash      TEXT,
  updated_at_min    TEXT,
  updated_at_max    TEXT,
  fetched_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_sync_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,                   -- 'world-initial' | 'world-incremental'
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL,                   -- 'running' | 'done' | 'stopped' | 'failed'
  cursor      TEXT,
  ok_count    INTEGER NOT NULL DEFAULT 0,
  fail_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS world_sync_errors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        INTEGER REFERENCES world_sync_runs(id),
  page          INTEGER,
  world_card_id TEXT,
  http_status   INTEGER,
  error         TEXT NOT NULL,
  attempt       INTEGER NOT NULL DEFAULT 0,
  at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_sync_progress (
  world_sync_run_id         INTEGER PRIMARY KEY REFERENCES world_sync_runs(id),
  status                    TEXT,
  started_at                TEXT,
  updated_at                TEXT,
  finished_at               TEXT,
  total_count               INTEGER,
  total_pages               INTEGER,
  completed_pages           INTEGER,
  completed_cards           INTEGER,
  success_count             INTEGER,
  failed_count              INTEGER,
  duplicate_count           INTEGER,
  remaining_pages           INTEGER,
  remaining_cards           INTEGER,
  progress_percent          REAL,
  current_page              INTEGER,
  page_cursor               INTEGER,
  last_completed_page       INTEGER,
  next_page                 INTEGER,
  request_interval_ms       INTEGER,
  average_response_ms       REAL,
  average_save_ms           REAL,
  current_rate_per_minute   REAL,
  estimated_remaining_seconds REAL,
  estimated_completion_at   TEXT,
  request_count             INTEGER,
  http_429_count            INTEGER,
  http_403_count            INTEGER,
  http_5xx_count            INTEGER,
  timeout_count             INTEGER,
  consecutive_failure_count INTEGER,
  stop_reason               TEXT,
  resume_count              INTEGER
);

-- ===== ソース横断: 内部ID・照合・競合 =====

CREATE TABLE IF NOT EXISTS source_record_links (
  internal_card_id INTEGER NOT NULL,
  source           TEXT NOT NULL,              -- 'efhub' | 'world'
  source_card_id   TEXT NOT NULL,
  linked_at        TEXT NOT NULL,
  PRIMARY KEY (source, source_card_id)
);
CREATE INDEX IF NOT EXISTS ix_srl_internal ON source_record_links(internal_card_id);

CREATE TABLE IF NOT EXISTS merge_candidates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_card_id INTEGER,
  efhub_card_id    TEXT,
  world_card_id    TEXT,
  match_score      REAL,
  match_reason     TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'confirmed' | 'rejected'
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_mc_status ON merge_candidates(status);

CREATE TABLE IF NOT EXISTS data_conflicts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_card_id  INTEGER,
  efhub_card_id     TEXT,
  world_card_id     TEXT,
  field_name        TEXT NOT NULL,
  efhub_value       TEXT,
  world_value       TEXT,
  detected_at       TEXT NOT NULL,
  confidence        REAL,
  resolution_status TEXT NOT NULL DEFAULT 'open',      -- 'open' | 'resolved' | 'ignored'
  resolved_value    TEXT,
  resolution_reason TEXT
);
CREATE INDEX IF NOT EXISTS ix_dc_status ON data_conflicts(resolution_status);

CREATE TABLE IF NOT EXISTS source_priorities (
  field_name    TEXT PRIMARY KEY,
  primary_source TEXT NOT NULL,
  note          TEXT
);

CREATE TABLE IF NOT EXISTS stat_key_map (
  world_key TEXT PRIMARY KEY,
  efhub_key TEXT NOT NULL,
  name_en   TEXT NOT NULL
);

-- ===== 監督（Manager）: amine250/efootball-managers の data/managers.json =====
-- 既存の World / eFHUB テーブルとは完全に分離。同名でも id / releaseDate / booster / 適性 /
-- Link-Up Play が異なれば別カードとして保存する（名前だけの自動統合はしない）。

CREATE TABLE IF NOT EXISTS managers (
  internal_manager_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  source                TEXT NOT NULL,             -- 'amine250'
  source_manager_id     TEXT NOT NULL,             -- managers.json の id（カード識別子）
  name_en               TEXT NOT NULL,
  name_ja               TEXT,                      -- ソースに無い → NULL
  team_name             TEXT,                      -- ソースに無い → NULL
  nationality           TEXT,                      -- ソースに無い → NULL
  age                   INTEGER,                   -- ソースに無い → NULL
  released_at           TEXT,                      -- releaseDate（ISO・NULL 可）
  possession_game       INTEGER,
  quick_counter         INTEGER,
  long_ball_counter     INTEGER,
  out_wide              INTEGER,
  long_ball             INTEGER,
  overload              INTEGER,                   -- NULL 可
  manager_rating        TEXT,                      -- ソースに無い → NULL
  coaching_affinity     TEXT,                      -- ソースに無い → NULL
  formation             TEXT,                      -- ソースに無い → NULL
  photo_path            TEXT,                      -- data/photos/... （画像取得はしない）
  has_booster           INTEGER NOT NULL DEFAULT 0,
  has_link_up_play      INTEGER NOT NULL DEFAULT 0,
  booster_confirmation  TEXT NOT NULL DEFAULT 'unresolved',  -- 'confirmed' | 'provisional' | 'unresolved'
  source_url            TEXT NOT NULL,
  fetched_at            TEXT NOT NULL,
  manager_sync_run_id   INTEGER REFERENCES manager_sync_runs(id),
  UNIQUE (source, source_manager_id)
);
CREATE INDEX IF NOT EXISTS ix_mgr_name    ON managers(name_en);
CREATE INDEX IF NOT EXISTS ix_mgr_source  ON managers(source, source_manager_id);

CREATE TABLE IF NOT EXISTS manager_source_records (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_manager_id INTEGER NOT NULL REFERENCES managers(internal_manager_id),
  source              TEXT NOT NULL,
  source_manager_id   TEXT NOT NULL,
  source_url          TEXT NOT NULL,
  fetched_at          TEXT NOT NULL,
  raw_hash            TEXT,
  UNIQUE (source, source_manager_id)
);

-- 戦術適性（正規化。managers にも同値をインラインで保持）
CREATE TABLE IF NOT EXISTS manager_tactical_proficiencies (
  internal_manager_id INTEGER NOT NULL REFERENCES managers(internal_manager_id),
  proficiency_key     TEXT NOT NULL,   -- possessionGame | quickCounter | longBallCounter | outWide | longBall | overload
  value               INTEGER,
  PRIMARY KEY (internal_manager_id, proficiency_key)
);

CREATE TABLE IF NOT EXISTS manager_boosters (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_manager_id INTEGER NOT NULL REFERENCES managers(internal_manager_id),
  display_order       INTEGER NOT NULL,
  stat_name_en        TEXT NOT NULL,   -- "Defensive Awareness" 等（ソースの表示名）
  stat_key            TEXT,            -- stat_key_map 経由の World キー（変換不能なら NULL）
  delta               INTEGER NOT NULL,  -- "+1" → 1
  raw_value           TEXT NOT NULL,   -- 元の "+1"
  application_condition TEXT,          -- 現状 NULL（無条件とみられる）
  confirmation_status TEXT NOT NULL DEFAULT 'confirmed'
);
CREATE INDEX IF NOT EXISTS ix_mgr_booster_mid ON manager_boosters(internal_manager_id);

CREATE TABLE IF NOT EXISTS manager_affinities (
  internal_manager_id INTEGER PRIMARY KEY REFERENCES managers(internal_manager_id),
  coaching_affinity   TEXT,            -- ソースに無い → NULL
  confirmation_status TEXT NOT NULL DEFAULT 'unresolved'
);

CREATE TABLE IF NOT EXISTS manager_formations (
  internal_manager_id INTEGER PRIMARY KEY REFERENCES managers(internal_manager_id),
  formation           TEXT,            -- ソースに無い → NULL
  confirmation_status TEXT NOT NULL DEFAULT 'unresolved'
);

CREATE TABLE IF NOT EXISTS manager_link_up_plays (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_manager_id INTEGER NOT NULL REFERENCES managers(internal_manager_id),
  display_order       INTEGER NOT NULL,
  name                TEXT NOT NULL,   -- "Over-the-Top Pass A" 等
  confirmation_status TEXT NOT NULL DEFAULT 'provisional'
);
CREATE INDEX IF NOT EXISTS ix_mgr_lup_mid ON manager_link_up_plays(internal_manager_id);

CREATE TABLE IF NOT EXISTS manager_link_up_conditions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  link_up_play_id       INTEGER NOT NULL REFERENCES manager_link_up_plays(id),
  role                  TEXT NOT NULL,   -- 'centerPiece' | 'keyMan'
  playing_style         TEXT,
  positions_json        TEXT NOT NULL    -- ["LWF","RWF"] を JSON 文字列で
);
CREATE INDEX IF NOT EXISTS ix_mgr_lupc_lupid ON manager_link_up_conditions(link_up_play_id);

CREATE TABLE IF NOT EXISTS manager_sync_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,           -- 'manager-initial' | 'manager-incremental'
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL,
  source_url  TEXT,
  received_count INTEGER NOT NULL DEFAULT 0,
  ok_count    INTEGER NOT NULL DEFAULT 0,
  fail_count  INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT
);

CREATE TABLE IF NOT EXISTS manager_sync_errors (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id            INTEGER REFERENCES manager_sync_runs(id),
  source_manager_id TEXT,
  error             TEXT NOT NULL,
  at                TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manager_sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manager_merge_candidates (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_manager_id INTEGER,
  other_source        TEXT,
  other_manager_id    TEXT,
  match_score         REAL,
  match_reason        TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manager_data_conflicts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  internal_manager_id INTEGER,
  field_name          TEXT NOT NULL,
  source_a            TEXT,
  value_a             TEXT,
  source_b            TEXT,
  value_b             TEXT,
  detected_at         TEXT NOT NULL,
  resolution_status   TEXT NOT NULL DEFAULT 'open'
);

-- ===========================================================================
--  選手ブースターの定義カタログ（名前 → 対象能力）
--  出所: EFScout boot.json referenceData.allBoosters（ゲーム機構の事実）+ screenshot 突き合わせ。
--  World `boost1`/`boost2`・eFHUB `boost_id` の数値 ID とはこの表の番号体系が一致しないため、
--  source_booster_id は「別々に保存（今回は未マッピング=NULL）」。src/lib/progression/booster-catalog.ts が真の出所。
-- ===========================================================================
CREATE TABLE IF NOT EXISTS player_booster_definitions (
  booster_key         TEXT PRIMARY KEY,        -- カタログの slug
  name_en             TEXT NOT NULL,
  name_ja             TEXT,
  category            TEXT NOT NULL,           -- 'standard' | 'special' | 'single'
  affected_stat_keys  TEXT NOT NULL,           -- JSON 配列（World キー）
  per_level_delta     INTEGER NOT NULL DEFAULT 1,
  max_level           INTEGER NOT NULL,
  conditional         INTEGER NOT NULL DEFAULT 0,
  confirmation_status TEXT NOT NULL,           -- 'confirmed' | 'provisional'（後方互換の派生値）
  evidence_level      TEXT,                    -- 'game_client_verified' | 'screenshot_verified' | 'external_cross_verified' | 'effect_provisional' | 'conditional_unverified'
  condition_text      TEXT,                    -- 発動条件の内容（判明時のみ・total-package）。NULL = 条件なし or 未確認
  condition_evaluable INTEGER,                 -- 1 = 条件を静的データで評価可能 / 0 = 条件は判明も評価不能（total-package）
  evidence            TEXT NOT NULL,
  source              TEXT NOT NULL DEFAULT 'efscout',
  world_source_booster_id  INTEGER,            -- World の数値ID（未マッピング=NULL）
  efhub_source_booster_id  INTEGER,            -- eFHUB の数値ID（未マッピング=NULL）
  catalog_version     TEXT NOT NULL,
  verified_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_booster_def_conf ON player_booster_definitions(confirmation_status);

CREATE TABLE IF NOT EXISTS player_booster_sync_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL,
  catalog_version TEXT,
  row_count   INTEGER NOT NULL DEFAULT 0
);

-- ===========================================================================
--  カード付属ブースター（数値 ID）→ ブースター名・レベルの対応表
--  出所（名称・レベル）: eFootball 公式 efootball-world.com の個別選手ページの表示を直接観測（2026-08-28）。
--  出所（効果 = 対象能力・上昇量）: 名称一致で player_booster_definitions を参照。
--    ball-carrying / offence-creator は screenshot 実測で確認済み（auto_apply=1）。他は provisional。
--  World boost1 と boost2、eFHUB boost_id は **別々の ID 体系**（source + source_booster_id が一意）。
--  番号の近さからの推測はしない。ここに載るのは実際に観測できた ID のみ。
-- ===========================================================================
CREATE TABLE IF NOT EXISTS player_booster_source_mappings (
  source                TEXT NOT NULL,           -- 'world_boost1' | 'world_boost2' | 'efhub'
  source_booster_id     INTEGER NOT NULL,
  internal_booster_key  TEXT NOT NULL REFERENCES player_booster_definitions(booster_key),
  level                 INTEGER NOT NULL,
  name_status           TEXT NOT NULL DEFAULT 'confirmed',   -- 名称・レベルの確認状態
  effect_status         TEXT NOT NULL,           -- 'confirmed' | 'provisional' | 'conditional'
  auto_apply            INTEGER NOT NULL DEFAULT 0,
  confidence_score      REAL NOT NULL DEFAULT 0,
  evidence_count        INTEGER NOT NULL DEFAULT 1,
  evidence              TEXT NOT NULL,
  source_url            TEXT,
  resolution_version    TEXT NOT NULL,
  verified_at           TEXT NOT NULL,
  -- v2 追加（sync-booster-resolution.mjs が古い DB へ ALTER で補完）
  resolved_name          TEXT,
  resolved_level         INTEGER,
  affected_stats_json    TEXT,
  per_level_delta        INTEGER,
  condition_note         TEXT,
  verified_card_count    INTEGER NOT NULL DEFAULT 0,
  conflicting_card_count INTEGER NOT NULL DEFAULT 0,
  activation_type        TEXT,   -- v7: 'fixed' | 'power_of_many' | 'live_update' | 'unresolved'（fixed 以外はどのモードでも自動適用しない）
  activation_evidence    TEXT,   -- v8: 'official_verified' | 'screenshot_verified' | 'external_cross_verified' | 'provisional'（＝推定） | 'unresolved' | 'conflicted'
  PRIMARY KEY (source, source_booster_id)
);
CREATE INDEX IF NOT EXISTS ix_pbsm_key    ON player_booster_source_mappings(internal_booster_key);
CREATE INDEX IF NOT EXISTS ix_pbsm_auto   ON player_booster_source_mappings(auto_apply);

-- 同じ ID が複数の異なるブースターへ対応してしまうケースの記録（現状 0 件）
CREATE TABLE IF NOT EXISTS player_booster_conflicts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  source              TEXT NOT NULL,
  source_booster_id   INTEGER NOT NULL,
  candidate_key_a     TEXT NOT NULL,
  candidate_key_b     TEXT NOT NULL,
  detail              TEXT NOT NULL,
  detected_at         TEXT NOT NULL,
  resolution_status   TEXT NOT NULL DEFAULT 'open'
);

-- World カード単位の付属ブースター解決結果（boost を持つカードのみ・読み取り専用の派生データ）
CREATE TABLE IF NOT EXISTS player_card_resolved_boosters (
  world_card_id        TEXT NOT NULL REFERENCES world_player_cards(world_card_id),
  slot                 INTEGER NOT NULL,        -- 1 | 2
  source_booster_id    INTEGER NOT NULL,
  internal_booster_key TEXT,                    -- 解決できなければ NULL
  resolved_name        TEXT,
  level                INTEGER,
  applied              INTEGER NOT NULL DEFAULT 0,
  confirmation_status  TEXT NOT NULL,           -- 'confirmed' | 'provisional' | 'conditional' | 'unresolved'
  resolution_reason    TEXT NOT NULL,
  resolution_version   TEXT NOT NULL,
  resolved_at          TEXT NOT NULL,
  PRIMARY KEY (world_card_id, slot)
);
CREATE INDEX IF NOT EXISTS ix_pcrb_key  ON player_card_resolved_boosters(internal_booster_key);
CREATE INDEX IF NOT EXISTS ix_pcrb_conf ON player_card_resolved_boosters(confirmation_status);

CREATE TABLE IF NOT EXISTS player_booster_resolution_runs (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at           TEXT NOT NULL,
  finished_at          TEXT,
  status               TEXT NOT NULL,
  resolution_version   TEXT,
  mapping_row_count    INTEGER NOT NULL DEFAULT 0,
  boosted_card_count   INTEGER NOT NULL DEFAULT 0,
  slot1_resolved       INTEGER NOT NULL DEFAULT 0,
  slot2_resolved       INTEGER NOT NULL DEFAULT 0,
  auto_applied_cards   INTEGER NOT NULL DEFAULT 0,
  provisional_cards    INTEGER NOT NULL DEFAULT 0,
  unresolved_cards     INTEGER NOT NULL DEFAULT 0,
  conflict_count       INTEGER NOT NULL DEFAULT 0,
  notes                TEXT
);
