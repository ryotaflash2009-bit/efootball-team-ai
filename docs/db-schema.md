# eFootball Team AI DB スキーマ

- **Phase B.5 で実装済み**: ローカル SQLite（`node:sqlite`）へ移行。実 DDL は `scripts/sqlite/schema.sql`、DB は `data/efootball.db`（.gitignore）。
- 実データの正本: 当面は `src/data/cards/*.json`（`ParsedPlayerCard`）と SQLite の**両方**を保持（SQLite は JSON から再生成可能・照合の基準は JSON）。
- 本番は PostgreSQL へ移行予定。
- 方針: 能力値は `stat_kind`（base / max / trained / boosted）を必ず分離。eFHUB 非提供の計算結果は `computed_*` に分ける。
- 全レコードに `parser_version` を持たせ、RSC 構造変更時の再取得対象を特定可能にする。
- パーサ `.2` で `playing_style_defensive`（守備プレースタイル英語名・任意・NULL 可）を追加。

> 下記「## 1〜」は設計案（詳細版）。**Phase B.5 で実際に作成した最小テーブルは `scripts/sqlite/schema.sql` を参照**（player_cards / player_card_stats / player_card_skills / player_card_com_skills / player_card_positions / player_card_boosters / sync_runs / sync_errors / parser_versions）。
> 型は SQLite 表記。PostgreSQL へは `TEXT→TEXT` `INTEGER→INTEGER` `REAL→DOUBLE PRECISION` `INTEGER(bool)→BOOLEAN` `TEXT(iso)→TIMESTAMPTZ` で移行。

---

## 1. カード本体

```sql
CREATE TABLE player_cards (
  internal_card_id   INTEGER PRIMARY KEY,           -- 自前連番（またはUUID）
  efhub_card_id      TEXT    NOT NULL UNIQUE,        -- RSC の playerId（= player-index.json の i と同体系。文字列保持）
  slug               TEXT    NOT NULL,
  name_en            TEXT    NOT NULL,
  name_ja            TEXT    NOT NULL,
  name_zh            TEXT    NOT NULL,

  ovr_base           INTEGER NOT NULL,              -- player.overallRating（= レベル1 基礎 OVR と推測）
  ovr_max            INTEGER,                       -- player-index.json の o（= 最大レベル OVR 候補）。パーサ単体では NULL

  player_type_code   INTEGER NOT NULL,              -- player.playerType（数値・意味未確認・名称変換しない）
  registered_position TEXT   NOT NULL,              -- player.position（GK/CB/.../CF）
  playing_style_name TEXT    NOT NULL,              -- player.playingStyle（攻撃プレースタイル英語名。数値コードは未取得）
  playing_style_defensive TEXT,                     -- player.playingStyleDefensive（守備プレースタイル英語名・任意・NULL 可）

  country_id         INTEGER NOT NULL,              -- player.countryId
  league_id          INTEGER NOT NULL,              -- player.leagueId
  league_name        TEXT    NOT NULL,
  team_id            TEXT    NOT NULL,              -- player.teamId（"50" のような文字列）
  team_name          TEXT    NOT NULL,

  age                INTEGER NOT NULL,
  height_cm          INTEGER NOT NULL,
  weight_kg          INTEGER NOT NULL,
  preferred_foot     TEXT    NOT NULL,              -- "Left" / "Right"

  weak_foot_usage    INTEGER NOT NULL,
  weak_foot_accuracy INTEGER NOT NULL,
  form               INTEGER NOT NULL,              -- 値域未確認
  condition_value    INTEGER NOT NULL,              -- player.condition（現在の調子）値域未確認
  injury_resistance  INTEGER NOT NULL,              -- 値域未確認

  level_cap          INTEGER NOT NULL,              -- player.levelCap（カードごとに異なる）

  boost_id_1         INTEGER NOT NULL DEFAULT 0,    -- player.boostId  （0 = 空スロット）
  boost_id_2         INTEGER NOT NULL DEFAULT 0,    -- player.boostId2 （0 = 空スロット）

  gp_value           REAL    NOT NULL DEFAULT 0,
  image_url          TEXT    NOT NULL,
  datapack_id        INTEGER NOT NULL,              -- player.datapackId（データ版・差分判定に使用）

  source             TEXT    NOT NULL DEFAULT 'efhub',
  source_url         TEXT    NOT NULL,
  parser_version     TEXT    NOT NULL,
  fetched_at         TEXT    NOT NULL               -- ISO8601
);
CREATE INDEX ix_player_cards_name_ja ON player_cards(name_ja);
CREATE INDEX ix_player_cards_name_en ON player_cards(name_en);
CREATE INDEX ix_player_cards_position ON player_cards(registered_position);
CREATE INDEX ix_player_cards_type ON player_cards(player_type_code);
```

