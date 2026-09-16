-- ============================================================================
-- reference_data: 詳細フィールド追加(前進用migration、2026-09-15)
-- ============================================================================
--
-- 目的:
--   既存の reference_data.world_player_cards(13,009件)・reference_data.managers(66件)
--   へ、これまで未移行だった詳細フィールドを列として追加する。
--
--   対象(SQLite正本での実測、2026-09-15):
--     world_player_cards へ追加:
--       - efhub_card_id  (source_record_links由来。world↔efhub 1:1リンク、653件に存在)
--       - ai_styles      (world_player_ai_styles由来、28,045件・11,558カードに存在)
--       - appearance     (world_player_appearances由来、13,009件=全カードに1:1で存在)
--       - efhub_conflicts(data_conflictsの安全な要約のみ。59件・21カードに存在。
--                          internal_card_id/detected_at/confidence/resolution_status/
--                          resolved_value/resolution_reasonという内部監査専用フィールドは
--                          一般公開に不要と判断し含めない。fieldName/efhubValue/worldValueの
--                          3項目のみを公開する)
--     managers へ追加:
--       - boosters       (manager_boosters由来、104件)
--       - link_up_plays  (manager_link_up_plays+manager_link_up_conditions由来、26+52件)
--
--   これらはいずれも「1カード/1監督の詳細を1件まとめて取得する」性質のデータであり、
--   一覧の検索・フィルタ・並べ替えには使わない(既存のWorldListQuery/ManagerListQueryに
--   該当フィルタが存在しないことをコードで確認済み)。そのため、既存のstats/skills/
--   player_model/positions と同じ設計方針(常に一緒に取得するデータはJSONB/配列で
--   1カラムにまとめ、独立テーブル化によるN+1を避ける)を踏襲し、新規テーブルは作成せず、
--   既存2テーブルへの列追加(ALTER TABLE ADD COLUMN)のみで完結させる。
--
-- 影響範囲: reference_data.world_player_cards・reference_data.managers の
--   列追加のみ。既存の13,009件・66件の行、既存の他カラムの値は一切変更しない
--   (ADD COLUMNは新規列をNULL/既定値で追加するだけで、既存データを書き換えない)。
--   reference_data.player_card_analysis(19件)・reference_data.import_batches は無変更。
--   public/authスキーマ、他の既存テーブルには一切触れない。
--
-- 冪等性: このファイルは複数回実行しても安全(IF NOT EXISTS / OR REPLACE を使用)。
--   既に列が存在する場合、ADD COLUMN IF NOT EXISTSは何もしない。
--
-- 実行前提: このファイルはまだ実Supabaseへ実行していない(監査可能なmigrationとして
--   作成したのみ)。実行する場合も、まずステージング/PreviewのSupabaseプロジェクトで
--   実行し、Table Editor・Policies画面での確認を経ること。
--
-- ロールバック: rollback-reference-data-detail-extension.sql を参照。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. world_player_cards への列追加
-- ----------------------------------------------------------------------------
alter table reference_data.world_player_cards
  add column if not exists efhub_card_id text,
  add column if not exists ai_styles text[] not null default '{}',
  add column if not exists appearance jsonb,
  add column if not exists efhub_conflicts jsonb not null default '[]'::jsonb;

-- efhub_card_id の形式チェック(World ID と同じ桁数のみの数字文字列。NULL可)
alter table reference_data.world_player_cards
  drop constraint if exists world_player_cards_efhub_card_id_format;
alter table reference_data.world_player_cards
  add constraint world_player_cards_efhub_card_id_format
  check (efhub_card_id is null or efhub_card_id ~ '^[0-9]{1,20}$');

-- efhub_card_id は1:1(source_record_linksで検証済み: 重複なし)。NULLは複数許容(Postgresの標準挙動)。
alter table reference_data.world_player_cards
  drop constraint if exists world_player_cards_efhub_card_id_unique;
alter table reference_data.world_player_cards
  add constraint world_player_cards_efhub_card_id_unique unique (efhub_card_id);

alter table reference_data.world_player_cards
  drop constraint if exists world_player_cards_appearance_is_object;