## 2. 能力値

```sql
CREATE TABLE stat_definitions (
  stat_key      TEXT PRIMARY KEY,     -- 'offensiveAwareness' ... 'gkReach'（RSC 実キー）
  name_en       TEXT NOT NULL,        -- 'Offensive Awareness' ...（'ballWinning'→'Tackling' 等の別名あり）
  name_ja       TEXT,                 -- screenshots 確認後に埋める（現状 NULL）
  stat_group    TEXT NOT NULL,        -- 'offense' | 'defense' | 'gk' | 'physical'
  display_order INTEGER NOT NULL
);

CREATE TABLE player_card_stats (
  internal_card_id INTEGER NOT NULL REFERENCES player_cards(internal_card_id),
  stat_key         TEXT    NOT NULL REFERENCES stat_definitions(stat_key),
  stat_kind        TEXT    NOT NULL DEFAULT 'base',   -- 'base' | 'max' | 'trained' | 'boosted'
  value            INTEGER NOT NULL,
  PRIMARY KEY (internal_card_id, stat_key, stat_kind)
);
-- Phase A で取得できるのは stat_kind='base' のみ（player.stats / baseStats）。
```

## 3. スキル

```sql
CREATE TABLE skills (
  skill_key      TEXT PRIMARY KEY,    -- 'throughPassing' 等（RSC 実キー）
  name_en        TEXT,                -- messages.skillDescriptions の見出しから補完
  name_ja        TEXT,
  description_en TEXT
);

CREATE TABLE player_card_skills (
  internal_card_id INTEGER NOT NULL REFERENCES player_cards(internal_card_id),
  skill_key        TEXT    NOT NULL,
  skill_slot       TEXT    NOT NULL,   -- 'player'（playerSkills）| 'com'（comSkills）
  display_order    INTEGER NOT NULL,
  is_additional    INTEGER,            -- 基礎/追加の区別。データ上の判定キー未特定 → 当面 NULL
  PRIMARY KEY (internal_card_id, skill_slot, skill_key)
);
```

## 4. プレースタイル

```sql
CREATE TABLE playstyles (
  playstyle_key TEXT PRIMARY KEY,   -- 'deepLyingForward' 等
  name_en       TEXT NOT NULL,      -- 'Deep-Lying Forward'
  name_ja       TEXT,
  numeric_code  INTEGER             -- 数値コードは未取得 → NULL
);
-- player_cards.playing_style_name（英語名）から playstyle_key を引く対応表を別途用意。
```

## 5. ポジション適性

```sql
CREATE TABLE player_card_positions (
  internal_card_id INTEGER NOT NULL REFERENCES player_cards(internal_card_id),
  position_code    TEXT    NOT NULL,  -- 'SS' 等
  familiarity      INTEGER NOT NULL,  -- 0=登録本人扱い / 1=部分適性 / 2=高適性（推測）
  is_registered    INTEGER NOT NULL,  -- 1 = player.position と一致
  PRIMARY KEY (internal_card_id, position_code)
);
```

## 6. 体格モデル

```sql
CREATE TABLE player_card_model (
  internal_card_id INTEGER PRIMARY KEY REFERENCES player_cards(internal_card_id),
  arm_length REAL, shoulder_width REAL, neck_length REAL, chest_measurement REAL,
  neck_size REAL, shoulder_height REAL, leg_length REAL, thigh_size REAL, waist_size REAL,
  arm_size REAL, calf_size REAL, leg_coverage_radius REAL, arm_coverage_radius REAL,
  jumping_height REAL, torso_collision REAL, dribble_height REAL
);
```

## 7. ブースター

```sql
CREATE TABLE boosters (
  booster_id  INTEGER PRIMARY KEY,   -- player.boostId / boostId2 の値
  name_en     TEXT,                  -- messages.boosterNames から補完
  name_ja     TEXT,
  effect_json TEXT                   -- 上昇対象能力・上昇量。Phase D/追加調査で確定
);
-- カード側の適用は player_cards.boost_id_1 / boost_id_2 で保持（0 = 空）。
-- ブースター適用前後の能力値は eFHUB からは未取得（自前計算 or 追加調査）。
```

## 8. 参照マスタ（名称解決用）

```sql
CREATE TABLE countries (country_id INTEGER PRIMARY KEY, name_en TEXT NOT NULL, region TEXT);
CREATE TABLE leagues   (league_id  INTEGER PRIMARY KEY, name_en TEXT NOT NULL);
CREATE TABLE teams     (team_id    TEXT    PRIMARY KEY, name_en TEXT NOT NULL, league_id INTEGER);
CREATE TABLE player_types (code INTEGER PRIMARY KEY, name_en TEXT);  -- 判明分のみ。未確認は行を作らない
-- region は countries から導出（RSC の player には region が無い）。
```

## 9. 同期（Phase B から使用）

```sql
CREATE TABLE source_records (
  efhub_card_id  TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'efhub',
  content_hash   TEXT NOT NULL,        -- 正規化した抽出結果のハッシュ（差分判定）
  parser_version TEXT NOT NULL,
  http_status    INTEGER,
  fetched_at     TEXT NOT NULL,
  PRIMARY KEY (efhub_card_id, source)
);

CREATE TABLE sync_runs (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,           -- 'index' | 'detail' | 'detail-diff'
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL,           -- 'running' | 'done' | 'stopped' | 'failed'
  cursor      TEXT,                    -- 再開位置（索引内の位置など）
  ok_count    INTEGER NOT NULL DEFAULT 0,
  fail_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sync_errors (
  id           INTEGER PRIMARY KEY,
  run_id       INTEGER REFERENCES sync_runs(id),
  efhub_card_id TEXT,
  http_status  INTEGER,
  error        TEXT,
  attempt      INTEGER NOT NULL,
  at           TEXT NOT NULL
);
```

## 10. 自前計算（Phase E）

```sql
CREATE TABLE calculation_versions (version TEXT PRIMARY KEY, note TEXT, created_at TEXT NOT NULL);

CREATE TABLE computed_card_stats (           -- Max Level / 育成後の能力値（eFHUB 非提供）
  internal_card_id INTEGER NOT NULL REFERENCES player_cards(internal_card_id),
  calc_version     TEXT NOT NULL REFERENCES calculation_versions(version),
  stat_key         TEXT NOT NULL,
  level            INTEGER NOT NULL,
  value            INTEGER NOT NULL,
  PRIMARY KEY (internal_card_id, calc_version, stat_key, level)
);

CREATE TABLE computed_position_ratings (     -- ポジション別総合値（eFHUB 非提供）
  internal_card_id INTEGER NOT NULL REFERENCES player_cards(internal_card_id),
  calc_version     TEXT NOT NULL REFERENCES calculation_versions(version),
  position_code    TEXT NOT NULL,
  ovr              INTEGER NOT NULL,
  PRIMARY KEY (internal_card_id, calc_version, position_code)
);
```

---

## MVP 要否

| テーブル | Phase |
|---|---|
| player_cards, stat_definitions, player_card_stats(base), player_card_skills, player_card_positions, player_card_model | **Phase B/C（最初に必要）** |
| skills, playstyles, boosters, countries, leagues, teams, player_types | Phase C（名称解決・随時補充） |
| source_records, sync_runs, sync_errors | Phase B〜D |
| calculation_versions, computed_* | Phase E |