alter table reference_data.world_player_cards
  add constraint world_player_cards_appearance_is_object
  check (appearance is null or jsonb_typeof(appearance) = 'object');

alter table reference_data.world_player_cards
  drop constraint if exists world_player_cards_efhub_conflicts_is_array;
alter table reference_data.world_player_cards
  add constraint world_player_cards_efhub_conflicts_is_array
  check (jsonb_typeof(efhub_conflicts) = 'array');

comment on column reference_data.world_player_cards.efhub_card_id is
  'source_record_links由来(world↔efhub 1:1リンク)。世界カードにeFHUB個別ページの対応が無い場合はNULL。';
comment on column reference_data.world_player_cards.ai_styles is
  'world_player_ai_styles由来。表示順(display_order)を保持したテキスト配列。対応が無いカードは空配列。';
comment on column reference_data.world_player_cards.appearance is
  'world_player_appearances由来(体格・当たり判定・順位情報)。1カード1件。未移行/対応なしはNULL。';
comment on column reference_data.world_player_cards.efhub_conflicts is
  'data_conflictsの安全な要約のみ(fieldName/efhubValue/worldValue)。internal_card_id・detected_at・confidence・resolution_status等の内部監査専用フィールドは含まない。対応が無いカードは空配列。';

-- ----------------------------------------------------------------------------
-- 2. managers への列追加
-- ----------------------------------------------------------------------------
alter table reference_data.managers
  add column if not exists boosters jsonb not null default '[]'::jsonb,
  add column if not exists link_up_plays jsonb not null default '[]'::jsonb;

alter table reference_data.managers
  drop constraint if exists managers_boosters_is_array;
alter table reference_data.managers
  add constraint managers_boosters_is_array
  check (jsonb_typeof(boosters) = 'array');

alter table reference_data.managers
  drop constraint if exists managers_link_up_plays_is_array;
alter table reference_data.managers
  add constraint managers_link_up_plays_is_array
  check (jsonb_typeof(link_up_plays) = 'array');

comment on column reference_data.managers.boosters is
  'manager_boosters由来。display_order順の配列。要素: {statNameEn, statKey, delta, rawValue, applicationCondition, confirmationStatus}。';
comment on column reference_data.managers.link_up_plays is
  'manager_link_up_plays+manager_link_up_conditions由来。display_order順の配列。要素: {name, centerPiece, keyMan, confirmationStatus}(centerPiece/keyManは{playingStyle, positions}またはnull)。';

-- ----------------------------------------------------------------------------
-- 3. 権限(GRANT) — 既存のSELECT権限をそのまま適用(新規GRANTは不要)
-- ----------------------------------------------------------------------------
-- reference_data.world_player_cards / reference_data.managers への
-- anon・authenticated の SELECT 権限は create-reference-data-schema.sql で
-- テーブル単位に付与済みであり、列追加によって自動的に新列も対象になる
-- (PostgreSQLのGRANT SELECTはテーブル単位であり、列単位の追加GRANTは不要)。
-- 新しいテーブルは作成していないため、Exposed schemasの追加設定も不要な想定だが、
-- 実行後にSupabase Dashboardで新列がData API経由で見えることを別途確認すること
-- (Automatically expose new tablesの設定はテーブル単位のものであり、
-- 今回は新テーブルを作らないため無関係と考えられるが、断定せず実行後に確認する)。

-- ============================================================================
-- 実行後にSupabaseダッシュボードで確認すること(実行する場合):
--   Table Editor → reference_data.world_player_cards に
--     efhub_card_id / ai_styles / appearance / efhub_conflicts の4列が追加されている
--   Table Editor → reference_data.managers に
--     boosters / link_up_plays の2列が追加されている
--   Table Editor → 既存13,009件・66件の他の列の値が変化していない
--   Database → Roles → anon/authenticatedが新列も含めてSELECTできる
--     (Data APIから対象テーブルをSELECTし、新列がレスポンスに含まれることを確認する)
--   reference_data.player_card_analysis(19件)・reference_data.import_batches に変化がない
--   public.my_team_snapshots・public.rls_probe_records・auth.usersに影響が無い
-- ============================================================================
